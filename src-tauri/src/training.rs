//! Dedicated GAS transport. Never forward the POST body through a redirect.
use reqwest::{header, redirect::Policy, Url};
use std::time::Duration;

const MAX_BYTES: usize = 8 * 1024 * 1024;

fn allowed_deployment(raw: &str) -> bool {
    let Ok(url) = Url::parse(raw) else { return false };
    let parts: Vec<_> = url.path().split('/').collect();
    url.scheme() == "https" && url.host_str() == Some("script.google.com")
        && url.username().is_empty() && url.password().is_none() && url.port().is_none()
        && url.query().is_none() && url.fragment().is_none()
        && parts.len() == 5 && parts[1] == "macros" && parts[2] == "s" && parts[4] == "exec"
        && !parts[3].is_empty() && parts[3].bytes().all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
}

fn allowed_response(url: &Url) -> bool {
    url.scheme() == "https" && url.host_str() == Some("script.googleusercontent.com")
        && url.username().is_empty() && url.password().is_none() && url.port().is_none()
        && url.fragment().is_none() && url.path() == "/macros/echo"
}

#[tauri::command]
pub async fn training_request(url: String, body: String) -> Result<String, String> {
    if !allowed_deployment(&url) || body.len() > MAX_BYTES {
        return Err("연수 서버 주소 또는 요청 크기가 올바르지 않습니다.".into());
    }
    let value: serde_json::Value = serde_json::from_str(&body)
        .map_err(|_| "연수 요청 형식이 올바르지 않습니다.".to_string())?;
    if !matches!(value.get("action").and_then(|v| v.as_str()), Some("catalog" | "mySubmissions" | "submit" | "revise" | "reviewQueue" | "review" | "evidence")) {
        return Err("지원하지 않는 연수 요청입니다.".into());
    }
    let client = reqwest::Client::builder().redirect(Policy::none())
        .connect_timeout(Duration::from_secs(15)).timeout(Duration::from_secs(90))
        .build().map_err(|_| "연수 연결을 준비하지 못했습니다.".to_string())?;
    let mut response = client.post(url).header(header::CONTENT_TYPE, "application/json")
        .body(body).send().await.map_err(|_| "연수 서버 응답이 미확인입니다. 같은 요청으로 재시도해 주세요.".to_string())?;
    if matches!(response.status().as_u16(), 302 | 303) {
        let location = response.headers().get(header::LOCATION).and_then(|v| v.to_str().ok())
            .and_then(|s| Url::parse(s).ok()).filter(allowed_response)
            .ok_or_else(|| "허용하지 않는 연수 서버 이동 주소입니다.".to_string())?;
        // New GET: no token, body, cookies, or Authorization forwarded.
        response = client.get(location).send().await
            .map_err(|_| "연수 결과를 받지 못했습니다. 같은 요청으로 재시도해 주세요.".to_string())?;
    }
    if !response.status().is_success() {
        return Err("연수 서버가 정상 응답하지 않았습니다. 배포 설정을 확인해 주세요.".into());
    }
    if response.content_length().is_some_and(|n| n > MAX_BYTES as u64) {
        return Err("연수 응답 크기를 초과했습니다.".into());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| "연수 응답을 끝까지 받지 못했습니다.".to_string())? {
        if bytes.len() + chunk.len() > MAX_BYTES { return Err("연수 응답 크기를 초과했습니다.".into()); }
        bytes.extend_from_slice(&chunk);
    }
    let text = String::from_utf8(bytes).map_err(|_| "연수 응답 형식이 올바르지 않습니다.".to_string())?;
    let _: serde_json::Value = serde_json::from_str(&text).map_err(|_| "JSON 응답이 아닙니다. 웹앱 접근 설정을 확인해 주세요.".to_string())?;
    Ok(text)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn deployment_is_exact_and_has_no_credentials_or_query() {
        assert!(allowed_deployment("https://script.google.com/macros/s/demo_123/exec"));
        for url in ["http://script.google.com/macros/s/x/exec", "https://script.google.com.evil.test/macros/s/x/exec", "https://user@script.google.com/macros/s/x/exec", "https://script.google.com/macros/s/x/exec?token=x", "https://script.google.com/macros/s/x/dev", "https://script.google.com/macros/s/x/exec#x"] { assert!(!allowed_deployment(url)); }
    }
    #[test]
    fn only_google_content_response_redirect_is_permitted() {
        assert!(allowed_response(&Url::parse("https://script.googleusercontent.com/macros/echo?user_content_key=test").unwrap()));
        for url in ["https://evil.test/macros/echo", "https://script.googleusercontent.com.evil.test/macros/echo", "https://script.google.com/macros/s/other/exec", "https://accounts.google.com/login", "https://script.googleusercontent.com/other", "http://script.googleusercontent.com/macros/echo"] { assert!(!allowed_response(&Url::parse(url).unwrap())); }
    }
}
