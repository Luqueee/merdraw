// Icon sources for the picker.
//
// Adding a source is cheap: give it an `id`, `label`, and a `search()` that maps
// its catalog to `IconResult[]`. The shared plumbing below handles transport,
// error handling, and base64 inlining. A source only needs `corsBlocked: true`
// when its SVG files lack CORS headers (then its host must be allow-listed in the
// Rust `fetch_url` command and the Vite `/__svg` dev middleware).
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
  /** true when the source's SVG files send no CORS headers (fetched server-side). */
  corsBlocked?: boolean;
  /** Empty query -> a starter set (may be []). */
  search: (query: string) => Promise<IconResult[]>;
};

// --- shared plumbing, reused by every source ---------------------------------

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`request failed (${res.status})`);
  return res.json();
}

// Origins whose SVG files are CORS-blocked: proxied same-origin by Vite in dev
// (see `server.proxy` in vite.config.ts), fetched by Rust `fetch_url` in Tauri.
const DEV_PROXY: Record<string, string> = { 'https://svgl.app': '/svgl' };

/** Fetch raw SVG text, routing CORS-blocked hosts server-side (Rust `fetch_url`
 * in Tauri, the Vite dev proxy under `bun run dev`). */
async function fetchSvg(url: string, corsBlocked = false): Promise<string> {
  if (corsBlocked && '__TAURI_INTERNALS__' in window) {
    return invoke<string>('fetch_url', { url });
  }
  let target = url;
  if (corsBlocked) {
    for (const [origin, prefix] of Object.entries(DEV_PROXY)) {
      if (url.startsWith(origin)) {
        target = prefix + url.slice(origin.length);
        break;
      }
    }
  }
  const res = await fetch(target);
  if (!res.ok) throw new Error(`request failed (${res.status})`);
  return res.text();
}

function svgToDataUri(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

/** Resolve a chosen icon to a self-contained base64 data URI (offline-safe, and
 * PNG export never taints the canvas with a cross-origin image). */
export async function iconToDataUri(source: IconSource, icon: IconResult): Promise<string> {
  return svgToDataUri(await fetchSvg(icon.svgUrl, source.corsBlocked));
}

// --- Iconify: 200k+ icons across 150+ open-source sets (MDI, Lucide, Tabler,
// Simple Icons, Font Awesome, Heroicons, Phosphor, ...). CORS-enabled. ---
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
    const data = (await getJson(
      `https://api.iconify.design/search?query=${encodeURIComponent(q)}&limit=120`,
    )) as { icons?: string[] };
    return Array.isArray(data.icons) ? data.icons.map(iconifyResult) : [];
  },
};

// --- svgl.app: brand / product logos. SVG files send no CORS headers. ---
type SvglRoute = string | { light: string; dark: string };
type SvglEntry = { id: number; title: string; route: SvglRoute };

const svgl: IconSource = {
  id: 'svgl',
  label: 'Logos (svgl)',
  corsBlocked: true,
  async search(query) {
    const q = query.trim();
    const data = await getJson(
      q ? `https://api.svgl.app?search=${encodeURIComponent(q)}` : 'https://api.svgl.app?limit=30',
    );
    if (!Array.isArray(data)) return [];
    return (data as SvglEntry[]).map((e) => {
      const route = typeof e.route === 'string' ? e.route : e.route.light;
      return { id: `svgl:${e.id}`, title: e.title, previewUrl: route, svgUrl: route };
    });
  },
};

export const ICON_SOURCES: IconSource[] = [iconify, svgl];
