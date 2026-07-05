// Export the canvas exactly as arranged, as a *native* SVG — real
// <rect>/<ellipse>/<polygon>/<path>/<text>/<image>, no <foreignObject>. That
// keeps the file portable: it renders in browsers, vector editors and the Tauri
// webview alike (a foreignObject SVG is blank in most of those).
//
// Node geometry comes from the store (position + measured size); edge geometry
// is read straight from the DOM, where React Flow already computed the bezier
// `d` in the same flow-coordinate space as the node positions. Mermaid stays
// the portable, auto-laid-out text representation.
import { useStore } from './store';
import type { FlowNode } from './types';

// Margin (px) around the diagram content.
const PADDING = 24;
// Intrinsic px multiplier. The viewBox stays at natural coordinates (so vector
// viewers/editors are unchanged), but viewers that rasterize SVG — notably
// macOS Quick Look and Preview — then generate the bitmap at higher resolution
// instead of upscaling a small one.
const EXPORT_SCALE = 2;
const FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const EDGE = '#b1b1b7';
const LABEL_TEXT = '#1a1a1a';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type Box = { x: number; y: number; width: number; height: number };

function dims(n: FlowNode): { w: number; h: number } {
  return { w: n.measured?.width ?? 90, h: n.measured?.height ?? 44 };
}

// One node → native SVG markup mirroring the on-canvas .shape / .icon-node CSS.
function nodeSvg(n: FlowNode): string {
  const { x, y } = n.position;
  const { w, h } = dims(n);
  const cx = x + w / 2;
  const cy = y + h / 2;

  if (n.type === 'icon') {
    const size = 48;
    const label = n.data.label?.trim();
    const parts = [
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#ffffff" stroke="#cbd5e1"/>`,
      `<image href="${n.data.src}" x="${cx - size / 2}" y="${y + 8}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/>`,
    ];
    if (label) {
      parts.push(
        `<text x="${cx}" y="${y + h - 10}" text-anchor="middle" font-family="${FONT}" font-size="12" fill="#0f172a">${esc(label)}</text>`,
      );
    }
    return parts.join('');
  }

  const stroke = '#334155';
  let textFill = '#0f172a';
  let shapeEl: string;
  switch (n.data.shape) {
    case 'decision':
      shapeEl = `<polygon points="${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}" fill="#dbeafe"/>`;
      textFill = '#1e3a8a';
      break;
    case 'circle':
      shapeEl = `<ellipse cx="${cx}" cy="${cy}" rx="${w / 2}" ry="${h / 2}" fill="#ffffff" stroke="${stroke}"/>`;
      break;
    case 'stadium':
      shapeEl = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="#ffffff" stroke="${stroke}"/>`;
      break;
    case 'rounded':
      shapeEl = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="#ffffff" stroke="${stroke}"/>`;
      break;
    case 'subroutine':
      shapeEl =
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff" stroke="${stroke}"/>` +
        `<line x1="${x + 5}" y1="${y}" x2="${x + 5}" y2="${y + h}" stroke="${stroke}"/>` +
        `<line x1="${x + w - 5}" y1="${y}" x2="${x + w - 5}" y2="${y + h}" stroke="${stroke}"/>`;
      break;
    default:
      shapeEl = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff" stroke="${stroke}"/>`;
  }

  const lines = (n.data.label ?? '').split('\n');
  const lineH = 15;
  const startY = cy - ((lines.length - 1) * lineH) / 2;
  const tspans = lines
    .map((ln, i) => `<tspan x="${cx}" dy="${i === 0 ? 0 : lineH}">${esc(ln || ' ')}</tspan>`)
    .join('');
  const text = `<text x="${cx}" y="${startY}" text-anchor="middle" dominant-baseline="central" font-family="${FONT}" font-size="13" fill="${textFill}">${tspans}</text>`;

  return shapeEl + text;
}

// Edges → native SVG, reusing React Flow's already-computed path `d` from the
// DOM. Returns the markup plus each path's bounding box so bezier curves that
// bow outside the node rectangles are included in the viewBox.
function edgesSvg(): { markup: string; boxes: Box[] } {
  const { edges } = useStore.getState();
  const parts: string[] = [];
  const boxes: Box[] = [];

  for (const e of edges) {
    const path = document.querySelector<SVGPathElement>(
      `.react-flow__edge[data-id="${e.id}"] .react-flow__edge-path`,
    );
    const d = path?.getAttribute('d');
    if (!path || !d) continue;

    const bb = path.getBBox();
    boxes.push({ x: bb.x, y: bb.y, width: bb.width, height: bb.height });

    const thick = e.data?.lineStyle === 'thick';
    const width = thick ? 3 : 1.5;
    const dash = e.data?.lineStyle === 'dotted' ? ' stroke-dasharray="6 4"' : '';
    parts.push(
      `<path d="${d}" fill="none" stroke="${EDGE}" stroke-width="${width}" stroke-linecap="round"${dash}/>`,
    );

    // Bake the arrowhead as an explicit triangle oriented along the path's end
    // tangent — SVG <marker> is unsupported/unreliable in several viewers
    // (notably macOS Quick Look / Preview), so markers won't render there.
    if (e.data?.arrow !== false) {
      const total = path.getTotalLength();
      const tip = path.getPointAtLength(total);
      const back = path.getPointAtLength(Math.max(0, total - 2));
      const angle = (Math.atan2(tip.y - back.y, tip.x - back.x) * 180) / Math.PI;
      const len = thick ? 13 : 10;
      const halfW = thick ? 5 : 4;
      parts.push(
        `<polygon points="0,0 ${-len},${-halfW} ${-len},${halfW}" fill="${EDGE}" transform="translate(${tip.x} ${tip.y}) rotate(${angle})"/>`,
      );
    }

    const label = e.data?.label?.trim();
    if (label) {
      const mid = path.getPointAtLength(path.getTotalLength() / 2);
      const tw = label.length * 6.3 + 8;
      parts.push(
        `<rect x="${mid.x - tw / 2}" y="${mid.y - 10}" width="${tw}" height="20" rx="3" fill="#ffffff"/>` +
          `<text x="${mid.x}" y="${mid.y}" text-anchor="middle" dominant-baseline="central" font-family="${FONT}" font-size="11" fill="${LABEL_TEXT}">${esc(label)}</text>`,
      );
    }
  }

  return { markup: parts.join(''), boxes };
}

/** Build a standalone, portable SVG of the canvas exactly as arranged.
 *  Throws when the canvas is empty or not mounted. */
export function buildCanvasSvg(): string {
  const { nodes } = useStore.getState();
  if (nodes.length === 0) throw new Error('El lienzo está vacío.');
  if (!document.querySelector('.react-flow__viewport')) {
    throw new Error('No se encontró el lienzo de React Flow.');
  }

  const { markup: edges, boxes } = edgesSvg();

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    const { w, h } = dims(n);
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + w);
    maxY = Math.max(maxY, n.position.y + h);
  }
  for (const b of boxes) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }

  const vbX = minX - PADDING;
  const vbY = minY - PADDING;
  const w = maxX - minX + PADDING * 2;
  const h = maxY - minY + PADDING * 2;

  const nodesMarkup = nodes.map(nodeSvg).join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w * EXPORT_SCALE)}" height="${Math.ceil(h * EXPORT_SCALE)}" viewBox="${vbX} ${vbY} ${w} ${h}">` +
    `<rect x="${vbX}" y="${vbY}" width="${w}" height="${h}" fill="#ffffff"/>` +
    edges +
    nodesMarkup +
    '</svg>'
  );
}
