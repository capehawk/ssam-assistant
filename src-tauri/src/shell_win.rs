//! 쪽지 붙임 파일을 탐색기와 똑같이 다루기 (Windows)
//! - 복사: 탐색기에서 Ctrl+C 한 것과 같은 쉘 데이터 개체 + 「Preferred DropEffect = 복사」를 클립보드에
//! - 끌기: 탐색기에서 파일을 끄는 것과 같은 쉘 데이터 개체로 DoDragDrop (앱 메인 스레드에서)
//! 이음 쪽지 창이 무엇을 받는지 몰라, 탐색기가 주는 것을 그대로 줌 (스펙 2026-11-03 4장)

use std::os::windows::ffi::OsStrExt;
use std::path::Path;
use std::sync::Once;
use windows::core::{implement, w, BOOL, HRESULT, PCWSTR};
use windows::Win32::Foundation::{DRAGDROP_S_CANCEL, DRAGDROP_S_DROP, DRAGDROP_S_USEDEFAULTCURSORS, S_OK};
use windows::Win32::System::Com::{IDataObject, DVASPECT_CONTENT, FORMATETC, STGMEDIUM, STGMEDIUM_0, TYMED_HGLOBAL};
use windows::Win32::System::DataExchange::RegisterClipboardFormatW;
use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};
use windows::Win32::System::Ole::{
    DoDragDrop, IDropSource, IDropSource_Impl, OleFlushClipboard, OleInitialize, OleSetClipboard, OleUninitialize,
    DROPEFFECT, DROPEFFECT_COPY,
};
use windows::Win32::System::SystemServices::{MK_LBUTTON, MODIFIERKEYS_FLAGS};
use windows::Win32::UI::Shell::Common::ITEMIDLIST;
use windows::Win32::UI::Shell::{BHID_DataObject, ILCreateFromPathW, ILFree, SHCreateShellItemArrayFromIDLists};

fn wide(p: &Path) -> Vec<u16> {
    p.as_os_str().encode_wide().chain(std::iter::once(0)).collect()
}

/// 파일들 → 탐색기의 쉘 데이터 개체 (그 스레드에서 OLE를 켠 뒤 부름)
fn shell_data(paths: &[String]) -> Result<IDataObject, String> {
    let mut ids: Vec<*mut ITEMIDLIST> = Vec::new();
    for p in paths {
        let w = wide(Path::new(p));
        let id = unsafe { ILCreateFromPathW(PCWSTR::from_raw(w.as_ptr())) };
        if id.is_null() {
            for id in ids {
                unsafe { ILFree(Some(id)) };
            }
            return Err(format!("파일을 찾지 못했어요: {p}"));
        }
        ids.push(id);
    }
    let list: Vec<*const ITEMIDLIST> = ids.iter().map(|p| p.cast_const()).collect();
    let r = unsafe { SHCreateShellItemArrayFromIDLists(&list) }
        .and_then(|a| unsafe { a.BindToHandler::<_, IDataObject>(None, &BHID_DataObject) });
    for id in ids {
        unsafe { ILFree(Some(id)) };
    }
    r.map_err(|e| format!("파일을 준비하지 못했어요: {e}"))
}

/// 「Preferred DropEffect = 복사」 (탐색기 Ctrl+C와 같게, 붙여 넣는 쪽이 옮기지 않고 복사하게)
fn mark_copy(data: &IDataObject) -> Result<(), String> {
    let cf = unsafe { RegisterClipboardFormatW(w!("Preferred DropEffect")) };
    if cf == 0 {
        return Err("클립보드 형식을 만들지 못했어요".into());
    }
    let mem = unsafe { GlobalAlloc(GMEM_MOVEABLE, 4) }.map_err(|e| e.to_string())?;
    unsafe {
        let p = GlobalLock(mem) as *mut u32;
        if p.is_null() {
            return Err("메모리를 잡지 못했어요".into());
        }
        *p = DROPEFFECT_COPY.0;
        let _ = GlobalUnlock(mem);
    }
    let fmt = FORMATETC { cfFormat: cf as u16, ptd: std::ptr::null_mut(), dwAspect: DVASPECT_CONTENT.0, lindex: -1, tymed: TYMED_HGLOBAL.0 as u32 };
    let med = STGMEDIUM { tymed: TYMED_HGLOBAL.0 as u32, u: STGMEDIUM_0 { hGlobal: mem }, pUnkForRelease: std::mem::ManuallyDrop::new(None) };
    // true: 데이터 개체가 메모리를 맡음
    unsafe { data.SetData(&fmt, &med, true) }.map_err(|e| format!("클립보드에 넣지 못했어요: {e}"))
}

/// 파일들을 클립보드에 (탐색기 Ctrl+C와 같게). 따로 스레드에서 OLE를 켜고, 앱을 꺼도 남게 Flush
pub fn copy_files(paths: Vec<String>) -> Result<(), String> {
    std::thread::spawn(move || -> Result<(), String> {
        unsafe { OleInitialize(None) }.map_err(|e| format!("클립보드를 열지 못했어요: {e}"))?;
        let r = (|| {
            let data = shell_data(&paths)?;
            mark_copy(&data)?;
            unsafe { OleSetClipboard(&data) }.map_err(|e| format!("클립보드에 넣지 못했어요: {e}"))?;
            unsafe { OleFlushClipboard() }.map_err(|e| format!("클립보드에 넣지 못했어요: {e}"))
        })();
        unsafe { OleUninitialize() };
        r
    })
    .join()
    .unwrap_or_else(|_| Err("클립보드에 넣지 못했어요".into()))
}

#[implement(IDropSource)]
struct DropSource;

impl IDropSource_Impl for DropSource_Impl {
    fn QueryContinueDrag(&self, escape: BOOL, keys: MODIFIERKEYS_FLAGS) -> HRESULT {
        if escape.as_bool() {
            DRAGDROP_S_CANCEL
        } else if (keys & MK_LBUTTON) == MODIFIERKEYS_FLAGS(0) {
            DRAGDROP_S_DROP
        } else {
            S_OK
        }
    }
    fn GiveFeedback(&self, _effect: DROPEFFECT) -> HRESULT {
        DRAGDROP_S_USEDEFAULTCURSORS
    }
}

static OLE: Once = Once::new();

/// 파일 끌기 (앱 메인 스레드에서 부름 — 마우스 단추를 뗄 때까지 돌아오지 않음). 놓았으면 true
pub fn drag_files(paths: &[String]) -> Result<bool, String> {
    // 메인 스레드는 창 틀이 이미 OLE를 켰을 수 있음(그래도 한 번 더 켜도 됨)
    OLE.call_once(|| {
        let _ = unsafe { OleInitialize(None) };
    });
    let data = shell_data(paths)?;
    let source: IDropSource = DropSource.into();
    let mut effect = DROPEFFECT::default();
    let r = unsafe { DoDragDrop(&data, &source, DROPEFFECT_COPY, &mut effect) };
    Ok(r == DRAGDROP_S_DROP)
}
