//! AI 요청 대신 보내기: 웹뷰에서 바로 부르지 못하는 AI 주소(업스테이지)를 Windows 앱이 대신 부름.
//! 정해 둔 주소만 받고, 키가 든 헤더는 어디에도 기록하지 않음.

use serde::Serialize;
use std::time::Duration;

/// 대신 보낼 수 있는 주소 (앞부분)
const ALLOWED: &[&str] = &["https://api.upstage.ai/"];
/// 넘겨줄 수 있는 헤더
const PASS_HEADERS: &[&str] = &["authorization", "content-type", "accept"];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyResponse {
    status: u16,
    content_type: String,
    body: String,
}

pub fn allowed(url: &str) -> bool {
    ALLOWED.iter().any(|p| url.starts_with(p))
}

fn pass_header(name: &str) -> bool {
    PASS_HEADERS.contains(&name.to_ascii_lowercase().as_str())
}

/// POST로 보내고 답을 통째로 돌려줌 (스트리밍 답도 글 전체로)
#[tauri::command]
pub async fn ai_proxy(
    url: String,
    headers: Vec<(String, String)>,
    body: Vec<u8>,
) -> Result<ProxyResponse, String> {
    if !allowed(&url) {
        return Err("이 주소는 대신 보낼 수 없어요".to_string());
    }
    // 시험용 업스테이지: 웹 쪽이 보낸 표시를 진짜 키로(기한·하루 횟수 확인). 내 키면 그대로
    let headers = crate::test_key::apply(headers)?;
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(900))
        .build()
        .map_err(|e| format!("인터넷 연결을 준비하지 못했어요: {e}"))?;
    let mut req = client.post(&url).body(body);
    for (k, v) in headers {
        if pass_header(&k) {
            req = req.header(k, v);
        }
    }
    let res = req.send().await.map_err(|e| {
        if e.is_timeout() {
            "AI 응답이 너무 늦어요. 잠시 뒤 다시 해 주세요.".to_string()
        } else {
            "AI에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.".to_string()
        }
    })?;
    let status = res.status().as_u16();
    let content_type = res
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    let body = res
        .text()
        .await
        .map_err(|_| "AI 답을 끝까지 받지 못했어요.".to_string())?;
    Ok(ProxyResponse { status, content_type, body })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_upstage_urls() {
        assert!(allowed("https://api.upstage.ai/v1/chat/completions"));
        assert!(allowed("https://api.upstage.ai/v1/document-digitization"));
        assert!(!allowed("https://api.upstage.ai.evil.example/v1"));
        assert!(!allowed("http://api.upstage.ai/v1/chat/completions"));
        assert!(!allowed("https://example.com/?https://api.upstage.ai/"));
    }

    #[test]
    fn passes_only_known_headers() {
        assert!(pass_header("Authorization"));
        assert!(pass_header("content-type"));
        assert!(!pass_header("cookie"));
        assert!(!pass_header("host"));
    }
}
