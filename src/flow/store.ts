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
  FlowNodeData,
  FlowEdgeData,
  Direction,
  ShapeKind,
  ProjectDoc,
} from './types';

let seq = 0;
const nextId = () => `node_${Date.now()}_${seq++}`;

function edgeVisuals(data: FlowEdgeData) {
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
  updateNode: (id: string, patch: Partial<FlowNodeData>) => void;
  updateEdge: (id: string, patch: Partial<FlowEdgeData>) => void;
  setDirection: (d: Direction) => void;
  select: (nodeId: string | null, edgeId: string | null) => void;
  toDocument: () => ProjectDoc;
  loadDocument: (doc: ProjectDoc) => void;
};

export const useStore = create<Store>((set, get) => ({
  nodes: [],
  edges: [],
  direction: 'TD',
  selectedNodeId: null,
  selectedEdgeId: null,
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
  updateNode: (id, patch) =>
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...patch } } : n,
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
}));
