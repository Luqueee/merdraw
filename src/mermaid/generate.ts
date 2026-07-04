import type {
  FlowNode,
  FlowEdge,
  FlowEdgeData,
  Direction,
  ShapeKind,
  LineStyle,
} from '../flow/types';

const DELIMS: Record<ShapeKind, [string, string]> = {
  rectangle: ['[', ']'],
  rounded: ['(', ')'],
  stadium: ['([', '])'],
  subroutine: ['[[', ']]'],
  circle: ['((', '))'],
  decision: ['{', '}'],
};

const CONN: Record<LineStyle, { arrow: string; open: string }> = {
  solid: { arrow: '-->', open: '---' },
  dotted: { arrow: '-.->', open: '-.-' },
  thick: { arrow: '==>', open: '===' },
};

function esc(raw: string): string {
  const t = raw.trim() === '' ? ' ' : raw;
  return t.replace(/"/g, '#quot;').replace(/\r?\n/g, '<br/>');
}

export function generateMermaid(
  nodes: FlowNode[],
  edges: FlowEdge[],
  direction: Direction,
): string {
  const id = new Map<string, string>();
  nodes.forEach((n, i) => id.set(n.id, `n${i + 1}`));
  const lines: string[] = [`flowchart ${direction}`];
  for (const n of nodes) {
    const nid = id.get(n.id);
    if (n.type === 'icon') {
      const lbl = n.data.label?.trim();
      const label = lbl ? `, label: "${esc(lbl)}"` : '';
      lines.push(`    ${nid}@{ img: "${n.data.src}"${label}, w: 60, h: 60, constraint: "on" }`);
    } else {
      const [o, c] = DELIMS[n.data.shape];
      lines.push(`    ${nid}${o}"${esc(n.data.label)}"${c}`);
    }
  }
  for (const e of edges) {
    const s = id.get(e.source);
    const t = id.get(e.target);
    if (!s || !t) continue; // guard against dangling edge
    const d = (e.data as FlowEdgeData) ?? { label: '', lineStyle: 'solid', arrow: true };
    const conn = CONN[d.lineStyle][d.arrow ? 'arrow' : 'open'];
    const lbl = d.label?.trim();
    lines.push(lbl ? `    ${s} ${conn}|"${esc(lbl)}"| ${t}` : `    ${s} ${conn} ${t}`);
  }
  return lines.join('\n');
}
