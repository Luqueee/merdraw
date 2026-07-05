import { create } from 'zustand';
import {
  addEdge,
  reconnectEdge,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type OnReconnect,
} from '@xyflow/react';
import type {
  FlowNode,
  FlowEdge,
  ShapeNodeData,
  FlowEdgeData,
  Direction,
  ShapeKind,
  ProjectDoc,
} from './types';

export type SidebarTab = 'diagram' | 'icons';

let seq = 0;
export const nextId = (prefix = 'node') => `${prefix}_${Date.now()}_${seq++}`;

export function edgeVisuals(data: FlowEdgeData) {
  const style =
    data.lineStyle === 'dotted'
      ? { strokeDasharray: '6 4' }
      : data.lineStyle === 'thick'
        ? { strokeWidth: 3 }
        : {};
  return {
    label: data.label || undefined,
    markerEnd: data.arrow ? { type: MarkerType.ArrowClosed } : undefined,
    style,
  };
}

type Store = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  direction: Direction;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onNodesChange: OnNodesChange<FlowNode>;
  onEdgesChange: OnEdgesChange<FlowEdge>;
  onConnect: OnConnect;
  onReconnect: OnReconnect<FlowEdge>;
  addNode: (shape?: ShapeKind) => void;
  addIcon: (icon: { title: string; src: string }) => void;
  updateNode: (id: string, patch: Partial<ShapeNodeData>) => void;
  updateEdge: (id: string, patch: Partial<FlowEdgeData>) => void;
  setDirection: (d: Direction) => void;
  select: (nodeId: string | null, edgeId: string | null) => void;
  toDocument: () => ProjectDoc;
  loadDocument: (doc: ProjectDoc) => void;
  loadSample: () => void;
  sidebarTab: SidebarTab;
  setSidebarTab: (tab: SidebarTab) => void;
};

export const useStore = create<Store>((set, get) => ({
  nodes: [],
  edges: [],
  direction: 'TD',
  selectedNodeId: null,
  selectedEdgeId: null,
  sidebarTab: 'diagram',
  onNodesChange: (c) => set({ nodes: applyNodeChanges(c, get().nodes) }),
  onEdgesChange: (c) => set({ edges: applyEdgeChanges(c, get().edges) }),
  onConnect: (conn) => {
    const data: FlowEdgeData = { label: '', lineStyle: 'solid', arrow: true };
    set({ edges: addEdge({ ...conn, data, ...edgeVisuals(data) }, get().edges) });
  },
  onReconnect: (oldEdge, newConnection) =>
    set({
      edges: reconnectEdge(oldEdge, newConnection, get().edges, { shouldReplaceId: false }),
    }),
  addNode: (shape = 'rectangle') =>
    set({
      nodes: [
        ...get().nodes,
        {
          id: nextId(),
          type: 'shape',
          position: { x: 120 + Math.random() * 240, y: 80 + Math.random() * 240 },
          data: { label: 'Nodo', shape },
        },
      ],
    }),
  addIcon: (icon) =>
    set({
      nodes: [
        ...get().nodes,
        {
          id: nextId(),
          type: 'icon',
          position: { x: 120 + Math.random() * 240, y: 80 + Math.random() * 240 },
          data: { label: icon.title, title: icon.title, src: icon.src },
        },
      ],
    }),
  updateNode: (id, patch) =>
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? ({ ...n, data: { ...n.data, ...patch } } as FlowNode) : n,
      ),
    }),
  updateEdge: (id, patch) =>
    set({
      edges: get().edges.map((e) => {
        if (e.id !== id) return e;
        const data = { ...(e.data as FlowEdgeData), ...patch };
        return { ...e, data, ...edgeVisuals(data) };
      }),
    }),
  setDirection: (direction) => set({ direction }),
  select: (selectedNodeId, selectedEdgeId) => set({ selectedNodeId, selectedEdgeId }),
  setSidebarTab: (sidebarTab) => set({ sidebarTab }),
  toDocument: () => ({
    version: 1,
    direction: get().direction,
    nodes: get().nodes,
    edges: get().edges,
  }),
  loadDocument: (doc) =>
    set({
      nodes: doc.nodes,
      edges: doc.edges,
      direction: doc.direction,
      selectedNodeId: null,
      selectedEdgeId: null,
    }),
  loadSample: () => {
    const node = (
      id: string,
      shape: ShapeKind,
      label: string,
      x: number,
      y: number,
    ): FlowNode => ({ id, type: 'shape', position: { x, y }, data: { label, shape } });
    const edge = (
      id: string,
      source: string,
      target: string,
      data: FlowEdgeData,
    ): FlowEdge => ({ id, source, target, data, ...edgeVisuals(data) });
    set({
      direction: 'TD',
      selectedNodeId: null,
      selectedEdgeId: null,
      nodes: [
        node('s1', 'stadium', 'Inicio', 320, 20),
        node('s2', 'rectangle', 'Procesar datos', 300, 140),
        node('s3', 'decision', '¿Es válido?', 320, 260),
        node('s4', 'rectangle', 'Guardar', 150, 420),
        node('s5', 'rectangle', 'Mostrar error', 470, 420),
        node('s6', 'stadium', 'Fin', 150, 540),
      ],
      edges: [
        edge('e1', 's1', 's2', { label: '', lineStyle: 'solid', arrow: true }),
        edge('e2', 's2', 's3', { label: '', lineStyle: 'solid', arrow: true }),
        edge('e3', 's3', 's4', { label: 'Sí', lineStyle: 'solid', arrow: true }),
        edge('e4', 's3', 's5', { label: 'No', lineStyle: 'dotted', arrow: true }),
        edge('e5', 's4', 's6', { label: '', lineStyle: 'solid', arrow: true }),
        edge('e6', 's5', 's2', { label: 'reintentar', lineStyle: 'thick', arrow: true }),
      ],
    });
  },
}));
