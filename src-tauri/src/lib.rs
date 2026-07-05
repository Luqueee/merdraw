// Application I/O commands. Native dialogs come from tauri-plugin-dialog;
// the actual file read/write is done here with std::fs to avoid wrestling
// with plugin-fs scope permissions. App-defined commands need no capability entry.
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
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            write_binary_file,
            fetch_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
