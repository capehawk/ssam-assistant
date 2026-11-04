//! 나이스 자동 붙여넣기
//!
//! 「전체복사」를 누르면 학생별 평어를 받아 두고(준비) 잠깐 Ctrl+V를 이 앱이 맡는다.
//! 나이스(브라우저)에서 첫 학생 칸을 누르고 Ctrl+V를 누르면 학생마다
//! 그 학생 평어 넣기 → Tab을 정한 횟수만큼 눌러 다음 학생 칸으로 가기를 되풀이한다.
//! - 넣는 방식은 「글자 입력」(기본)과 「붙여넣기」 두 가지.
//!   글자 입력은 클립보드를 쓰지 않고 키보드 입력 차례대로 처리되므로, 나이스가 느려도 학생끼리 섞이지 않는다.
//! - Esc를 누르면 지금 학생까지 마치고 멈춤
//! - Ctrl+V를 누른 창에서 다른 창으로 옮겨 가거나, 사용자가 키를 누르면 바로 멈춤
//! - 이 앱 창에서 누른 Ctrl+V와, 브라우저가 아닌 창에서 누른 Ctrl+V는 평소처럼 붙여넣기
//! - 준비하고 5분 안에 Ctrl+V를 누르지 않으면 저절로 풀림

// 실제로 키를 보내는 부분은 Windows에서만 쓰임
#![cfg_attr(not(windows), allow(dead_code))]

use serde::Serialize;
use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{
    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutEvent, ShortcutState,
};

#[cfg(windows)]
mod win;

/// 화면에 진행을 알리는 이벤트 이름
pub const EVENT: &str = "neis-paste";
/// 준비한 뒤 Ctrl+V를 기다리는 시간
pub const ARM_SECS: u64 = 300;
const MAX_STUDENTS: usize = 200;
const MAX_TEXT: usize = 4000;
pub const MAX_TABS: u32 = 9;
/// 글자 입력 때 한 번에 보내는 글자 수
const CHUNK: usize = 24;
/// 차례로 붙여넣기(에듀파인): 쓰지 않으면 풀리는 시간(붙일 때마다 다시)
pub const QUEUE_SECS: u64 = 900;
/// 품의 산출 내역 칸마다(제목·사유 + 품목마다 5칸)도 품목 40개 넘게 들어가게
const MAX_ITEMS: usize = 250;
const MAX_ITEM: usize = 20000;
/// 나이스를 여는 브라우저 (이 프로그램 창에서 누른 Ctrl+V만 자동으로 넣기 시작)
const BROWSERS: &[&str] = &[
    "chrome.exe",
    "msedge.exe",
    "whale.exe",
    "firefox.exe",
    "iexplore.exe",
    "brave.exe",
    "opera.exe",
    "vivaldi.exe",
];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Key {
    Ctrl,
    A,
    V,
    Tab,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Step {
    /// 클립보드에 글 넣기
    Clip(String),
    /// 키 누르기. 앞 키를 누른 채로 마지막 키 (예: Ctrl+V)
    Press(Vec<Key>),
    /// 글자 입력
    Type(String),
    /// 기다리기 (밀리초)
    Wait(u64),
    /// 이만큼의 학생을 마치고 다음 학생 칸으로 옮겨 감
    Done(usize),
    /// 붙여넣기 키: 보내는 순간 사용자가 Ctrl을 누르고 있으면 V만, 아니면 Ctrl+V (차례로 붙여넣기)
    Paste,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Method {
    /// 글자를 하나씩 입력 (기본)
    Type,
    /// 학생마다 클립보드에 넣고 Ctrl+V
    Paste,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Options {
    /// 다음 학생 칸까지 Tab 누르는 횟수
    pub tabs: u32,
    /// 나이스가 느릴 때 천천히
    pub slow: bool,
    /// 칸에 있던 글을 지우고 넣기 (Ctrl+A 뒤 넣기)
    pub overwrite: bool,
    pub method: Method,
    /// 브라우저가 아닌 창(가상 PC 등)에서 누른 Ctrl+V로도 시작
    pub any_window: bool,
}

struct Timing {
    clip: u64,
    select: u64,
    paste: u64,
    chunk_gap: u64,
    after_text: u64,
    tab_gap: u64,
    after_tabs: u64,
}

fn timing(slow: bool) -> Timing {
    if slow {
        Timing {
            clip: 150,
            select: 150,
            paste: 1500,
            chunk_gap: 40,
            after_text: 600,
            tab_gap: 120,
            after_tabs: 450,
        }
    } else {
        Timing {
            clip: 80,
            select: 70,
            paste: 600,
            chunk_gap: 12,
            after_text: 200,
            tab_gap: 50,
            after_tabs: 160,
        }
    }
}

fn chunks(text: &str, n: usize) -> Vec<String> {
    let chars: Vec<char> = text.chars().collect();
    chars.chunks(n).map(|c| c.iter().collect()).collect()
}

/// 학생별 평어로 할 일 순서 만들기. 빈 평어는 칸을 비워 두고 다음 학생으로 넘어감
pub fn plan(texts: &[String], o: Options) -> Vec<Step> {
    let t = timing(o.slow);
    let mut steps = Vec::new();
    for (i, text) in texts.iter().enumerate() {
        let text = text.trim();
        if !text.is_empty() {
            if o.method == Method::Paste {
                steps.push(Step::Clip(text.to_string()));
                steps.push(Step::Wait(t.clip));
            }
            if o.overwrite {
                steps.push(Step::Press(vec![Key::Ctrl, Key::A]));
                steps.push(Step::Wait(t.select));
            }
            match o.method {
                Method::Paste => {
                    steps.push(Step::Press(vec![Key::Ctrl, Key::V]));
                    steps.push(Step::Wait(t.paste));
                }
                Method::Type => {
                    for (k, c) in chunks(text, CHUNK).into_iter().enumerate() {
                        if k > 0 {
                            steps.push(Step::Wait(t.chunk_gap));
                        }
                        steps.push(Step::Type(c));
                    }
                    steps.push(Step::Wait(t.after_text));
                }
            }
        }
        if i + 1 < texts.len() {
            for k in 0..o.tabs {
                if k > 0 {
                    steps.push(Step::Wait(t.tab_gap));
                }
                steps.push(Step::Press(vec![Key::Tab]));
            }
            steps.push(Step::Wait(t.after_tabs));
        }
        steps.push(Step::Done(i + 1));
    }
    steps
}

/// 키·클립보드를 다루는 쪽 (Windows에서는 실제로 보내고, 시험에서는 기록만 함)
pub trait Io {
    fn set_clip(&mut self, text: &str) -> Result<(), String>;
    fn press(&mut self, keys: &[Key]) -> Result<(), String>;
    fn type_text(&mut self, text: &str) -> Result<(), String>;
    fn wait(&mut self, ms: u64);
    fn foreground(&mut self) -> isize;
    /// 사용자가 키를 누르고 있는지
    fn keys_held(&mut self) -> bool;
    /// 사용자가 Ctrl을 누르고 있는지
    fn ctrl_held(&mut self) -> bool;
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum End {
    /// 모두 마침
    Finished,
    /// Esc(또는 앱의 멈추기)로 멈춤
    Cancelled,
    /// 다른 창으로 옮겨 가서 멈춤
    Focus,
    /// 사용자가 키를 눌러서 멈춤
    Keys,
    Error(String),
}

/// 할 일을 차례로 함. target은 Ctrl+V를 누른 창. 마친 학생 수와 끝난 까닭을 돌려줌
pub fn run(
    steps: &[Step],
    io: &mut dyn Io,
    target: isize,
    cancel: &AtomicBool,
    mut on_done: impl FnMut(usize),
) -> (usize, End) {
    let total = steps.iter().filter(|s| matches!(s, Step::Done(_))).count();
    let mut done = 0;
    if cancel.load(Ordering::SeqCst) {
        return (0, End::Cancelled);
    }
    for step in steps {
        // 키를 보내기 전마다: 다른 창으로 옮겼거나 사용자가 키를 누르고 있으면 바로 멈춤
        // (Ctrl을 누른 채 Tab이 가면 브라우저 탭이 바뀌고, Shift면 거꾸로 감)
        if matches!(step, Step::Press(_) | Step::Type(_) | Step::Paste) {
            if io.foreground() != target {
                return (done, End::Focus);
            }
            if io.keys_held() {
                return (done, End::Keys);
            }
        }
        let r = match step {
            Step::Clip(text) => io.set_clip(text),
            Step::Press(keys) => io.press(keys),
            Step::Paste => {
                let keys: &[Key] = if io.ctrl_held() { &[Key::V] } else { &[Key::Ctrl, Key::V] };
                io.press(keys)
            }
            Step::Type(text) => io.type_text(text),
            Step::Wait(ms) => {
                io.wait(*ms);
                Ok(())
            }
            Step::Done(n) => {
                done = *n;
                on_done(done);
                // 멈추기는 학생 사이에서만 (한 학생을 반쯤 넣고 멈추지 않게)
                if done < total && cancel.load(Ordering::SeqCst) {
                    return (done, End::Cancelled);
                }
                Ok(())
            }
        };
        if let Err(e) = r {
            return (done, End::Error(e));
        }
    }
    (done, End::Finished)
}

/* ---------- 차례로 붙여넣기 (에듀파인 품의·공문 기안, 스펙 2026-11-03 3장) ----------
   Ctrl+V를 누를 때마다 다음 조각을 클립보드에 넣고 그 칸에 붙여 넣음(글 그대로, 여러 줄도) */

/// 한 조각 붙이기: 클립보드에 넣고 붙여넣기 키. Ctrl은 키를 보내는 순간에 봄(계획 때 보면 그사이 뗀 Ctrl 때문에 「v」만 들어감)
pub fn queue_plan(text: &str) -> Vec<Step> {
    vec![
        Step::Clip(text.to_string()),
        Step::Wait(60),
        Step::Paste,
        Step::Wait(150),
    ]
}

/// 할 일을 그대로 함 (붙이는 순간은 사용자가 Ctrl을 누르고 있으므로 키 확인을 하지 않음)
pub fn play(steps: &[Step], io: &mut dyn Io) -> Result<(), String> {
    for step in steps {
        match step {
            Step::Clip(t) => io.set_clip(t)?,
            Step::Press(k) => io.press(k)?,
            Step::Type(t) => io.type_text(t)?,
            Step::Wait(ms) => io.wait(*ms),
            Step::Paste => {
                let keys: &[Key] = if io.ctrl_held() { &[Key::V] } else { &[Key::Ctrl, Key::V] };
                io.press(keys)?
            }
            Step::Done(_) => {}
        }
    }
    Ok(())
}

/// from부터 처음으로 비지 않은 조각
pub fn next_filled(items: &[String], from: usize) -> Option<usize> {
    (from..items.len()).find(|&i| !items[i].trim().is_empty())
}

/// 조각 받기: 줄바꿈은 그대로(Windows 꼴 CRLF로), 너무 길면 자름
fn check_items(items: Vec<String>) -> Result<Vec<String>, String> {
    if items.is_empty() || items.iter().all(|t| t.trim().is_empty()) {
        return Err("붙여넣을 내용이 없어요".to_string());
    }
    if items.len() > MAX_ITEMS {
        return Err(format!("한 번에 {MAX_ITEMS}개까지 차례로 붙여넣을 수 있어요"));
    }
    Ok(items
        .into_iter()
        .map(|t| {
            let t: String = t.chars().take(MAX_ITEM).collect();
            t.replace("\r\n", "\n").replace('\n', "\r\n")
        })
        .collect())
}

/* ---------- 앱과 잇기 ---------- */

struct Queue {
    items: Vec<String>,
    /// 다음에 붙일 조각 번호 (비었으면 그 뒤 첫 조각)
    next: usize,
    any_window: bool,
    gen: u64,
    used: std::time::Instant,
}

struct Job {
    texts: Vec<String>,
    opts: Options,
    gen: u64,
}

#[derive(Default)]
struct Inner {
    armed: Option<Job>,
    /// 차례로 붙여넣기 준비 (나이스 준비와 함께 있지 않음 — Ctrl+V는 하나만 맡음)
    queue: Option<Queue>,
    running: bool,
    gen: u64,
}

/// 준비·붙여넣기 상태. 준비/풀기/시작은 inner 잠금 안에서 한꺼번에 함
/// (단축키 처리기는 앱 메인 스레드에서 불리므로 이 잠금을 쓰지 않음 → 잠금을 쥔 채 단축키를 등록해도 안전)
#[derive(Default)]
pub struct Neis {
    inner: Mutex<Inner>,
    cancel: AtomicBool,
    /// Ctrl+V를 누른 순간 앞에 있던 창
    pressed_in: AtomicIsize,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Progress {
    /// "start" 시작 · "progress" 진행 · "end" 끝 · "expired" 준비 시간이 지남 · "elsewhere" 브라우저가 아닌 창에서 누름
    /// · "queue" 차례로 붙여넣기에서 한 조각을 붙임(done = 붙인 조각 번호 + 1)
    state: &'static str,
    /// 어느 준비에 대한 알림인지 (neis_arm이 돌려준 번호)
    gen: u64,
    done: usize,
    total: usize,
    /// end일 때 끝난 까닭: "finished" · "cancelled" · "focus" · "keys" · "error"
    reason: &'static str,
    message: String,
}

fn emit(app: &AppHandle, state: &'static str, gen: u64, done: usize, total: usize) {
    emit_full(app, state, gen, done, total, "", String::new());
}

fn emit_full(
    app: &AppHandle,
    state: &'static str,
    gen: u64,
    done: usize,
    total: usize,
    reason: &'static str,
    message: String,
) {
    let _ = app.emit(
        EVENT,
        Progress {
            state,
            gen,
            done,
            total,
            reason,
            message,
        },
    );
}

fn paste_key() -> Shortcut {
    Shortcut::new(Some(Modifiers::CONTROL), Code::KeyV)
}

fn esc_key() -> Shortcut {
    Shortcut::new(None, Code::Escape)
}

fn lock<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}

fn set_key(app: &AppHandle, key: Shortcut, on: bool) -> Result<(), String> {
    let gs = app.global_shortcut();
    let has = gs.is_registered(key);
    if on && !has {
        gs.register(key).map_err(|e| e.to_string())
    } else if !on && has {
        gs.unregister(key).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

/// 붙여넣을 학생별 평어 받기 (전 학생 순서대로, 평어가 없으면 빈 글)
fn check_texts(texts: Vec<String>) -> Result<Vec<String>, String> {
    if texts.is_empty() || texts.iter().all(|t| t.trim().is_empty()) {
        return Err("붙여넣을 평어가 없어요".to_string());
    }
    if texts.len() > MAX_STUDENTS {
        return Err(format!("한 번에 {MAX_STUDENTS}명까지 붙여넣을 수 있어요"));
    }
    Ok(texts
        .into_iter()
        .map(|t| {
            // 한 칸에 한 줄로 (줄바꿈·Tab이 있으면 나이스 칸에서 엉뚱하게 나뉘거나 칸이 옮겨 감)
            let one = t.split_whitespace().collect::<Vec<_>>().join(" ");
            one.chars().take(MAX_TEXT).collect()
        })
        .collect())
}

fn parse_method(m: &str) -> Method {
    if m == "paste" {
        Method::Paste
    } else {
        Method::Type
    }
}

pub fn is_browser(exe: &str) -> bool {
    let exe = exe.to_ascii_lowercase();
    BROWSERS.iter().any(|b| *b == exe)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Armed {
    gen: u64,
    secs: u64,
}

/// 준비를 풂 (inner 잠금을 쥔 채로 부름) — 나이스·차례로 붙여넣기 둘 다
fn disarm_locked(app: &AppHandle, inner: &mut Inner) {
    inner.gen += 1;
    inner.armed = None;
    inner.queue = None;
    if !inner.running {
        let _ = set_key(app, paste_key(), false);
    }
}

/// 붙여넣기 준비: Ctrl+V를 이 앱이 맡음
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn neis_arm(
    app: AppHandle,
    texts: Vec<String>,
    tabs: u32,
    slow: bool,
    overwrite: bool,
    method: String,
    any_window: bool,
) -> Result<Armed, String> {
    if !cfg!(windows) {
        return Err("나이스 자동 붙여넣기는 Windows 앱에서만 돼요".to_string());
    }
    let st = app.state::<Neis>();
    let mut inner = lock(&st.inner);
    if inner.running {
        return Err("지금 나이스에 붙여넣고 있어요. 끝난 뒤에 다시 눌러 주세요".to_string());
    }
    // 잘못된 요청이면 예전 준비도 풂 (화면과 어긋난 옛 준비가 남지 않게)
    let texts = match check_texts(texts) {
        Ok(t) => t,
        Err(e) => {
            disarm_locked(&app, &mut inner);
            return Err(e);
        }
    };
    if !(1..=MAX_TABS).contains(&tabs) {
        disarm_locked(&app, &mut inner);
        return Err(format!("Tab 횟수는 1~{MAX_TABS}번으로 정해 주세요"));
    }
    inner.gen += 1;
    let gen = inner.gen;
    inner.queue = None;
    inner.armed = Some(Job {
        texts,
        opts: Options {
            tabs,
            slow,
            overwrite,
            method: parse_method(&method),
            any_window,
        },
        gen,
    });
    if let Err(e) = set_key(&app, paste_key(), true) {
        inner.armed = None;
        return Err(format!(
            "Ctrl+V를 맡지 못했어요. 다른 프로그램이 Ctrl+V 단축키를 쓰고 있을 수 있어요. ({e})"
        ));
    }
    drop(inner);

    // 시간이 지나면 저절로 풀기
    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(ARM_SECS));
        let st = handle.state::<Neis>();
        let mut inner = lock(&st.inner);
        let same = inner.armed.as_ref().map(|j| j.gen) == Some(gen);
        if same && !inner.running {
            disarm_locked(&handle, &mut inner);
            drop(inner);
            emit(&handle, "expired", gen, 0, 0);
        }
    });
    Ok(Armed {
        gen,
        secs: ARM_SECS,
    })
}

/// 붙여넣기 준비 풀기 (붙여넣는 중이면 지금 학생까지 마치고 멈춤). 여러 번 불러도 됨
#[tauri::command]
pub async fn neis_disarm(app: AppHandle) {
    let st = app.state::<Neis>();
    let mut inner = lock(&st.inner);
    if inner.running {
        st.cancel.store(true, Ordering::SeqCst);
    }
    disarm_locked(&app, &mut inner);
}

/// 차례로 붙여넣기 준비: Ctrl+V를 이 앱이 맡고, 누를 때마다 다음 조각을 붙임 (나이스 준비는 풂)
#[tauri::command]
pub async fn queue_arm(
    app: AppHandle,
    items: Vec<String>,
    start: usize,
    any_window: bool,
) -> Result<Armed, String> {
    if !cfg!(windows) {
        return Err("차례로 붙여넣기는 Windows 앱에서만 돼요".to_string());
    }
    let st = app.state::<Neis>();
    let mut inner = lock(&st.inner);
    if inner.running {
        return Err("지금 붙여넣고 있어요. 끝난 뒤에 다시 눌러 주세요".to_string());
    }
    let items = match check_items(items) {
        Ok(t) => t,
        Err(e) => {
            disarm_locked(&app, &mut inner);
            return Err(e);
        }
    };
    inner.gen += 1;
    let gen = inner.gen;
    inner.armed = None;
    inner.queue = Some(Queue {
        next: start.min(items.len()),
        items,
        any_window,
        gen,
        used: std::time::Instant::now(),
    });
    if let Err(e) = set_key(&app, paste_key(), true) {
        inner.queue = None;
        return Err(format!(
            "Ctrl+V를 맡지 못했어요. 다른 프로그램이 Ctrl+V 단축키를 쓰고 있을 수 있어요. ({e})"
        ));
    }
    drop(inner);

    // 쓰지 않은 채 QUEUE_SECS가 지나면 풀기 (붙일 때마다 다시 셈)
    let handle = app.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(30));
        let st = handle.state::<Neis>();
        let mut inner = lock(&st.inner);
        let Some(q) = inner.queue.as_ref().filter(|q| q.gen == gen) else { return };
        if !inner.running && q.used.elapsed() >= Duration::from_secs(QUEUE_SECS) {
            disarm_locked(&handle, &mut inner);
            drop(inner);
            emit(&handle, "expired", gen, 0, 0);
            return;
        }
    });
    Ok(Armed {
        gen,
        secs: QUEUE_SECS,
    })
}

/// 차례로 붙여넣기의 다음 조각 바꾸기 (앞으로·건너뛰기·목록에서 고르기). 준비가 없으면 아무것도 안 함
#[tauri::command]
pub async fn queue_goto(app: AppHandle, gen: u64, index: usize) -> Result<(), String> {
    let st = app.state::<Neis>();
    let mut inner = lock(&st.inner);
    match inner.queue.as_mut().filter(|q| q.gen == gen) {
        Some(q) => {
            q.next = index.min(q.items.len());
            q.used = std::time::Instant::now();
            Ok(())
        }
        None => Err("차례로 붙여넣기 준비가 풀렸어요. 다시 준비해 주세요".to_string()),
    }
}

/// 전역 단축키가 눌렸을 때 (앱 메인 스레드에서 불림 → 잠금을 쓰지 않고, 오래 걸리는 일은 따로)
pub fn on_shortcut(app: &AppHandle, shortcut: &Shortcut, event: ShortcutEvent) {
    if event.state != ShortcutState::Pressed {
        return;
    }
    let st = app.state::<Neis>();
    if *shortcut == esc_key() {
        // 붙여넣는 동안에만 등록되어 있음. 시작할 때 다시 false로 바꿈
        st.cancel.store(true, Ordering::SeqCst);
    } else if *shortcut == paste_key() {
        // 누른 순간의 창을 기억 (붙여넣는 동안 이 창에서 벗어나면 멈춤)
        #[cfg(windows)]
        st.pressed_in.store(win::foreground(), Ordering::SeqCst);
        let app = app.clone();
        std::thread::spawn(move || on_paste(&app));
    }
}

#[cfg(windows)]
fn window_info(hwnd: isize) -> (bool, String) {
    (win::is_own_window(hwnd), win::window_exe(hwnd))
}

#[cfg(not(windows))]
fn window_info(_hwnd: isize) -> (bool, String) {
    (false, String::new())
}

fn on_paste(app: &AppHandle) {
    let st = app.state::<Neis>();
    let target = st.pressed_in.load(Ordering::SeqCst);
    let (own, exe) = window_info(target);
    if lock(&st.inner).queue.is_some() {
        queue_paste(app, own, exe);
        return;
    }
    let job = {
        let mut inner = lock(&st.inner);
        if inner.running {
            // 붙여넣는 동안 누른 Ctrl+V는 무시 (나이스 칸에 반 전체 글이 들어가지 않게)
            return;
        }
        let start = match inner.armed.as_ref() {
            None => false,
            Some(_) if own => false,
            Some(j) => j.opts.any_window || is_browser(&exe),
        };
        if start {
            inner.running = true;
            st.cancel.store(false, Ordering::SeqCst);
            inner.armed.take()
        } else {
            let elsewhere = inner.armed.as_ref().filter(|_| !own).map(|j| j.gen);
            drop(inner);
            pass_through(app);
            if let Some(gen) = elsewhere {
                emit_full(app, "elsewhere", gen, 0, 0, "", exe);
            }
            return;
        }
    };
    let Some(job) = job else { return };
    let _ = set_key(app, esc_key(), true);

    let total = job.texts.len();
    emit(app, "start", job.gen, 0, total);
    let (done, end) = run_job(app, &job, target, &st.cancel);

    let _ = set_key(app, esc_key(), false);
    {
        let mut inner = lock(&st.inner);
        inner.running = false;
        if inner.armed.is_none() && inner.queue.is_none() {
            let _ = set_key(app, paste_key(), false);
        }
    }
    let (reason, message) = match end {
        End::Finished => ("finished", String::new()),
        End::Cancelled => ("cancelled", String::new()),
        End::Focus => ("focus", String::new()),
        End::Keys => ("keys", String::new()),
        End::Error(e) => ("error", e),
    };
    emit_full(app, "end", job.gen, done, total, reason, message);
}

/// 차례로 붙여넣기: 브라우저(또는 고른 창)에서 누른 Ctrl+V → 다음 조각을 붙이고 그다음으로
fn queue_paste(app: &AppHandle, own: bool, exe: String) {
    let st = app.state::<Neis>();
    let picked = {
        let mut inner = lock(&st.inner);
        if inner.running {
            return;
        }
        let Some(q) = inner.queue.as_mut() else { return };
        if own || !(q.any_window || is_browser(&exe)) {
            let gen = (!own).then_some(q.gen);
            drop(inner);
            pass_through(app);
            if let Some(gen) = gen {
                emit_full(app, "elsewhere", gen, 0, 0, "", exe);
            }
            return;
        }
        match next_filled(&q.items, q.next) {
            Some(i) => {
                inner.running = true;
                let q = inner.queue.as_ref().expect("queue");
                Some((i, q.items[i].clone(), q.gen, q.items.len()))
            }
            None => None,
        }
    };
    let Some((i, text, gen, total)) = picked else {
        // 남은 조각이 없음 → 평소처럼 붙여넣기
        pass_through(app);
        return;
    };
    // 앱이 보내는 Ctrl+V가 그 칸에 가도록 맡아 둔 Ctrl+V를 잠깐 내려놓음
    let _ = set_key(app, paste_key(), false);
    let r = paste_item(&text);
    let mut inner = lock(&st.inner);
    inner.running = false;
    let same = inner.queue.as_ref().map(|q| q.gen) == Some(gen);
    if let Err(e) = r {
        // 붙이지 못했으면 준비를 풂(화면에서 [다시 준비])
        if same {
            inner.queue = None;
        }
        drop(inner);
        emit_full(app, "end", gen, i, total, "error", e);
        return;
    }
    if !same {
        // 그새 풀었으면 다시 맡지 않음
        drop(inner);
        return;
    }
    let q = inner.queue.as_mut().expect("queue");
    q.next = i + 1;
    q.used = std::time::Instant::now();
    if next_filled(&q.items, q.next).is_none() {
        inner.queue = None;
        drop(inner);
        emit_full(app, "end", gen, total, total, "finished", String::new());
    } else {
        let _ = set_key(app, paste_key(), true);
        drop(inner);
        emit(app, "queue", gen, i + 1, total);
    }
}

#[cfg(windows)]
fn paste_item(text: &str) -> Result<(), String> {
    let mut io = win::WinIo::default();
    play(&queue_plan(text), &mut io)
}

#[cfg(not(windows))]
fn paste_item(_text: &str) -> Result<(), String> {
    Err("차례로 붙여넣기는 Windows 앱에서만 돼요".to_string())
}

/// 준비가 안 된 때, 이 앱 창이나 브라우저가 아닌 창에서 누른 Ctrl+V는 평소처럼 붙여넣기
fn pass_through(app: &AppHandle) {
    let _ = set_key(app, paste_key(), false);
    #[cfg(windows)]
    {
        let keys: &[Key] = if win::ctrl_held() {
            &[Key::V]
        } else {
            &[Key::Ctrl, Key::V]
        };
        let _ = win::press(keys);
    }
    std::thread::sleep(Duration::from_millis(80));
    // 그새 준비가 풀리지 않았으면 다시 Ctrl+V를 맡음 (잠금 안에서 확인해 풀기와 엇갈리지 않게)
    let st = app.state::<Neis>();
    let inner = lock(&st.inner);
    if (inner.armed.is_some() || inner.queue.is_some()) && !inner.running {
        let _ = set_key(app, paste_key(), true);
    }
}

#[cfg(windows)]
fn run_job(app: &AppHandle, job: &Job, target: isize, cancel: &AtomicBool) -> (usize, End) {
    // 사용자가 Ctrl+V에서 손을 뗄 때까지 기다림 (Ctrl을 누른 채 Tab이 가면 브라우저 탭이 바뀜)
    let mut waited = 0;
    while win::keys_held() {
        if waited >= 5000 {
            return (
                0,
                End::Error(
                    "Ctrl·V 키에서 손을 떼지 않아 시작하지 못했어요. 다시 준비해 주세요"
                        .to_string(),
                ),
            );
        }
        std::thread::sleep(Duration::from_millis(20));
        waited += 20;
    }
    std::thread::sleep(Duration::from_millis(80));
    // 붙여넣기 방식은 앱이 Ctrl+V를 보내야 하므로 맡아 둔 Ctrl+V를 내려놓음.
    // 글자 입력 방식은 끝날 때까지 맡아 두어, 그사이 누른 Ctrl+V가 나이스 칸에 반 전체 글을 넣지 않게 함
    if job.opts.method == Method::Paste {
        let _ = set_key(app, paste_key(), false);
    }

    let mut io = win::WinIo::default();
    let steps = plan(&job.texts, job.opts);
    let total = job.texts.len();
    let gen = job.gen;
    // 붙여넣기 방식에서도 클립보드를 되돌리지 않음: 브라우저가 늦게 읽어도 마지막 학생 글이 들어가게
    run(&steps, &mut io, target, cancel, |n| {
        emit(app, "progress", gen, n, total);
    })
}

#[cfg(not(windows))]
fn run_job(_app: &AppHandle, _job: &Job, _target: isize, _cancel: &AtomicBool) -> (usize, End) {
    (
        0,
        End::Error("나이스 자동 붙여넣기는 Windows 앱에서만 돼요".to_string()),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn s(v: &[&str]) -> Vec<String> {
        v.iter().map(|x| x.to_string()).collect()
    }

    const TYPE: Options = Options {
        tabs: 3,
        slow: false,
        overwrite: false,
        method: Method::Type,
        any_window: false,
    };
    const PASTE: Options = Options {
        method: Method::Paste,
        ..TYPE
    };

    #[derive(Default)]
    struct Fake {
        log: Vec<String>,
        clip: String,
        typing: String,
        /// 이 횟수만큼 보낸 뒤 앞 창이 바뀜
        switch_after: Option<usize>,
        /// 이 횟수만큼 보낸 뒤 사용자가 키를 누름
        hold_after: Option<usize>,
        /// 사용자가 Ctrl을 누르고 있음
        ctrl: bool,
        sent: usize,
        fail_clip: bool,
    }

    impl Fake {
        fn flush(&mut self) {
            if !self.typing.is_empty() {
                let t = std::mem::take(&mut self.typing);
                self.log.push(format!("type:{t}"));
            }
        }
    }

    impl Io for Fake {
        fn set_clip(&mut self, text: &str) -> Result<(), String> {
            if self.fail_clip {
                return Err("busy".into());
            }
            self.clip = text.to_string();
            Ok(())
        }
        fn press(&mut self, keys: &[Key]) -> Result<(), String> {
            self.flush();
            self.sent += 1;
            let k: Vec<&str> = keys
                .iter()
                .map(|k| match k {
                    Key::Ctrl => "Ctrl",
                    Key::A => "A",
                    Key::V => "V",
                    Key::Tab => "Tab",
                })
                .collect();
            let k = k.join("+");
            if k == "Ctrl+V" {
                self.log.push(format!("paste:{}", self.clip));
            } else {
                self.log.push(k);
            }
            Ok(())
        }
        fn type_text(&mut self, text: &str) -> Result<(), String> {
            self.sent += 1;
            self.typing.push_str(text);
            Ok(())
        }
        fn wait(&mut self, _ms: u64) {}
        fn foreground(&mut self) -> isize {
            match self.switch_after {
                Some(n) if self.sent >= n => 2,
                _ => 1,
            }
        }
        fn keys_held(&mut self) -> bool {
            matches!(self.hold_after, Some(n) if self.sent >= n)
        }
        fn ctrl_held(&mut self) -> bool {
            self.ctrl
        }
    }

    fn go(steps: &[Step], io: &mut Fake, cancel: &AtomicBool) -> (usize, End) {
        let r = run(steps, io, 1, cancel, |_| {});
        io.flush();
        r
    }

    #[test]
    fn typing_puts_text_then_tabs_to_next_student() {
        let long = "가".repeat(60);
        let steps = plan(&s(&[&long, "나", "다"]), TYPE);
        let mut io = Fake::default();
        let cancel = AtomicBool::new(false);
        let mut seen = vec![];
        let (done, end) = run(&steps, &mut io, 1, &cancel, |n| seen.push(n));
        io.flush();
        assert_eq!((done, end), (3, End::Finished));
        assert_eq!(seen, vec![1, 2, 3]);
        let first = format!("type:{long}");
        assert_eq!(
            io.log,
            vec![
                first.as_str(),
                "Tab",
                "Tab",
                "Tab",
                "type:나",
                "Tab",
                "Tab",
                "Tab",
                "type:다"
            ]
        );
        // 긴 글은 나눠서 보냄
        let parts = steps
            .iter()
            .filter(|s| matches!(s, Step::Type(t) if t.starts_with('가')))
            .count();
        assert_eq!(parts, 3);
        assert!(io.clip.is_empty(), "글자 입력은 클립보드를 쓰지 않음");
    }

    #[test]
    fn paste_method_uses_clipboard_per_student() {
        let steps = plan(&s(&["가", "나"]), PASTE);
        let mut io = Fake::default();
        let (done, end) = go(&steps, &mut io, &AtomicBool::new(false));
        assert_eq!((done, end), (2, End::Finished));
        assert_eq!(io.log, vec!["paste:가", "Tab", "Tab", "Tab", "paste:나"]);
    }

    #[test]
    fn empty_student_is_skipped_but_still_moves_on() {
        let steps = plan(&s(&["가", "  ", "다"]), Options { tabs: 2, ..TYPE });
        let mut io = Fake::default();
        let (done, end) = go(&steps, &mut io, &AtomicBool::new(false));
        assert_eq!((done, end), (3, End::Finished));
        assert_eq!(
            io.log,
            vec!["type:가", "Tab", "Tab", "Tab", "Tab", "type:다"]
        );
    }

    #[test]
    fn overwrite_selects_field_first() {
        for (o, want) in [(TYPE, "type:가"), (PASTE, "paste:가")] {
            let steps = plan(
                &s(&["가"]),
                Options {
                    overwrite: true,
                    ..o
                },
            );
            let mut io = Fake::default();
            go(&steps, &mut io, &AtomicBool::new(false));
            assert_eq!(io.log, vec!["Ctrl+A", want]);
        }
    }

    #[test]
    fn slow_waits_longer() {
        for o in [TYPE, PASTE] {
            let total = |o: Options| -> u64 {
                plan(&s(&["가", "나"]), o)
                    .iter()
                    .map(|s| if let Step::Wait(ms) = s { *ms } else { 0 })
                    .sum()
            };
            assert!(total(Options { slow: true, ..o }) > total(o) * 2);
        }
    }

    #[test]
    fn cancel_stops_between_students() {
        let steps = plan(&s(&["가", "나", "다"]), TYPE);
        let mut io = Fake::default();
        let cancel = AtomicBool::new(false);
        let (done, end) = run(&steps, &mut io, 1, &cancel, |n| {
            if n == 1 {
                cancel.store(true, Ordering::SeqCst);
            }
        });
        io.flush();
        assert_eq!((done, end), (1, End::Cancelled));
        // 1번을 넣고 2번 칸으로 옮겨 간 뒤 멈춤
        assert_eq!(io.log, vec!["type:가", "Tab", "Tab", "Tab"]);
    }

    #[test]
    fn cancel_on_last_student_still_counts_as_finished() {
        let steps = plan(&s(&["가"]), TYPE);
        let cancel = AtomicBool::new(false);
        let (done, end) = run(&steps, &mut Fake::default(), 1, &cancel, |_| {
            cancel.store(true, Ordering::SeqCst)
        });
        assert_eq!((done, end), (1, End::Finished));
    }

    #[test]
    fn already_cancelled_does_nothing() {
        let steps = plan(&s(&["가"]), TYPE);
        let mut io = Fake::default();
        assert_eq!(
            go(&steps, &mut io, &AtomicBool::new(true)),
            (0, End::Cancelled)
        );
        assert!(io.log.is_empty());
    }

    #[test]
    fn switching_window_stops_right_away() {
        let steps = plan(&s(&["가", "나", "다"]), TYPE);
        let mut io = Fake {
            switch_after: Some(5),
            ..Default::default()
        };
        let (done, end) = go(&steps, &mut io, &AtomicBool::new(false));
        assert_eq!((done, end), (1, End::Focus));
        assert_eq!(io.log, vec!["type:가", "Tab", "Tab", "Tab", "type:나"]);
    }

    #[test]
    fn window_other_than_the_pressed_one_never_gets_keys() {
        let steps = plan(&s(&["가"]), TYPE);
        let mut io = Fake::default();
        // Ctrl+V를 누른 창(7)이 지금 앞 창(1)과 다르면 아무것도 보내지 않음
        let (done, end) = run(&steps, &mut io, 7, &AtomicBool::new(false), |_| {});
        assert_eq!((done, end), (0, End::Focus));
        assert_eq!(io.sent, 0);
    }

    #[test]
    fn user_pressing_keys_stops_right_away() {
        let steps = plan(&s(&["가", "나"]), TYPE);
        let mut io = Fake {
            hold_after: Some(2),
            ..Default::default()
        };
        let (done, end) = go(&steps, &mut io, &AtomicBool::new(false));
        assert_eq!((done, end), (0, End::Keys));
        assert_eq!(io.log, vec!["type:가", "Tab"]);
    }

    #[test]
    fn clipboard_error_stops() {
        let steps = plan(&s(&["가"]), PASTE);
        let mut io = Fake {
            fail_clip: true,
            ..Default::default()
        };
        let (done, end) = go(&steps, &mut io, &AtomicBool::new(false));
        assert_eq!((done, end), (0, End::Error("busy".into())));
        assert!(io.log.is_empty());
    }

    #[test]
    fn texts_are_checked_and_made_one_line() {
        assert!(check_texts(vec![]).is_err());
        assert!(check_texts(s(&["", " "])).is_err());
        assert!(check_texts(vec!["가".into(); MAX_STUDENTS + 1]).is_err());
        assert_eq!(
            check_texts(s(&["가\n나\t다", ""])).unwrap(),
            s(&["가 나 다", ""])
        );
    }

    #[test]
    fn queue_plan_puts_item_in_clipboard_then_pastes_once() {
        let mut io = Fake::default();
        play(&queue_plan("제목"), &mut io).unwrap();
        assert_eq!(io.log, vec!["paste:제목"]);
        // 보내는 순간에도 사용자가 Ctrl을 누르고 있으면 V만 보냄 (Ctrl+V가 두 번 되지 않게)
        let mut io = Fake {
            ctrl: true,
            ..Default::default()
        };
        play(&queue_plan("사유"), &mut io).unwrap();
        assert_eq!(io.clip, "사유");
        assert_eq!(io.log, vec!["V"]);
    }

    #[test]
    fn queue_checks_ctrl_when_pressing_not_when_planning() {
        // 계획을 만들 때는 Ctrl을 누르고 있었어도, 키를 보내기 전에 떼었으면 Ctrl+V를 보냄
        // (V만 보내면 칸에 「v」·「ㅍ」가 들어가고 그 조각은 넣은 것으로 넘어감)
        let steps = queue_plan("본문");
        let mut io = Fake {
            ctrl: false,
            ..Default::default()
        };
        play(&steps, &mut io).unwrap();
        assert_eq!(io.log, vec!["paste:본문"]);
    }

    #[test]
    fn queue_has_room_for_many_purchase_items() {
        // 품의 칸마다: 제목·사유 + 품목마다 5칸 → 품목 40개까지
        assert!(MAX_ITEMS >= 2 + 5 * 40);
        assert!(check_items(vec!["가".into(); 2 + 5 * 40]).is_ok());
    }

    #[test]
    fn queue_skips_empty_items() {
        let items = s(&["가", "", "  ", "라"]);
        assert_eq!(next_filled(&items, 0), Some(0));
        assert_eq!(next_filled(&items, 1), Some(3));
        assert_eq!(next_filled(&items, 4), None);
        assert_eq!(next_filled(&items, 9), None);
    }

    #[test]
    fn queue_items_are_checked_and_keep_lines() {
        assert!(check_items(vec![]).is_err());
        assert!(check_items(s(&["", " "])).is_err());
        assert!(check_items(vec!["가".into(); MAX_ITEMS + 1]).is_err());
        // 여러 줄은 그대로(Windows 줄바꿈으로), 너무 길면 자름
        assert_eq!(check_items(s(&["가\n나", ""])).unwrap(), s(&["가\r\n나", ""]));
        assert_eq!(check_items(s(&["가\r\n나"])).unwrap(), s(&["가\r\n나"]));
        assert_eq!(check_items(vec!["가".repeat(MAX_ITEM + 5)]).unwrap()[0].chars().count(), MAX_ITEM);
    }

    #[test]
    fn queue_play_stops_on_clipboard_error() {
        let mut io = Fake {
            fail_clip: true,
            ..Default::default()
        };
        assert!(play(&queue_plan("가"), &mut io).is_err());
        assert!(io.log.is_empty());
    }

    #[test]
    fn browsers_are_recognized() {
        assert!(is_browser("chrome.exe"));
        assert!(is_browser("MSEdge.EXE"));
        assert!(is_browser("whale.exe"));
        assert!(!is_browser("Hwp.exe"));
        assert!(!is_browser("KakaoTalk.exe"));
        assert!(!is_browser(""));
        assert_eq!(parse_method("paste"), Method::Paste);
        assert_eq!(parse_method("type"), Method::Type);
        assert_eq!(parse_method(""), Method::Type);
    }
}
