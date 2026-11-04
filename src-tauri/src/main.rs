// 쌤비서 · Windows 데스크톱 앱 (Tauri)
// 릴리즈 빌드에서는 뒤에 검은 콘솔 창이 뜨지 않게 함
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ai_proxy;
mod bubble;
mod files;
mod neis;
#[cfg(windows)]
mod shell_win;
mod test_key;
mod updater;

use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Emitter;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UninstallInfo {
    /// 설치 파일로 설치했으면 true (실행 파일 옆에 uninstall.exe가 있음)
    installed: bool,
    /// 지금 실행 중인 프로그램 파일 위치
    exe_path: String,
}

/// 설치판이면 실행 파일 옆의 제거 프로그램 위치
fn uninstaller_path() -> Option<std::path::PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let p = exe.parent()?.join("uninstall.exe");
    if p.is_file() {
        Some(p)
    } else {
        None
    }
}

#[tauri::command]
fn uninstall_info() -> UninstallInfo {
    UninstallInfo {
        installed: uninstaller_path().is_some(),
        exe_path: std::env::current_exe()
            .map(|p| p.display().to_string())
            .unwrap_or_default(),
    }
}

/// 프로그램 삭제
/// 백신이 의심하지 않도록 cmd 같은 다른 프로그램을 몰래 실행하지 않는다.
/// - clear_data: 화면 쪽에서 저장소를 비운 뒤, 여기서 WebView 자료(저장소·캐시)도 지움
/// - 설치판: Windows 제거 프로그램(uninstall.exe)을 열고 앱을 닫음
/// - 실행 파일판: 앱을 닫고 탐색기에서 프로그램 파일을 보여 줌 (파일은 사용자가 지움)
#[tauri::command]
fn run_uninstall(app: tauri::AppHandle, clear_data: bool) -> Result<String, String> {
    use tauri::Manager;
    use tauri_plugin_opener::OpenerExt;

    if !cfg!(windows) {
        return Err("프로그램 삭제는 Windows에서만 할 수 있어요".to_string());
    }
    if clear_data {
        for w in app.webview_windows().values() {
            let _ = w.clear_all_browsing_data();
        }
    }
    let result = match uninstaller_path() {
        Some(path) => std::process::Command::new(path)
            .spawn()
            .map(|_| "installed".to_string())
            .map_err(|e| format!("제거 프로그램을 열지 못했어요: {e}")),
        None => std::env::current_exe()
            .map_err(|e| format!("프로그램 위치를 찾지 못했어요: {e}"))
            .and_then(|exe| {
                app.opener()
                    .reveal_item_in_dir(&exe)
                    .map_err(|e| format!("프로그램 파일 위치를 열지 못했어요: {e}"))
            })
            .map(|_| "portable".to_string()),
    };

    if result.is_ok() {
        // 컴퓨터를 켤 때 지운 프로그램을 띄우려 하지 않게 자동 시작을 끔
        {
            use tauri_plugin_autostart::ManagerExt;
            let _ = app.autolaunch().disable();
        }
        // 화면이 응답을 받을 틈을 준 뒤 앱을 닫아 파일 잠금을 풂
        let handle = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(400));
            handle.exit(0);
        });
    }
    result
}

/// 시험용 업스테이지 키가 들어 있고 기한 안인지(키 값은 주지 않음)
#[derive(serde::Serialize)]
struct TestKeyInfo {
    available: bool,
    until: &'static str,
}
#[tauri::command]
fn test_key_info() -> TestKeyInfo {
    TestKeyInfo { available: test_key::available(), until: test_key::UNTIL_TEXT }
}

/// 지금 앱 버전
#[tauri::command]
fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateInfo {
    current: String,
    /// 공개 레포에 올라온 최신 버전 ("" = 아직 릴리즈 없음)
    latest: String,
    /// 새 버전이 있으면 true
    available: bool,
    /// 이번에 바뀐 점 (마크다운)
    notes: String,
    published: String,
    /// 실행 파일판이면 true, 설치판이면 false
    portable: bool,
    /// 받을 파일 크기 (바이트)
    size: u64,
    /// 직접 받을 수 있는 릴리즈 페이지
    page: String,
}

/// 새 버전 확인
#[tauri::command]
async fn check_update() -> Result<UpdateInfo, String> {
    let current = env!("CARGO_PKG_VERSION").to_string();
    let portable = uninstaller_path().is_none();
    let page = updater::release_page(updater::RELEASES_REPO);
    let client = updater::client()?;
    match updater::latest_manifest(&client, updater::GITHUB, updater::RELEASES_REPO).await {
        Ok(m) => Ok(UpdateInfo {
            available: updater::is_newer(&m.version, &current),
            size: m.file(portable).size,
            latest: m.version,
            notes: m.notes,
            published: m.published,
            current,
            portable,
            page,
        }),
        Err(e) if e == updater::NO_RELEASE => Ok(UpdateInfo {
            current,
            latest: String::new(),
            available: false,
            notes: String::new(),
            published: String::new(),
            portable,
            size: 0,
            page,
        }),
        Err(e) => Err(e),
    }
}

#[derive(Clone, Serialize)]
struct UpdateProgress {
    /// "download" 받는 중 · "verify" 확인값 검사 · "install" 설치 시작
    stage: &'static str,
    done: u64,
    total: u64,
}

static INSTALLING: AtomicBool = AtomicBool::new(false);

/// 새 버전을 받아 확인값을 검사하고 설치. 성공하면 앱이 닫혔다가 새 버전으로 다시 켜짐
#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<String, String> {
    if !cfg!(windows) {
        return Err("업데이트 설치는 Windows에서만 할 수 있어요".to_string());
    }
    if INSTALLING.swap(true, Ordering::SeqCst) {
        return Err("이미 업데이트하고 있어요".to_string());
    }
    let result = install_update_inner(&app).await;
    match &result {
        Ok(_) => {
            // 화면이 응답을 받을 틈을 준 뒤 앱을 닫아 파일 잠금을 풂
            let handle = app.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(800));
                handle.exit(0);
            });
        }
        Err(_) => INSTALLING.store(false, Ordering::SeqCst),
    }
    result
}

async fn install_update_inner(app: &tauri::AppHandle) -> Result<String, String> {
    let current = env!("CARGO_PKG_VERSION");
    let client = updater::client()?;
    let m = updater::latest_manifest(&client, updater::GITHUB, updater::RELEASES_REPO)
        .await
        .map_err(|e| {
            if e == updater::NO_RELEASE {
                "아직 올라온 업데이트가 없어요".to_string()
            } else {
                e
            }
        })?;
    if !updater::is_newer(&m.version, current) {
        return Err("이미 최신 버전이에요".to_string());
    }
    let portable = uninstaller_path().is_none();
    let entry = m.file(portable).clone();
    let exe = std::env::current_exe().map_err(|e| format!("프로그램 위치를 찾지 못했어요: {e}"))?;

    // 실행 파일판은 같은 폴더에 받아서(쓰기 되는지도 확인) 이름만 바꿔 끼움
    let (dest, target) = if portable {
        let target = updater::portable_target(&exe, &entry.name);
        let dest = exe.with_file_name(format!("{}.ssam-download", entry.name));
        (dest, Some(target))
    } else {
        let dest = std::env::temp_dir()
            .join(updater::TEMP_DIR_NAME)
            .join(&entry.name);
        (dest, None)
    };

    let url = updater::file_url(
        updater::GITHUB,
        updater::RELEASES_REPO,
        &m.version,
        &entry.name,
    );
    let mut last_pct: u64 = u64::MAX;
    let hash = updater::download(&client, &url, &dest, |done, total| {
        let total = if total > 0 { total } else { entry.size };
        // 1%마다(전체 크기를 모르면 1MB마다) 화면에 알림
        let pct = done
            .saturating_mul(100)
            .checked_div(total)
            .unwrap_or(done >> 20);
        if pct != last_pct {
            last_pct = pct;
            let _ = app.emit(
                "update-progress",
                UpdateProgress {
                    stage: "download",
                    done,
                    total,
                },
            );
        }
    })
    .await?;

    let _ = app.emit(
        "update-progress",
        UpdateProgress {
            stage: "verify",
            done: 0,
            total: 0,
        },
    );
    if let Err(e) = updater::verify(&hash, &entry) {
        let _ = std::fs::remove_file(&dest);
        return Err(e);
    }

    let _ = app.emit(
        "update-progress",
        UpdateProgress {
            stage: "install",
            done: 0,
            total: 0,
        },
    );
    match target {
        Some(target) => {
            // 옛 파일은 비켜 두고 새 파일을 제자리에 놓은 뒤 새 앱을 켬.
            // 새 앱은 이 앱이 닫혀 옛 파일을 지울 수 있을 때까지 기다렸다가 시작함
            updater::swap_portable(&exe, &dest, &target)?;
            updater::launch_updated(&target)
                .map_err(|e| format!("새 버전으로 바꿨어요. 앱을 닫고 다시 켜 주세요. ({e})"))?;
            Ok("portable".to_string())
        }
        None => {
            updater::launch_setup(&dest)?;
            Ok("installed".to_string())
        }
    }
}

fn main() {
    if let Ok(exe) = std::env::current_exe() {
        // 업데이트로 새로 켜졌으면 옛 앱이 닫힐 때까지 잠깐 기다림 (같은 저장 공간을 동시에 쓰지 않게)
        if std::env::args().any(|a| a == updater::UPDATED_FLAG) {
            updater::wait_old_gone(&exe, std::time::Duration::from_secs(15));
        }
        // 지난 업데이트에서 남은 옛 파일·설치 파일 치우기
        updater::cleanup_leftovers(&exe, &std::env::temp_dir());
    }

    tauri::Builder::default()
        // 쌤비서를 또 켜면 새로 띄우지 않고 이미 켜진 창을 앞으로 (떠 있는 버튼만 남아 있을 때도)
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| bubble::show_main(app)))
        // 떠 있는 버튼: 컴퓨터를 켜면 버튼만 띄우기(--bubble)
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--bubble"])))
        // API 키 받는 곳 같은 바깥 링크를 기본 브라우저로 열기
        .plugin(tauri_plugin_opener::init())
        // 나이스 자동 붙여넣기: 준비했을 때만 Ctrl+V(와 붙여넣는 동안 Esc)를 잠깐 맡음
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(neis::on_shortcut)
                .build(),
        )
        .manage(neis::Neis::default())
        .manage(bubble::Bubble::default())
        // 쌤비서 창은 숨긴 채 만들어 두고, 컴퓨터를 켜며 버튼만 띄운 경우(--bubble)가 아니면 보임
        .setup(|app| {
            if !std::env::args().any(|a| a == "--bubble") {
                bubble::show_main(app.handle());
            }
            Ok(())
        })
        .on_window_event(bubble::on_window_event)
        .on_menu_event(bubble::on_menu_event)
        .invoke_handler(tauri::generate_handler![
            uninstall_info,
            run_uninstall,
            app_version,
            test_key_info,
            check_update,
            install_update,
            neis::neis_arm,
            neis::neis_disarm,
            neis::queue_arm,
            neis::queue_goto,
            ai_proxy::ai_proxy,
            files::save_download,
            files::note_save_attachments,
            files::note_copy_files,
            files::note_drag_files,
            files::note_open_dir,
            bubble::bubble_config,
            bubble::inbox_take,
            bubble::inbox_read,
            bubble::bubble_action,
            bubble::bubble_menu
        ])
        .run(tauri::generate_context!())
        .expect("쌤비서를 실행하지 못했어요");
}
