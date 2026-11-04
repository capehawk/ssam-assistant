//! 시험용 업스테이지 키 (써 보는 선생님용, 2027. 3. 31.까지).
//! 키는 저장소에 없고, 릴리즈 빌드 때 GitHub 비밀값 UPSTAGE_TEST_KEY를 build.rs가 섞어서(XOR) 넣음.
//! 웹 쪽은 키를 모르고 표시(MARK)만 보냄 → ai_proxy가 업스테이지 주소일 때만 진짜 키로 바꿈.
//! 기한이 지나면 쓰지 않음(그 뒤 빌드에는 아예 넣지 않음), 하루 DAILY번까지(앱을 켠 동안 셈).

use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

pub const MARK: &str = "ssam-test-upstage";
pub const UNTIL_TEXT: &str = "2027-03-31";
/// 2027-03-31 23:59:59 한국 시각 = 2027-03-31T14:59:59Z
pub const UNTIL: u64 = 1_806_505_199;
pub const DAILY: u32 = 400;
/// 시험용 키를 쓸 수 있는 주소(채팅·글자 읽기)만
pub const TEST_URLS: &[&str] = &["https://api.upstage.ai/v1/chat/completions", "https://api.upstage.ai/v1/document-digitization"];
/// build.rs와 같은 섞개
pub const PAD: &[u8] = b"ssam-assistant-test-key-2027";

#[cfg(not(test))]
const OBF: &[u8] = include!(concat!(env!("OUT_DIR"), "/test_key.in"));
#[cfg(test)]
const OBF: &[u8] = &[];

pub fn xor(data: &[u8]) -> Vec<u8> {
    data.iter().enumerate().map(|(i, b)| b ^ PAD[i % PAD.len()]).collect()
}

pub fn now_secs() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(u64::MAX)
}

/// 섞인 키 → 진짜 키 (없거나 기한이 지났으면 None)
pub fn key_at(obf: &[u8], now: u64) -> Option<String> {
    if obf.is_empty() || now > UNTIL {
        return None;
    }
    String::from_utf8(xor(obf)).ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
}

pub fn available() -> bool {
    key_at(OBF, now_secs()).is_some()
}

/// 하루(한국 날짜) 횟수 세기: 넘으면 false
fn take(day: u64, used: &mut (u64, u32)) -> bool {
    if used.0 != day {
        *used = (day, 0);
    }
    if used.1 >= DAILY {
        return false;
    }
    used.1 += 1;
    true
}

/// authorization이 표시(MARK)면 진짜 키로 바꿈. 다른 헤더·내 키는 그대로(세지 않음)
pub fn swap(url: &str, headers: Vec<(String, String)>, obf: &[u8], now: u64, used: &mut (u64, u32)) -> Result<Vec<(String, String)>, String> {
    let mark = format!("Bearer {MARK}");
    if !headers.iter().any(|(k, v)| k.eq_ignore_ascii_case("authorization") && v.trim() == mark) {
        return Ok(headers);
    }
    if !TEST_URLS.iter().any(|u| url == *u || url.starts_with(&format!("{u}?"))) {
        return Err("시험용 업스테이지로는 이 주소를 부를 수 없어요.".to_string());
    }
    let key = key_at(obf, now).ok_or_else(|| "시험용 업스테이지 사용 기간(2027. 3. 31.)이 끝났어요. 설정 › AI에 내 AI 키를 넣어 주세요.".to_string())?;
    if !take((now + 9 * 3600) / 86_400, used) {
        return Err(format!("오늘 시험용 업스테이지 사용 횟수({DAILY}번)를 다 썼어요. 내일 다시 쓰거나 설정 › AI에 내 AI 키를 넣어 주세요."));
    }
    Ok(headers
        .into_iter()
        .map(|(k, v)| if k.eq_ignore_ascii_case("authorization") { (k, format!("Bearer {key}")) } else { (k, v) })
        .collect())
}

static USED: Mutex<(u64, u32)> = Mutex::new((0, 0));

pub fn apply(url: &str, headers: Vec<(String, String)>) -> Result<Vec<(String, String)>, String> {
    let mut used = USED.lock().map_err(|_| "시험용 키를 쓰지 못했어요.".to_string())?;
    swap(url, headers, OBF, now_secs(), &mut used)
}

#[cfg(test)]
mod tests {
    use super::*;
    const NOW: u64 = 1_793_000_000; // 2026-10-26쯤
    const CHAT: &str = "https://api.upstage.ai/v1/chat/completions";
    fn h(v: &str) -> Vec<(String, String)> {
        vec![("authorization".into(), v.into()), ("content-type".into(), "application/json".into())]
    }

    #[test]
    fn roundtrip_and_expiry() {
        let obf = xor(b"up_test_123");
        assert_ne!(obf, b"up_test_123".to_vec());
        assert_eq!(key_at(&obf, NOW).as_deref(), Some("up_test_123"));
        assert_eq!(key_at(&obf, UNTIL), Some("up_test_123".into()));
        assert_eq!(key_at(&obf, UNTIL + 1), None);
        assert_eq!(key_at(&[], NOW), None);
    }

    #[test]
    fn swaps_only_the_mark() {
        let obf = xor(b"up_test_123");
        let mut used = (0, 0);
        let out = swap(CHAT, h(&format!("Bearer {MARK}")), &obf, NOW, &mut used).unwrap();
        assert_eq!(out[0].1, "Bearer up_test_123");
        assert_eq!(out[1].1, "application/json");
        let mine = swap(CHAT, h("Bearer my_own_key"), &obf, NOW, &mut used).unwrap();
        assert_eq!(mine[0].1, "Bearer my_own_key");
        assert_eq!(used.1, 1, "내 키는 세지 않음");
    }

    #[test]
    fn expired_or_missing_key_is_an_error() {
        let mut used = (0, 0);
        assert!(swap(CHAT, h(&format!("Bearer {MARK}")), &xor(b"k"), UNTIL + 10, &mut used).unwrap_err().contains("2027. 3. 31."));
        assert!(swap(CHAT, h(&format!("Bearer {MARK}")), &[], NOW, &mut used).is_err());
    }

    #[test]
    fn only_chat_and_ocr_urls() {
        let obf = xor(b"k");
        let mut used = (0, 0);
        assert!(swap("https://api.upstage.ai/v1/document-digitization", h(&format!("Bearer {MARK}")), &obf, NOW, &mut used).is_ok());
        assert!(swap("https://api.upstage.ai/v1/document-digitization/async", h(&format!("Bearer {MARK}")), &obf, NOW, &mut used).is_err());
        assert!(swap("https://api.upstage.ai/v2/anything", h(&format!("Bearer {MARK}")), &obf, NOW, &mut used).is_err());
        assert!(swap("https://api.upstage.ai/v2/anything", h("Bearer mine"), &obf, NOW, &mut used).is_ok(), "내 키는 그대로");
    }

    #[test]
    fn daily_cap_resets_next_day() {
        let obf = xor(b"k");
        let mut used = (0, 0);
        for _ in 0..DAILY {
            assert!(swap(CHAT, h(&format!("Bearer {MARK}")), &obf, NOW, &mut used).is_ok());
        }
        assert!(swap(CHAT, h(&format!("Bearer {MARK}")), &obf, NOW, &mut used).unwrap_err().contains("400번"));
        assert!(swap(CHAT, h(&format!("Bearer {MARK}")), &obf, NOW + 86_400, &mut used).is_ok());
    }
}
