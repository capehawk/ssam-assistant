//! 나이스 자동 붙여넣기 · Windows 쪽 (키 보내기, 글자 입력, 클립보드, 앞에 있는 창)
//! 다른 프로그램을 실행하지 않고 Windows 기본 기능(SendInput)만 씀

use super::{Io, Key};
use arboard::SetExtWindows;
use windows_sys::Win32::Foundation::{CloseHandle, HWND};
use windows_sys::Win32::System::Threading::{
    GetCurrentProcessId, OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
    PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, MapVirtualKeyW, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT,
    KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP, KEYEVENTF_UNICODE, MAPVK_VK_TO_VSC, VIRTUAL_KEY, VK_A,
    VK_CONTROL, VK_LWIN, VK_MENU, VK_RWIN, VK_SHIFT, VK_TAB, VK_V,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

fn vk(k: Key) -> VIRTUAL_KEY {
    match k {
        Key::Ctrl => VK_CONTROL,
        Key::A => VK_A,
        Key::V => VK_V,
        Key::Tab => VK_TAB,
    }
}

fn input(vk: VIRTUAL_KEY, scan: u16, flags: KEYBD_EVENT_FLAGS) -> INPUT {
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: vk,
                wScan: scan,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}

fn key_input(vk: VIRTUAL_KEY, up: bool) -> INPUT {
    // 가상 PC·원격 화면 프로그램도 알아듣도록 스캔 코드를 함께 보냄
    let scan = unsafe { MapVirtualKeyW(vk as u32, MAPVK_VK_TO_VSC) } as u16;
    input(vk, scan, if up { KEYEVENTF_KEYUP } else { 0 })
}

fn send(v: &[INPUT]) -> Result<(), String> {
    if v.is_empty() {
        return Ok(());
    }
    let sent = unsafe {
        SendInput(
            v.len() as u32,
            v.as_ptr(),
            std::mem::size_of::<INPUT>() as i32,
        )
    };
    if sent as usize == v.len() {
        Ok(())
    } else {
        Err("키를 보내지 못했어요. 다른 프로그램이 키 입력을 막고 있을 수 있어요.".to_string())
    }
}

/// 키를 앞에서부터 누르고 거꾸로 뗌 (예: Ctrl 누름 → V 누름 → V 뗌 → Ctrl 뗌)
pub fn press(keys: &[Key]) -> Result<(), String> {
    let mut v: Vec<INPUT> = keys.iter().map(|&k| key_input(vk(k), false)).collect();
    v.extend(keys.iter().rev().map(|&k| key_input(vk(k), true)));
    send(&v)
}

/// 글자를 하나씩 입력 (클립보드를 쓰지 않음. 키보드 입력 차례대로 처리되므로 학생끼리 섞이지 않음)
pub fn type_text(text: &str) -> Result<(), String> {
    let mut v = Vec::with_capacity(text.len() * 4);
    for unit in text.encode_utf16() {
        v.push(input(0, unit, KEYEVENTF_UNICODE));
        v.push(input(0, unit, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP));
    }
    send(&v)
}

fn is_down(vk: VIRTUAL_KEY) -> bool {
    (unsafe { GetAsyncKeyState(vk as i32) } as u16) & 0x8000 != 0
}

/// 사용자가 Ctrl·Shift·Alt·Windows·V 키를 누르고 있는지
pub fn keys_held() -> bool {
    [VK_CONTROL, VK_SHIFT, VK_MENU, VK_LWIN, VK_RWIN, VK_V]
        .into_iter()
        .any(is_down)
}

/// Ctrl을 누르고 있는지
pub fn ctrl_held() -> bool {
    is_down(VK_CONTROL)
}

/// 지금 앞에 있는 창
pub fn foreground() -> isize {
    unsafe { GetForegroundWindow() as isize }
}

fn window_pid(hwnd: isize) -> u32 {
    let mut pid = 0u32;
    unsafe { GetWindowThreadProcessId(hwnd as HWND, &mut pid) };
    pid
}

/// 이 창이 이 앱(쌤비서)의 창인지
pub fn is_own_window(hwnd: isize) -> bool {
    hwnd != 0 && window_pid(hwnd) == unsafe { GetCurrentProcessId() }
}

/// 이 창을 띄운 프로그램 파일 이름 (예: chrome.exe). 알 수 없으면 빈 글
pub fn window_exe(hwnd: isize) -> String {
    let pid = window_pid(hwnd);
    if pid == 0 {
        return String::new();
    }
    unsafe {
        let h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if h.is_null() {
            return String::new();
        }
        let mut buf = [0u16; 1024];
        let mut len = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(h, PROCESS_NAME_WIN32, buf.as_mut_ptr(), &mut len);
        CloseHandle(h);
        if ok == 0 {
            return String::new();
        }
        let path = String::from_utf16_lossy(&buf[..len as usize]);
        path.rsplit(['\\', '/']).next().unwrap_or("").to_string()
    }
}

/// 클립보드는 붙여넣기 방식일 때만 엶
#[derive(Default)]
pub struct WinIo {
    clip: Option<arboard::Clipboard>,
}

impl Io for WinIo {
    fn set_clip(&mut self, text: &str) -> Result<(), String> {
        if self.clip.is_none() {
            self.clip = Some(
                arboard::Clipboard::new().map_err(|e| format!("클립보드를 열지 못했어요: {e}"))?,
            );
        }
        let clip = self.clip.as_mut().expect("clipboard");
        // 학생마다 바뀌는 글이 클립보드 기록(Win+V)에 쌓이지 않게 함
        let mut last = String::new();
        for _ in 0..5 {
            match clip
                .set()
                .exclude_from_history()
                .exclude_from_cloud()
                .text(text)
            {
                Ok(()) => return Ok(()),
                Err(e) => {
                    last = e.to_string();
                    std::thread::sleep(std::time::Duration::from_millis(80));
                }
            }
        }
        Err(format!("클립보드에 넣지 못했어요: {last}"))
    }

    fn press(&mut self, keys: &[Key]) -> Result<(), String> {
        press(keys)
    }

    fn type_text(&mut self, text: &str) -> Result<(), String> {
        type_text(text)
    }

    fn wait(&mut self, ms: u64) {
        std::thread::sleep(std::time::Duration::from_millis(ms));
    }

    fn foreground(&mut self) -> isize {
        foreground()
    }

    fn keys_held(&mut self) -> bool {
        keys_held()
    }

    fn ctrl_held(&mut self) -> bool {
        ctrl_held()
    }
}
