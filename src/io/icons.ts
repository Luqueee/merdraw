// Icon sources for the picker. Each source knows how to search its catalog and
// how to turn a chosen icon into a self-contained base64 data URI (so the diagram
// stays offline-safe and PNG export never taints the canvas).
import { invoke } from '@tauri-apps/api/core';

export type IconResult = {
  id: string; // unique per source, e.g. "mdi:home" or "svgl:42"
  title: string; // display name
  previewUrl: string; // remote URL for the grid <img> preview
  svgUrl: string; // remote URL of the raw SVG to inline
};

export type IconSource = {
  id: string;
  label: string;
  /** Empty query -> a starter set (may be []). */
  search: (query: string) => Promise<IconResult[]>;
  /** Fetch the chosen icon's SVG and inline it as a base64 data URI. */
  toDataUri: (icon: IconResult) => Promise<string>;
};

function svgToDataUri(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

// --- Iconify: 200k+ icons across 150+ open-source sets (MDI, Lucide, Tabler,
// Simple Icons, Font Awesome, Heroicons, Phosphor, ...). api.iconify.design is
// CORS-enabled, so the webview fetches it directly in both dev and Tauri. ---
const ICONIFY_POPULAR = [
  'mdi:home', 'mdi:account', 'mdi:cog', 'mdi:magnify', 'mdi:heart', 'mdi:star',
  'mdi:bell', 'mdi:calendar', 'mdi:email', 'mdi:folder', 'mdi:file', 'mdi:cloud',
  'mdi:database', 'mdi:server', 'mdi:download', 'mdi:upload', 'mdi:check', 'mdi:lock',
  'lucide:settings', 'lucide:zap', 'lucide:git-branch', 'lucide:terminal',
  'tabler:user', 'tabler:world', 'tabler:code', 'mdi:rocket-launch',
];

function iconifyResult(name: string): IconResult {
  const [prefix, icon = name] = name.split(':');
  const url = `https://api.iconify.design/${prefix}/${icon}.svg`;
  return { id: name, title: icon, previewUrl: url, svgUrl: url };
}

const iconify: IconSource = {
  id: 'iconify',
  label: 'Iconify',
  async search(query) {
    const q = query.trim();
    if (!q) return ICONIFY_POPULAR.map(iconifyResult);
    const res = await fetch(
      `https://api.iconify.design/search?query=${encodeURIComponent(q)}&limit=120`,
    );
    if (!res.ok) throw new Error(`Iconify API ${res.status}`);
    const data = await res.json();
    return Array.isArray(data?.icons) ? (data.icons as string[]).map(iconifyResult) : [];
  },
  async toDataUri(icon) {
    const res = await fetch(icon.svgUrl);
    if (!res.ok) throw new Error(`icon ${res.status}`);
    return svgToDataUri(await res.text());
  },
};

// --- svgl.app: brand / product logos. The SVG files send no CORS headers, so
// their content is fetched via the Rust `fetch_url` command (Tauri) or the Vite
// `/svgl` dev proxy (browser). The catalog (api.svgl.app) does allow CORS. ---
type SvglRoute = string | { light: string; dark: string };
type SvglEntry = { id: number; title: string; route: SvglRoute };

const svgl: IconSource = {
  id: 'svgl',
  label: 'Logos (svgl)',
  async search(query) {
    const q = query.trim();
    const url = q
      ? `https://api.svgl.app?search=${encodeURIComponent(q)}`
      : 'https://api.svgl.app?limit=30';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`svgl API ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return (data as SvglEntry[]).map((e) => {
      const route = typeof e.route === 'string' ? e.route : e.route.light;
      return { id: `svgl:${e.id}`, title: e.title, previewUrl: route, svgUrl: route };
    });
  },
  async toDataUri(icon) {
    const svgText =
      '__TAURI_INTERNALS__' in window
        ? await invoke<string>('fetch_url', { url: icon.svgUrl })
        : await (await fetch(icon.svgUrl.replace('https://svgl.app', '/svgl'))).text();
    return svgToDataUri(svgText);
  },
};

export const ICON_SOURCES: IconSource[] = [iconify, svgl];
