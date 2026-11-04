use std::time::{SystemTime, UNIX_EPOCH};

/// 시험용 업스테이지 키(src/test_key.rs와 같은 값): 기한·섞개
const UNTIL: u64 = 1_806_505_199; // 2027-03-31 23:59:59 한국 시각
const PAD: &[u8] = b"ssam-assistant-test-key-2027";

fn main() {
    // 릴리즈 빌드 때 GitHub 비밀값 UPSTAGE_TEST_KEY를 섞어(XOR) 넣음. 없거나 기한이 지났으면 빈 값(시험용 키 없음)
    println!("cargo:rerun-if-env-changed=UPSTAGE_TEST_KEY");
    let now = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(u64::MAX);
    let key = std::env::var("UPSTAGE_TEST_KEY").unwrap_or_default();
    let key = if now > UNTIL { String::new() } else { key.trim().to_string() };
    let bytes: Vec<String> = key.bytes().enumerate().map(|(i, b)| (b ^ PAD[i % PAD.len()]).to_string()).collect();
    let out = std::path::PathBuf::from(std::env::var("OUT_DIR").expect("OUT_DIR"));
    std::fs::write(out.join("test_key.in"), format!("&[{}]", bytes.join(","))).expect("test_key.in");
    tauri_build::build()
}
