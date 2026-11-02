//! 만든 파일(.hwpx 등)을 다운로드 폴더에 저장. 같은 이름이 있으면 「이름 (2).hwpx」처럼 비켜 씀.

use std::path::{Path, PathBuf};

/// 파일 이름에 쓸 수 없는 글자를 `_`로 바꿈. 비면 「파일」
pub fn safe_name(name: &str) -> String {
    let s: String = name
        .chars()
        .map(|c| {
            if c.is_control() || matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') {
                '_'
            } else {
                c
            }
        })
        .collect();
    let s = s.trim().trim_matches('.').to_string();
    if s.is_empty() {
        "파일".to_string()
    } else {
        s
    }
}

/// `dir/name`이 이미 있으면 `이름 (2).확장자`, `이름 (3).확장자` …
pub fn unique_path(dir: &Path, name: &str) -> PathBuf {
    let first = dir.join(name);
    if !first.exists() {
        return first;
    }
    let (stem, ext) = match name.rfind('.') {
        Some(i) if i > 0 => (&name[..i], &name[i..]),
        _ => (name, ""),
    };
    (2..)
        .map(|n| dir.join(format!("{stem} ({n}){ext}")))
        .find(|p| !p.exists())
        .unwrap_or(first)
}

fn downloads_dir() -> PathBuf {
    std::env::var_os("USERPROFILE")
        .map(|h| PathBuf::from(h).join("Downloads"))
        .filter(|p| p.is_dir())
        .unwrap_or_else(std::env::temp_dir)
}

/// 다운로드 폴더에 저장하고 저장한 경로를 돌려줌
#[tauri::command]
pub fn save_download(name: String, bytes: Vec<u8>) -> Result<String, String> {
    let path = unique_path(&downloads_dir(), &safe_name(&name));
    std::fs::write(&path, bytes).map_err(|e| format!("파일을 저장하지 못했어요: {e}"))?;
    Ok(path.to_string_lossy().into_owned())
}

/// 쪽지 붙임 파일 하나 (화면에서 받은 이름·내용)
#[derive(serde::Deserialize)]
pub struct NoteFile {
    pub name: String,
    pub bytes: Vec<u8>,
}

/// 저장한 폴더와 파일 경로들 (넘긴 차례대로)
#[derive(serde::Serialize, Debug)]
pub struct NoteSaved {
    pub dir: String,
    pub paths: Vec<String>,
}

/// 쪽지 붙임을 모으는 곳: `base/쌤비서 쪽지 붙임`
pub fn notes_root(base: &Path) -> PathBuf {
    base.join("쌤비서 쪽지 붙임")
}

/// `base/쌤비서 쪽지 붙임/<폴더 이름>` (폴더 이름에 쓸 수 없는 글자는 `_`)
pub fn note_dir(base: &Path, folder: &str) -> PathBuf {
    notes_root(base).join(safe_name(folder))
}

/// 붙임 폴더 안의 경로인지(`..` 없이). 복사·열기는 이 안만 — 다른 파일·프로그램을 열지 않게
pub fn inside_notes(base: &Path, p: &Path) -> bool {
    p.starts_with(notes_root(base)) && !p.components().any(|c| matches!(c, std::path::Component::ParentDir))
}

/// 쪽지 붙임을 폴더에 씀. 같은 이름에 같은 내용이면 그 파일을 다시 쓰고(다시 눌러도 늘지 않게), 다르면 「이름 (2)」
pub fn save_note_files(base: &Path, folder: &str, files: Vec<NoteFile>) -> Result<NoteSaved, String> {
    let dir = note_dir(base, folder);
    std::fs::create_dir_all(&dir).map_err(|e| format!("붙임 폴더를 만들지 못했어요: {e}"))?;
    let mut paths = Vec::new();
    for f in files {
        let name = safe_name(&f.name);
        let same = dir.join(&name);
        let path = if std::fs::read(&same).map(|b| b == f.bytes).unwrap_or(false) {
            same
        } else {
            let p = unique_path(&dir, &name);
            std::fs::write(&p, &f.bytes).map_err(|e| format!("붙임 파일을 저장하지 못했어요: {e}"))?;
            p
        };
        paths.push(path.to_string_lossy().into_owned());
    }
    Ok(NoteSaved { dir: dir.to_string_lossy().into_owned(), paths })
}

/// 쪽지 붙임을 다운로드 폴더의 「쌤비서 쪽지 붙임/<날짜 제목>」에 모음
#[tauri::command]
pub fn note_save_attachments(folder: String, files: Vec<NoteFile>) -> Result<NoteSaved, String> {
    save_note_files(&downloads_dir(), &folder, files)
}

/// 파일들을 클립보드에 파일로 넣음(탐색기에서 Ctrl+C 한 것처럼) — 쪽지 창 첨부 칸에 Ctrl+V
#[tauri::command]
pub fn note_copy_files(paths: Vec<String>) -> Result<(), String> {
    let base = downloads_dir();
    if paths.iter().any(|p| !inside_notes(&base, Path::new(p))) {
        return Err("쪽지 붙임 폴더 밖의 파일은 복사하지 않아요".into());
    }
    let mut cb = arboard::Clipboard::new().map_err(|e| format!("클립보드를 열지 못했어요: {e}"))?;
    cb.set().file_list(&paths).map_err(|e| format!("파일을 클립보드에 넣지 못했어요: {e}"))
}

/// 붙임 폴더를 탐색기로 엶
#[tauri::command]
pub fn note_open_dir(app: tauri::AppHandle, dir: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    if !inside_notes(&downloads_dir(), Path::new(&dir)) || !Path::new(&dir).is_dir() {
        return Err("쪽지 붙임 폴더만 열 수 있어요".into());
    }
    app.opener().open_path(dir, None::<&str>).map_err(|e| format!("폴더를 열지 못했어요: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn safe_names() {
        assert_eq!(safe_name("a/b:c?.hwpx"), "a_b_c_.hwpx");
        assert_eq!(safe_name(""), "파일");
        assert_eq!(safe_name("  품의.hwpx "), "품의.hwpx");
    }

    #[test]
    fn unique_paths() {
        let dir = std::env::temp_dir().join(format!("ssam-files-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        assert_eq!(unique_path(&dir, "품의.hwpx"), dir.join("품의.hwpx"));
        std::fs::write(dir.join("품의.hwpx"), b"x").unwrap();
        assert_eq!(unique_path(&dir, "품의.hwpx"), dir.join("품의 (2).hwpx"));
        std::fs::write(dir.join("품의 (2).hwpx"), b"x").unwrap();
        assert_eq!(unique_path(&dir, "품의.hwpx"), dir.join("품의 (3).hwpx"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn note_dirs() {
        let base = std::env::temp_dir().join(format!("ssam-note-test-{}", std::process::id()));
        assert_eq!(note_dir(&base, "2026-11-12 AI: 연수?"), base.join("쌤비서 쪽지 붙임").join("2026-11-12 AI_ 연수_"));
        // 같은 이름: 내용이 같으면 그 파일을 다시 쓰고, 다르면 (2)
        let saved = save_note_files(&base, "2026-11-12 연수", vec![NoteFile { name: "계획.hwpx".into(), bytes: b"a".to_vec() }]).unwrap();
        let again = save_note_files(&base, "2026-11-12 연수", vec![NoteFile { name: "계획.hwpx".into(), bytes: b"a".to_vec() }, NoteFile { name: "계획.hwpx".into(), bytes: b"b".to_vec() }]).unwrap();
        assert_eq!(again.paths[0], saved.paths[0]);
        assert!(again.paths[1].ends_with("계획 (2).hwpx"), "{}", again.paths[1]);
        assert_eq!(again.dir, saved.dir);
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn notes_paths_only() {
        let base = std::path::PathBuf::from("C:/Users/t/Downloads");
        assert!(inside_notes(&base, &base.join("쌤비서 쪽지 붙임").join("2026-11-12 연수").join("계획.hwpx")));
        assert!(inside_notes(&base, &base.join("쌤비서 쪽지 붙임").join("2026-11-12 연수")));
        assert!(!inside_notes(&base, &base.join("다른 폴더").join("a.txt")));
        assert!(!inside_notes(&base, &base.join("쌤비서 쪽지 붙임").join("..").join("a.exe")));
        assert!(!inside_notes(&base, std::path::Path::new("C:/Windows/notepad.exe")));
    }
}
