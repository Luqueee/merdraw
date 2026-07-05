import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useStore, nextId, edgeVisuals } from '../flow/store';
import { generateMermaid } from '../mermaid/generate';
import { ICON_SOURCES, iconToDataUri, type IconSource } from '../io/icons';
import type {
  ProjectDoc,
  FlowNode,
  FlowEdge,
  ShapeFlowNode,
  IconFlowNode,
  ShapeNodeData,
  IconNodeData,
  FlowEdgeData,
  Direction,
  ShapeKind,
  LineStyle,
} from '../flow/types';

// --- AI-facing JSON contract --------------------------------------------------
// The exact shapes the MCP tools carry. Node ids are optional on input (generated
// when omitted) and always present on output.

type XY = { x: number; y: number };

export type NodeContract = {
  id?: string;
  kind: 'shape' | 'icon';
  label: string;
  shape?: ShapeKind;
  src?: string;
  title?: string;
  position?: XY;
};

export type EdgeContract = {
  id?: string;
  source: string;
  target: string;
  label?: string;
  lineStyle?: LineStyle;
  arrow?: boolean;
};

export type DiagramRequest = { method: string; params: unknown };
export type ApplyResult = { doc: ProjectDoc | null; result: unknown; error: string | null };

// --- validation guards --------------------------------------------------------

const DIRECTIONS: Record<Direction, true> = { TD: true, LR: true, BT: true, RL: true };
const SHAPES: Record<ShapeKind, true> = {
  rectangle: true,
  rounded: true,
  stadium: true,
  subroutine: true,
  circle: true,
  decision: true,
};
const LINE_STYLES: Record<LineStyle, true> = { solid: true, dotted: true, thick: true };

const has = (table: Record<string, true>, v: string): boolean =>
  Object.prototype.hasOwnProperty.call(table, v);

export const isDirection = (v: unknown): v is Direction => typeof v === 'string' && has(DIRECTIONS, v);
export const isShapeKind = (v: unknown): v is ShapeKind => typeof v === 'string' && has(SHAPES, v);
export const isLineStyle = (v: unknown): v is LineStyle => typeof v === 'string' && has(LINE_STYLES, v);

// --- unknown-input readers (params come from an external MCP client) ----------

const record = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);
const readPosition = (v: unknown): XY | undefined => {
  const r = record(v);
  const x = num(r.x);
  const y = num(r.y);
  return x !== undefined && y !== undefined ? { x, y } : undefined;
};

// --- serialization (store -> AI contract) -------------------------------------

export function serializeDoc(doc: ProjectDoc) {
  const nodes: NodeContract[] = doc.nodes.map((n): NodeContract =>
    n.type === 'icon'
      ? {
          id: n.id,
          kind: 'icon',
          label: n.data.label,
          title: n.data.title,
          src: n.data.src,
          position: n.position,
        }
      : {
          id: n.id,
          kind: 'shape',
          label: n.data.label,
          shape: n.data.shape,
          position: n.position,
        },
  );
  const edges: EdgeContract[] = doc.edges.map((e): EdgeContract => {
    const d: FlowEdgeData = e.data ?? { label: '', lineStyle: 'solid', arrow: true };
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label: d.label,
      lineStyle: d.lineStyle,
      arrow: d.arrow,
    };
  });
  return { mermaid: mermaidOf(doc), direction: doc.direction, nodes, edges };
}

// --- internal builders (AI contract -> React Flow) ----------------------------

function buildShapeNode(
  args: { id?: string; label?: string; shape?: ShapeKind },
  pos: XY,
): ShapeFlowNode {
  return {
    id: args.id ?? nextId('node'),
    type: 'shape',
    position: pos,
    data: { label: args.label ?? '', shape: args.shape ?? 'rectangle' },
  };
}

function buildIconNode(
  args: { id?: string; label?: string; title?: string; src: string },
  pos: XY,
): IconFlowNode {
  return {
    id: args.id ?? nextId('node'),
    type: 'icon',
    position: pos,
    data: {
      label: args.label ?? args.title ?? '',
      title: args.title ?? args.label ?? '',
      src: args.src,
    },
  };
}

function buildEdge(args: {
  id?: string;
  source: string;
  target: string;
  label?: string;
  lineStyle?: LineStyle;
  arrow?: boolean;
}): FlowEdge {
  const data: FlowEdgeData = {
    label: args.label ?? '',
    lineStyle: args.lineStyle ?? 'solid',
    arrow: args.arrow ?? true,
  };
  // Pre-apply edgeVisuals: loadDocument replaces state wholesale without deriving
  // markerEnd/style, so new edges must carry them or arrowheads/dashes vanish.
  return { id: args.id ?? nextId('edge'), source: args.source, target: args.target, data, ...edgeVisuals(data) };
}

// --- position placement (deterministic, dependency-free) ----------------------

const gridPos = (i: number): XY => ({ x: 120 + (i % 4) * 220, y: 80 + Math.floor(i / 4) * 140 });
const belowExisting = (nodes: FlowNode[]): XY =>
  nodes.length === 0 ? { x: 160, y: 80 } : { x: 160, y: Math.max(...nodes.map((n) => n.position.y)) + 140 };

// --- pure dispatcher ----------------------------------------------------------

const mermaidOf = (d: ProjectDoc): string => generateMermaid(d.nodes, d.edges, d.direction);
const err = (error: string): ApplyResult => ({ doc: null, result: null, error });
const ok = (doc: ProjectDoc, result: unknown): ApplyResult => ({ doc, result, error: null });

/**
 * Apply an MCP request to a diagram document, purely. `doc: null` in the result
 * means read-only (no store write). All-or-nothing: an invalid request returns
 * an error and never a partially-applied document.
 */
export function applyRequest(doc: ProjectDoc, req: DiagramRequest): ApplyResult {
  try {
    const p = record(req.params);
    switch (req.method) {
      case 'get_diagram':
        return { doc: null, result: serializeDoc(doc), error: null };

      case 'set_diagram': {
        if (!isDirection(p.direction)) return err(`invalid direction: ${String(p.direction)}`);
        const rawNodes = Array.isArray(p.nodes) ? p.nodes : [];
        const rawEdges = Array.isArray(p.edges) ? p.edges : [];
        const nodes: FlowNode[] = [];
        for (let i = 0; i < rawNodes.length; i++) {
          const rn = record(rawNodes[i]);
          const pos = readPosition(rn.position) ?? gridPos(i);
          const id = str(rn.id);
          const label = str(rn.label);
          if (str(rn.kind) === 'icon') {
            const src = str(rn.src);
            if (!src) return err('icon node requires a non-empty src');
            nodes.push(buildIconNode({ id, label, title: str(rn.title), src }, pos));
          } else {
            if (rn.shape !== undefined && !isShapeKind(rn.shape))
              return err(`invalid shape: ${String(rn.shape)}`);
            nodes.push(buildShapeNode({ id, label, shape: isShapeKind(rn.shape) ? rn.shape : undefined }, pos));
          }
        }
        const idSet = new Set(nodes.map((n) => n.id));
        const edges: FlowEdge[] = [];
        for (const raw of rawEdges) {
          const re = record(raw);
          const source = str(re.source);
          const target = str(re.target);
          if (!source || !target) return err('edge requires source and target');
          if (!idSet.has(source)) return err(`edge references unknown node ${source}`);
          if (!idSet.has(target)) return err(`edge references unknown node ${target}`);
          if (re.lineStyle !== undefined && !isLineStyle(re.lineStyle))
            return err(`invalid lineStyle: ${String(re.lineStyle)}`);
          edges.push(
            buildEdge({
              id: str(re.id),
              source,
              target,
              label: str(re.label),
              lineStyle: isLineStyle(re.lineStyle) ? re.lineStyle : undefined,
              arrow: bool(re.arrow),
            }),
          );
        }
        const newDoc: ProjectDoc = { version: 1, direction: p.direction, nodes, edges };
        return ok(newDoc, { mermaid: mermaidOf(newDoc) });
      }

      case 'add_node': {
        if (p.shape !== undefined && !isShapeKind(p.shape))
          return err(`invalid shape: ${String(p.shape)}`);
        const pos = readPosition(p.position) ?? belowExisting(doc.nodes);
        const node = buildShapeNode(
          { label: str(p.label), shape: isShapeKind(p.shape) ? p.shape : undefined },
          pos,
        );
        const newDoc: ProjectDoc = { ...doc, nodes: [...doc.nodes, node] };
        return ok(newDoc, { id: node.id, mermaid: mermaidOf(newDoc) });
      }

      case 'add_icon': {
        // `src` is resolved to a data URI by the async listener before dispatch here.
        const src = str(p.src);
        if (!src) return err('add_icon requires a resolved src (data URI)');
        const title = str(p.title) ?? '';
        const pos = readPosition(p.position) ?? belowExisting(doc.nodes);
        const node = buildIconNode({ id: str(p.id), label: str(p.label), title, src }, pos);
        const newDoc: ProjectDoc = { ...doc, nodes: [...doc.nodes, node] };
        return ok(newDoc, { id: node.id, title: node.data.title, source: str(p.source), mermaid: mermaidOf(newDoc) });
      }

      case 'connect': {
        const source = str(p.source);
        const target = str(p.target);
        if (!source || !target) return err('connect requires source and target');
        const ids = new Set(doc.nodes.map((n) => n.id));
        if (!ids.has(source)) return err(`unknown node ${source}`);
        if (!ids.has(target)) return err(`unknown node ${target}`);
        if (p.lineStyle !== undefined && !isLineStyle(p.lineStyle))
          return err(`invalid lineStyle: ${String(p.lineStyle)}`);
        const edge = buildEdge({
          source,
          target,
          label: str(p.label),
          lineStyle: isLineStyle(p.lineStyle) ? p.lineStyle : undefined,
          arrow: bool(p.arrow),
        });
        const newDoc: ProjectDoc = { ...doc, edges: [...doc.edges, edge] };
        return ok(newDoc, { id: edge.id, mermaid: mermaidOf(newDoc) });
      }

      case 'update_node': {
        const id = str(p.id);
        const idx = doc.nodes.findIndex((n) => n.id === id);
        if (idx === -1) return err(`unknown node ${String(p.id)}`);
        const target = doc.nodes[idx];
        const label = str(p.label);
        if (p.shape !== undefined && !isShapeKind(p.shape))
          return err(`invalid shape: ${String(p.shape)}`);
        let next: FlowNode;
        if (target.type === 'shape') {
          const data: ShapeNodeData = {
            ...target.data,
            ...(isShapeKind(p.shape) ? { shape: p.shape } : {}),
            ...(label !== undefined ? { label } : {}),
          };
          next = { ...target, data };
        } else {
          if (p.shape !== undefined) return err(`cannot set shape on icon node ${target.id}`);
          const data: IconNodeData = { ...target.data, ...(label !== undefined ? { label } : {}) };
          next = { ...target, data };
        }
        const nodes = doc.nodes.slice();
        nodes[idx] = next;
        const newDoc: ProjectDoc = { ...doc, nodes };
        return ok(newDoc, { mermaid: mermaidOf(newDoc) });
      }

      case 'delete_node': {
        const id = str(p.id);
        if (!doc.nodes.some((n) => n.id === id)) return err(`unknown node ${String(p.id)}`);
        const nodes = doc.nodes.filter((n) => n.id !== id);
        const edges = doc.edges.filter((e) => e.source !== id && e.target !== id);
        const newDoc: ProjectDoc = { ...doc, nodes, edges };
        return ok(newDoc, { mermaid: mermaidOf(newDoc) });
      }

      case 'set_direction': {
        if (!isDirection(p.direction)) return err(`invalid direction: ${String(p.direction)}`);
        const newDoc: ProjectDoc = { ...doc, direction: p.direction };
        return ok(newDoc, { mermaid: mermaidOf(newDoc) });
      }

      default:
        return err(`unknown method: ${req.method}`);
    }
  } catch (e) {
    return { doc: null, result: null, error: e instanceof Error ? e.message : String(e) };
  }
}

// --- async icon resolution (network I/O — lives outside the pure dispatcher) --

function findIconSource(sourceId: string | undefined): IconSource {
  if (!sourceId) return ICON_SOURCES[0];
  const s = ICON_SOURCES.find((x) => x.id === sourceId);
  if (!s)
    throw new Error(`unknown icon source '${sourceId}' (use: ${ICON_SOURCES.map((x) => x.id).join(', ')})`);
  return s;
}

async function searchIcons(query: string, sourceId: string | undefined, limit = 12) {
  const source = findIconSource(sourceId);
  const results = await source.search(query);
  return results.slice(0, limit).map((r) => ({ source: source.id, id: r.id, title: r.title }));
}

/** Search a source, prefer an exact title match, and inline the SVG as a data URI. */
async function resolveIcon(query: string, sourceId: string | undefined) {
  const source = findIconSource(sourceId);
  const results = await source.search(query);
  if (results.length === 0) throw new Error(`no icon found for '${query}' in source '${source.id}'`);
  const q = query.trim().toLowerCase();
  const chosen = results.find((r) => r.title.toLowerCase() === q) ?? results[0];
  return { src: await iconToDataUri(source, chosen), title: chosen.title, source: source.id };
}

/**
 * Dispatch a request against the current doc. Icon tools need async network I/O
 * (search + SVG inline), so they resolve here and hand a fully-resolved `src` to
 * the pure `applyRequest`; every other method stays pure.
 */
async function dispatchAsync(doc: ProjectDoc, method: string, params: unknown): Promise<ApplyResult> {
  const p = record(params);
  try {
    if (method === 'search_icons') {
      const icons = await searchIcons(str(p.query) ?? '', str(p.source));
      return { doc: null, result: { icons }, error: null };
    }
    if (method === 'add_icon') {
      const query = str(p.query);
      if (!query) return err('add_icon requires a query');
      const { src, title, source } = await resolveIcon(query, str(p.source));
      return applyRequest(doc, {
        method: 'add_icon',
        params: { src, title, source, label: str(p.label), position: p.position },
      });
    }
  } catch (e) {
    return { doc: null, result: null, error: e instanceof Error ? e.message : String(e) };
  }
  return applyRequest(doc, { method, params });
}

// --- Tauri glue ---------------------------------------------------------------

/**
 * Mount the bridge: listen for `mcp:request` events from the Rust MCP tools,
 * apply them to the live store, and reply via the `mcp_respond` command.
 * A no-op outside Tauri (e.g. `bun run dev` in a plain browser). Returns an
 * unlisten function.
 */
export async function initMcpBridge(): Promise<() => void> {
  if (!('__TAURI_INTERNALS__' in window)) return () => {};
  const un = await listen<{ id: string; method: string; params: unknown }>(
    'mcp:request',
    async ({ payload }) => {
      const cur = useStore.getState().toDocument();
      const { doc, result, error } = await dispatchAsync(cur, payload.method, payload.params);
      if (doc) useStore.getState().loadDocument(doc);
      await invoke('mcp_respond', { id: payload.id, ok: !error, result, error });
    },
  );
  return un;
}
