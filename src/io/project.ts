import { open, save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../flow/store';
import { generateMermaid } from '../mermaid/generate';
import { svgToPng } from '../mermaid/render';
import { buildCanvasSvg } from '../flow/canvasImage';
import type { ProjectDoc } from '../flow/types';

const S = () => useStore.getState();

export async function saveProject() {
  const path = await save({
    filters: [{ name: 'Diagram Project', extensions: ['json'] }],
    defaultPath: 'diagram.json',
  });
  if (!path) return;
  await invoke('write_text_file', {
    path,
    contents: JSON.stringify(S().toDocument(), null, 2),
  });
}

export async function openProject() {
  const path = await open({
    multiple: false,
    directory: false,
    filters: [{ name: 'Diagram Project', extensions: ['json'] }],
  });
  if (typeof path !== 'string') return;
  const raw = await invoke<string>('read_text_file', { path });
  S().loadDocument(JSON.parse(raw) as ProjectDoc);
}

export async function exportMermaid() {
  const { nodes, edges, direction } = S();
  const path = await save({
    filters: [{ name: 'Mermaid', extensions: ['mmd'] }],
    defaultPath: 'diagram.mmd',
  });
  if (!path) return;
  await invoke('write_text_file', {
    path,
    contents: generateMermaid(nodes, edges, direction),
  });
}

// SVG and PNG export the canvas exactly as arranged (WYSIWYG), built as native
// SVG (no <foreignObject>, so it's portable and rasterizes without tainting).
// Mermaid (.mmd) stays the portable, auto-laid-out text representation.
export async function exportSvg() {
  const svg = buildCanvasSvg();
  const path = await save({
    filters: [{ name: 'SVG', extensions: ['svg'] }],
    defaultPath: 'diagram.svg',
  });
  if (!path) return;
  await invoke('write_text_file', { path, contents: svg });
}

export async function exportPng() {
  const bytes = await svgToPng(buildCanvasSvg());
  const path = await save({
    filters: [{ name: 'PNG', extensions: ['png'] }],
    defaultPath: 'diagram.png',
  });
  if (!path) return;
  await invoke('write_binary_file', { path, contents: Array.from(bytes) });
}
