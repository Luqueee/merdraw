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

/** Fetch the SVG (light variant for themed logos) through Rust and inline it as a base64 data URI. */
export async function fetchSvgDataUri(route: SvglRoute): Promise<string> {
  const url = typeof route === 'string' ? route : route.light;
  const svg = await invoke<string>('fetch_url', { url });
  const bytes = new TextEncoder().encode(svg);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}
