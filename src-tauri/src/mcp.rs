//! Embedded MCP server surface.
//!
//! The diagram's source of truth is the webview's Zustand store, so every tool
//! is a thin pass-through: it emits a `mcp:request` event to the frontend, which
//! mutates the store and replies via the `mcp_respond` command. A per-request
//! `oneshot` channel keyed by uuid correlates the reply back to the awaiting tool.
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use rmcp::handler::server::tool::ToolRouter;
use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::*;
use rmcp::{tool, tool_handler, tool_router, ErrorData as McpError, ServerHandler};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::Emitter;
use tokio::sync::{oneshot, Mutex};

/// Correlation registry: request id -> reply sender. Shared (`.manage`d) between
/// the Tauri command layer and the MCP tool handlers.
pub type Pending = Arc<Mutex<HashMap<String, oneshot::Sender<Value>>>>;

/// Payload emitted to the webview on the fixed `mcp:request` event.
#[derive(Clone, Serialize)]
struct McpRequest {
    id: String,
    method: String,
    params: Value,
}

/// Called from JS (`invoke("mcp_respond", …)`) to hand a tool's result back to
/// the Rust side. Unknown/stale ids are dropped silently.
#[tauri::command]
pub async fn mcp_respond(
    state: tauri::State<'_, Pending>,
    id: String,
    ok: bool,
    result: Option<Value>,
    error: Option<String>,
) -> Result<(), String> {
    let tx = state.lock().await.remove(&id);
    if let Some(tx) = tx {
        let _ = tx.send(json!({ "ok": ok, "result": result, "error": error }));
    }
    Ok(())
}

// ---- tool parameter structs (AI-facing schema) --------------------------------

#[derive(Deserialize, Serialize, JsonSchema)]
struct Position {
    x: f64,
    y: f64,
}

#[derive(Deserialize, Serialize, JsonSchema)]
struct SetDiagramParams {
    /// Flow direction: TD, LR, BT or RL.
    direction: String,
    /// Full node list. Each: { id?, kind:"shape"|"icon", label, shape?, src?, title?, position? }.
    nodes: Vec<Value>,
    /// Full edge list. Each: { id?, source, target, label?, lineStyle?, arrow? }.
    edges: Vec<Value>,
}

#[derive(Deserialize, Serialize, JsonSchema)]
struct AddNodeParams {
    /// Text label for the node.
    label: String,
    /// Shape: rectangle|rounded|stadium|subroutine|circle|decision (default rectangle).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    shape: Option<String>,
    /// Optional canvas position; auto-placed below existing nodes when omitted.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    position: Option<Position>,
}

#[derive(Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
struct ConnectParams {
    /// Id of the source node (from get_diagram).
    source: String,
    /// Id of the target node (from get_diagram).
    target: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    label: Option<String>,
    /// Line style: solid|dotted|thick (default solid).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    line_style: Option<String>,
    /// Draw an arrowhead at the target (default true).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    arrow: Option<bool>,
}

#[derive(Deserialize, Serialize, JsonSchema)]
struct UpdateNodeParams {
    /// Id of the node to update.
    id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    label: Option<String>,
    /// New shape (shape nodes only): rectangle|rounded|stadium|subroutine|circle|decision.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    shape: Option<String>,
}

#[derive(Deserialize, Serialize, JsonSchema)]
struct DeleteNodeParams {
    /// Id of the node to delete (its incident edges are removed too).
    id: String,
}

#[derive(Deserialize, Serialize, JsonSchema)]
struct SetDirectionParams {
    /// Flow direction: TD, LR, BT or RL.
    direction: String,
}

#[derive(Deserialize, Serialize, JsonSchema)]
struct SearchIconsParams {
    /// Icon name / search text, e.g. "github", "database", "rocket".
    query: String,
    /// Icon source: "iconify" (200k+ general icons, default) or "svgl" (brand/product logos).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    source: Option<String>,
}

#[derive(Deserialize, Serialize, JsonSchema)]
struct AddIconParams {
    /// Icon to search for and add, e.g. "github", "postgres". Best (exact-title) match is used.
    query: String,
    /// Icon source: "iconify" (default) or "svgl" (brand/product logos).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    source: Option<String>,
    /// Optional caption under the icon (defaults to the icon's title).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    label: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    position: Option<Position>,
}

// ---- server ------------------------------------------------------------------

#[derive(Clone)]
pub struct DiagramTools {
    app: tauri::AppHandle,
    pending: Pending,
    tool_router: ToolRouter<DiagramTools>,
}

/// Map the frontend's `{ ok, result, error }` envelope to an MCP tool result.
fn to_result(v: Value) -> Result<CallToolResult, McpError> {
    let ok = v.get("ok").and_then(Value::as_bool).unwrap_or(false);
    if ok {
        let result = v.get("result").cloned().unwrap_or(Value::Null);
        let text = serde_json::to_string(&result).unwrap_or_else(|_| "null".into());
        Ok(CallToolResult::success(vec![Content::text(text)]))
    } else {
        let err = v
            .get("error")
            .and_then(Value::as_str)
            .unwrap_or("unknown error")
            .to_string();
        Ok(CallToolResult::error(vec![Content::text(err)]))
    }
}

impl DiagramTools {
    pub fn new(app: tauri::AppHandle, pending: Pending) -> Self {
        Self {
            app,
            pending,
            tool_router: Self::tool_router(),
        }
    }

    /// Emit `mcp:request` to the webview and await the correlated `mcp_respond`.
    /// Returns the `{ ok, result, error }` envelope, or an error envelope on
    /// timeout / emit failure so a tool never hangs.
    async fn call_frontend(&self, method: &str, params: Value) -> Value {
        let id = uuid::Uuid::new_v4().to_string();
        let (tx, rx) = oneshot::channel();
        self.pending.lock().await.insert(id.clone(), tx);

        let req = McpRequest {
            id: id.clone(),
            method: method.to_string(),
            params,
        };
        if let Err(e) = self.app.emit("mcp:request", req) {
            self.pending.lock().await.remove(&id);
            return json!({ "ok": false, "error": format!("failed to reach window: {e}") });
        }

        match tokio::time::timeout(Duration::from_secs(15), rx).await {
            Ok(Ok(v)) => v,
            _ => {
                self.pending.lock().await.remove(&id);
                json!({ "ok": false, "error": "Merdraw window not responding (is the app open?)" })
            }
        }
    }
}

#[tool_router]
impl DiagramTools {
    #[tool(
        description = "Read the current diagram. Returns { mermaid, direction, nodes[], edges[] }. \
Each node has an id, kind ('shape'|'icon'), label and (for shapes) a shape. Call this first to obtain ids."
    )]
    async fn get_diagram(&self) -> Result<CallToolResult, McpError> {
        to_result(self.call_frontend("get_diagram", json!({})).await)
    }

    #[tool(
        description = "Replace the entire diagram. Node ids are optional (auto-generated); every edge \
source/target must reference a node id present in the same call. Icon nodes are preserved by round-tripping \
their { kind:'icon', src, title } fields. Returns { mermaid }."
    )]
    async fn set_diagram(
        &self,
        params: Parameters<SetDiagramParams>,
    ) -> Result<CallToolResult, McpError> {
        let p = serde_json::to_value(params.0).unwrap_or_default();
        to_result(self.call_frontend("set_diagram", p).await)
    }

    #[tool(
        description = "Add one shape node (never an icon). shape ∈ rectangle|rounded|stadium|subroutine|circle|decision. \
Returns { id, mermaid }."
    )]
    async fn add_node(
        &self,
        params: Parameters<AddNodeParams>,
    ) -> Result<CallToolResult, McpError> {
        let p = serde_json::to_value(params.0).unwrap_or_default();
        to_result(self.call_frontend("add_node", p).await)
    }

    #[tool(
        description = "Connect two existing nodes with a directed edge. lineStyle ∈ solid|dotted|thick. \
Returns { id, mermaid }."
    )]
    async fn connect(&self, params: Parameters<ConnectParams>) -> Result<CallToolResult, McpError> {
        let p = serde_json::to_value(params.0).unwrap_or_default();
        to_result(self.call_frontend("connect", p).await)
    }

    #[tool(
        description = "Update a node's label and/or shape (shape valid only on shape nodes). Returns { mermaid }."
    )]
    async fn update_node(
        &self,
        params: Parameters<UpdateNodeParams>,
    ) -> Result<CallToolResult, McpError> {
        let p = serde_json::to_value(params.0).unwrap_or_default();
        to_result(self.call_frontend("update_node", p).await)
    }

    #[tool(description = "Delete a node by id and every edge touching it. Returns { mermaid }.")]
    async fn delete_node(
        &self,
        params: Parameters<DeleteNodeParams>,
    ) -> Result<CallToolResult, McpError> {
        let p = serde_json::to_value(params.0).unwrap_or_default();
        to_result(self.call_frontend("delete_node", p).await)
    }

    #[tool(description = "Set the flow direction: TD, LR, BT or RL. Returns { mermaid }.")]
    async fn set_direction(
        &self,
        params: Parameters<SetDirectionParams>,
    ) -> Result<CallToolResult, McpError> {
        let p = serde_json::to_value(params.0).unwrap_or_default();
        to_result(self.call_frontend("set_direction", p).await)
    }

    #[tool(
        description = "Search for icons by name. source ∈ iconify (200k+ general icons, default) | svgl (brand/product logos). \
Returns { icons: [{ source, id, title }] } — preview before add_icon."
    )]
    async fn search_icons(
        &self,
        params: Parameters<SearchIconsParams>,
    ) -> Result<CallToolResult, McpError> {
        let p = serde_json::to_value(params.0).unwrap_or_default();
        to_result(self.call_frontend("search_icons", p).await)
    }

    #[tool(
        description = "Add an icon node: searches for an SVG (iconify or svgl) and inlines it as a data URI. \
source ∈ iconify (default) | svgl (brand logos). Returns { id, title, source, mermaid }."
    )]
    async fn add_icon(
        &self,
        params: Parameters<AddIconParams>,
    ) -> Result<CallToolResult, McpError> {
        let p = serde_json::to_value(params.0).unwrap_or_default();
        to_result(self.call_frontend("add_icon", p).await)
    }
}

#[tool_handler]
impl ServerHandler for DiagramTools {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            instructions: Some(
                "Edit the open Merdraw flowchart. Call get_diagram first to read current nodes/edges \
(each node has an id, kind 'shape'|'icon', label, and shape). Reference existing ids when connecting/updating. \
shape ∈ rectangle|rounded|stadium|subroutine|circle|decision; direction ∈ TD|LR|BT|RL; lineStyle ∈ solid|dotted|thick. \
add_node creates shape nodes only. To add an icon (logo/glyph) use add_icon with a query like 'github' or 'database' \
(source 'iconify' for general icons — the default — or 'svgl' for brand logos); search_icons previews matches first. \
Icon nodes also round-trip through set_diagram unchanged."
                    .into(),
            ),
            capabilities: ServerCapabilities::builder().enable_tools().build(),
            // from_build_env() would read rmcp's own crate vars; use ours.
            server_info: Implementation {
                name: env!("CARGO_PKG_NAME").to_string(),
                version: env!("CARGO_PKG_VERSION").to_string(),
                ..Default::default()
            },
            ..Default::default()
        }
    }
}
