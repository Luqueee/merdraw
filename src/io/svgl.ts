// Access to the svgl.app catalog of SVG logos.
// The catalog (api.svgl.app) allows CORS, so it is fetched from the webview.
// The SVG files (svgl.app/library/*.svg) do NOT send CORS headers, so their
// content is fetched through the Rust `fetch_url` command (no CORS) and inlined
// as a base64 data URI — self-contained, so PNG export never taints the canvas.
import { invoke } from '@tauri-apps/api/core';

export type SvglRoute = string | { light: string; dark: string };
export type SvglEntry = {
  id: number;
  title: string;
  category?: string | string[];
  route: SvglRoute;
  url?: string;
};

const API = 'https://api.svgl.app';

/** No query -> first page of the catalog; a query -> svgl's search endpoint. */
export async function fetchIcons(query: string, limit = 30): Promise<SvglEntry[]> {
  const q = query.trim();
  const url = q ? `${API}?search=${encodeURIComponent(q)}` : `${API}?limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`svgl API ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? (data as SvglEntry[]) : [];
}

/**
 * Fetch the SVG (light variant for themed logos) and inline it as a base64 data URI.
 * In the Tauri app this goes through the Rust `fetch_url` command (svgl SVG files send
 * no CORS headers, so the webview cannot fetch them directly). Under `bun run dev`
 * there is no Tauri runtime, so it falls back to the Vite `/svgl` dev proxy.
 */
export async function fetchSvgDataUri(route: SvglRoute): Promise<string> {
  const url = typeof route === 'string' ? route : route.light;
  const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  const svg = inTauri
    ? await invoke<string>('fetch_url', { url })
    : await (await fetch(url.replace('https://svgl.app', '/svgl'))).text();
  const bytes = new TextEncoder().encode(svg);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}
