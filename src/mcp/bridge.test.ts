import { describe, it, expect } from 'vitest';
import { applyRequest, type NodeContract, type EdgeContract } from './bridge';
import type { ProjectDoc, ShapeFlowNode, IconFlowNode, FlowEdge } from '../flow/types';

// --- typed fixtures -----------------------------------------------------------

/** 2 shape nodes + 1 edge (a -> b), direction TD. */
function makeDoc(): ProjectDoc {
  const a: ShapeFlowNode = {
    id: 'a',
    type: 'shape',
    position: { x: 0, y: 0 },
    data: { label: 'A', shape: 'rectangle' },
  };
  const b: ShapeFlowNode = {
    id: 'b',
    type: 'shape',
    position: { x: 200, y: 0 },
    data: { label: 'B', shape: 'decision' },
  };
  const edge: FlowEdge = {
    id: 'e1',
    source: 'a',
    target: 'b',
    data: { label: '', lineStyle: 'solid', arrow: true },
  };
  return { version: 1, direction: 'TD', nodes: [a, b], edges: [edge] };
}

/** Single icon node, no edges. */
function makeIconDoc(): ProjectDoc {
  const icon: IconFlowNode = {
    id: 'ic',
    type: 'icon',
    position: { x: 0, y: 0 },
    data: { label: 'Icon', title: 'Icon', src: 'data:image/svg+xml;base64,PHN2Zy8+' },
  };
  return { version: 1, direction: 'TD', nodes: [icon], edges: [] };
}

// --- named result shapes (applyRequest values tsc merely widened to `unknown`) -

type GetDiagramResult = {
  mermaid: string;
  direction: string;
  nodes: NodeContract[];
  edges: EdgeContract[];
};
type WriteResult = { mermaid: string };
type AddResult = { id: string; mermaid: string };
type AddIconResult = { id: string; title: string; source?: string; mermaid: string };

/** Asserts a write succeeded and narrows `ProjectDoc | null` -> `ProjectDoc`. */
function expectDoc(doc: ProjectDoc | null): ProjectDoc {
  expect(doc).not.toBeNull();
  if (doc === null) throw new Error('expected a document, got null');
  return doc;
}

// --- required plan cases ------------------------------------------------------

describe('applyRequest — required cases', () => {
  it('(a) get_diagram is read-only and serializes both nodes', () => {
    const { doc, result, error } = applyRequest(makeDoc(), { method: 'get_diagram', params: {} });
    expect(doc).toBeNull();
    expect(error).toBeNull();
    // applyRequest returns serializeDoc(doc) on the get_diagram branch
    const r: GetDiagramResult = result as GetDiagramResult;
    expect(r.nodes).toHaveLength(2);
    for (const n of r.nodes) expect(n.id).toBeTruthy();
    expect(r.mermaid.startsWith('flowchart TD')).toBe(true);
  });

  it('(b) set_diagram with an edge to an absent node id applies nothing', () => {
    const { doc, error } = applyRequest(makeDoc(), {
      method: 'set_diagram',
      params: {
        direction: 'TD',
        nodes: [{ id: 'x', kind: 'shape', label: 'X' }],
        edges: [{ source: 'x', target: 'missing' }],
      },
    });
    expect(doc).toBeNull();
    expect(typeof error).toBe('string');
    expect(error).toBeTruthy();
  });

  it('(c) connect between two existing ids produces an edge carrying markerEnd', () => {
    const { doc, result, error } = applyRequest(makeDoc(), {
      method: 'connect',
      params: { source: 'a', target: 'b' },
    });
    expect(error).toBeNull();
    const newDoc = expectDoc(doc);
    // connect returns { id, mermaid } on success
    const r: AddResult = result as AddResult;
    const created = newDoc.edges.find((e) => e.id === r.id);
    expect(created).toBeDefined();
    expect(created?.markerEnd).toBeDefined();
  });

  it('(d) delete_node removes the node and every incident edge', () => {
    const { doc, error } = applyRequest(makeDoc(), {
      method: 'delete_node',
      params: { id: 'a' },
    });
    expect(error).toBeNull();
    const newDoc = expectDoc(doc);
    expect(newDoc.nodes.some((n) => n.id === 'a')).toBe(false);
    expect(newDoc.nodes).toHaveLength(1);
    expect(newDoc.edges.some((e) => e.source === 'a' || e.target === 'a')).toBe(false);
    expect(newDoc.edges).toHaveLength(0);
  });
});

// --- high-value cases ---------------------------------------------------------

describe('applyRequest — high-value cases', () => {
  it('set_diagram happy path assigns finite positions when omitted', () => {
    const { doc, result, error } = applyRequest(makeDoc(), {
      method: 'set_diagram',
      params: {
        direction: 'LR',
        nodes: [
          { id: 'x', kind: 'shape', label: 'X' },
          { id: 'y', kind: 'shape', label: 'Y' },
        ],
        edges: [{ source: 'x', target: 'y' }],
      },
    });
    expect(error).toBeNull();
    const newDoc = expectDoc(doc);
    expect(newDoc.direction).toBe('LR');
    expect(newDoc.nodes).toHaveLength(2);
    expect(newDoc.edges).toHaveLength(1);
    for (const n of newDoc.nodes) {
      expect(Number.isFinite(n.position.x)).toBe(true);
      expect(Number.isFinite(n.position.y)).toBe(true);
    }
    // set_diagram returns { mermaid } on success
    const r: WriteResult = result as WriteResult;
    expect(r.mermaid.startsWith('flowchart LR')).toBe(true);
  });

  it('set_diagram with an invalid direction is rejected', () => {
    const { doc, error } = applyRequest(makeDoc(), {
      method: 'set_diagram',
      params: { direction: 'XX', nodes: [], edges: [] },
    });
    expect(doc).toBeNull();
    expect(error).toContain('XX');
  });

  it('add_node returns a generated id and appends a matching node', () => {
    const before = makeDoc();
    const { doc, result, error } = applyRequest(before, {
      method: 'add_node',
      params: { label: 'New' },
    });
    expect(error).toBeNull();
    const newDoc = expectDoc(doc);
    // add_node returns { id, mermaid } on success
    const r: AddResult = result as AddResult;
    expect(r.id).toBeTruthy();
    expect(newDoc.nodes).toHaveLength(before.nodes.length + 1);
    const added = newDoc.nodes.find((n) => n.id === r.id);
    expect(added).toBeDefined();
    expect(added?.data.label).toBe('New');
  });

  it('update_node with a missing id is rejected', () => {
    const { doc, error } = applyRequest(makeDoc(), {
      method: 'update_node',
      params: { id: 'nonexistent', label: 'Z' },
    });
    expect(doc).toBeNull();
    expect(error).toContain('nonexistent');
  });

  it('update_node cannot set a shape on an icon node', () => {
    const { doc, error } = applyRequest(makeIconDoc(), {
      method: 'update_node',
      params: { id: 'ic', shape: 'circle' },
    });
    expect(doc).toBeNull();
    expect(error).toContain('icon');
  });

  it('update_node changes a shape node label', () => {
    const { doc, error } = applyRequest(makeDoc(), {
      method: 'update_node',
      params: { id: 'a', label: 'Renamed' },
    });
    expect(error).toBeNull();
    const newDoc = expectDoc(doc);
    const updated = newDoc.nodes.find((n) => n.id === 'a');
    expect(updated?.data.label).toBe('Renamed');
  });

  it('connect to a missing id is rejected', () => {
    const { doc, error } = applyRequest(makeDoc(), {
      method: 'connect',
      params: { source: 'a', target: 'ghost' },
    });
    expect(doc).toBeNull();
    expect(error).toContain('ghost');
  });

  it('unknown method is rejected and names the method', () => {
    const { doc, result, error } = applyRequest(makeDoc(), {
      method: 'frobnicate',
      params: {},
    });
    expect(doc).toBeNull();
    expect(result).toBeNull();
    expect(error).toContain('frobnicate');
  });
});

// --- add_icon (pure branch: expects an already-resolved data-URI src) ---------

describe('applyRequest — add_icon', () => {
  const SRC = 'data:image/svg+xml;base64,PHN2Zy8+';

  it('(1) appends an icon node from a resolved src and returns { id, title, source, mermaid }', () => {
    const before = makeDoc();
    const { doc, result, error } = applyRequest(before, {
      method: 'add_icon',
      params: { src: SRC, title: 'Star', source: 'lucide' },
    });
    expect(error).toBeNull();
    const newDoc = expectDoc(doc);
    // add_icon returns { id, title, source, mermaid } on success
    const r: AddIconResult = result as AddIconResult;
    expect(r.id).toBeTruthy();
    expect(r.title).toBe('Star');
    expect(r.source).toBe('lucide');
    expect(r.mermaid).toContain('@{ img:');
    expect(r.mermaid).toContain(SRC);

    expect(newDoc.nodes).toHaveLength(before.nodes.length + 1);
    const added = newDoc.nodes.find((n) => n.id === r.id);
    expect(added).toBeDefined();
    // discriminated-union narrowing: src/title live only on icon-kind FlowNode data
    if (added?.type !== 'icon') throw new Error('expected an appended icon node');
    expect(added.data.src).toBe(SRC);
    expect(added.data.title).toBe('Star');
  });

  it('(2) label overrides the caption used for the icon label', () => {
    const { doc, error } = applyRequest(makeDoc(), {
      method: 'add_icon',
      params: { src: SRC, title: 'Star', label: 'Favourite' },
    });
    expect(error).toBeNull();
    const newDoc = expectDoc(doc);
    const added = newDoc.nodes.find((n) => n.type === 'icon');
    expect(added).toBeDefined();
    // discriminated-union narrowing to reach IconNodeData (label/title)
    if (added?.type !== 'icon') throw new Error('expected an appended icon node');
    expect(added.data.label).toBe('Favourite');
    expect(added.data.title).toBe('Star');
  });

  it('(3) missing or empty src is rejected with a non-empty error and no document', () => {
    const missing = applyRequest(makeDoc(), { method: 'add_icon', params: { title: 'Star' } });
    expect(missing.doc).toBeNull();
    expect(typeof missing.error).toBe('string');
    expect(missing.error).toBeTruthy();

    const empty = applyRequest(makeDoc(), { method: 'add_icon', params: { src: '' } });
    expect(empty.doc).toBeNull();
    expect(typeof empty.error).toBe('string');
    expect(empty.error).toBeTruthy();
  });

  it('(4) places the node at finite coordinates when position is omitted', () => {
    const { doc, error } = applyRequest(makeDoc(), {
      method: 'add_icon',
      params: { src: SRC, title: 'Star' },
    });
    expect(error).toBeNull();
    const newDoc = expectDoc(doc);
    const added = newDoc.nodes.find((n) => n.type === 'icon');
    expect(added).toBeDefined();
    if (added === undefined) throw new Error('expected an appended icon node');
    expect(Number.isFinite(added.position.x)).toBe(true);
    expect(Number.isFinite(added.position.y)).toBe(true);
  });
});
