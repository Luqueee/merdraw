// Application I/O commands. Native dialogs come from tauri-plugin-dialog;
// the actual file read/write is done here with std::fs to avoid wrestling
// with plugin-fs scope permissions. App-defined commands need no capability entry.

mod mcp;
use mcp::{mcp_respond, DiagramTools, Pending};
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_binary_file(path: String, contents: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| e.to_string())
}

// Fetch a remote text resource server-side (no browser CORS), used to inline SVG
// icons from hosts whose files block cross-origin fetch. Restricted to an
// allow-list so this never becomes an open proxy — add a host to enable a source.
const ICON_HOSTS: [&str; 2] = ["https://svgl.app/", "https://api.svgl.app/"];

#[tauri::command]
fn fetch_url(url: String) -> Result<String, String> {
    if !ICON_HOSTS.iter().any(|h| url.starts_with(h)) {
        return Err("url host not allow-listed".into());
    }
    ureq::get(&url)
        .call()
        .map_err(|e| e.to_string())?
        .into_string()
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let pending: Pending = Default::default();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(pending.clone())
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            write_binary_file,
            fetch_url,
            mcp_respond
        ])
        .setup(move |app| {
            // Auto-start the MCP server. Host/port come from MERDRAW_MCP_HOST /
            // MERDRAW_MCP_PORT (default 0.0.0.0:8722). NOTE: 0.0.0.0 exposes the
            // (unauthenticated) diagram-editing API to the whole LAN — set
            // MERDRAW_MCP_HOST=127.0.0.1 to restrict it to this machine.
            // A bind failure (e.g. port busy) is logged; the app keeps running.
            let app_handle = app.handle().clone();
            let pending = pending.clone();
            tauri::async_runtime::spawn(async move {
                let port: u16 = std::env::var("MERDRAW_MCP_PORT")
                    .ok()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(8722);
                let host =
                    std::env::var("MERDRAW_MCP_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
                let service = rmcp::transport::streamable_http_server::StreamableHttpService::new(
                    move || Ok(DiagramTools::new(app_handle.clone(), pending.clone())),
                    rmcp::transport::streamable_http_server::session::local::LocalSessionManager::default().into(),
                    Default::default(),
                );
                let router = axum::Router::new().nest_service("/mcp", service);
                match tokio::net::TcpListener::bind((host.as_str(), port)).await {
                    Ok(l) => {
                        eprintln!("MCP server on http://{host}:{port}/mcp");
                        let _ = axum::serve(l, router).await;
                    }
                    Err(e) => eprintln!("MCP server failed to bind :{port}: {e}"),
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
