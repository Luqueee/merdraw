import type { Node, Edge } from '@xyflow/react';

export type Direction = 'TD' | 'LR' | 'BT' | 'RL';
export type ShapeKind =
  | 'rectangle'
  | 'rounded'
  | 'stadium'
  | 'subroutine'
  | 'circle'
  | 'decision';
export type LineStyle = 'solid' | 'dotted' | 'thick';

export type FlowNodeData = { label: string; shape: ShapeKind };
export type FlowEdgeData = { label: string; lineStyle: LineStyle; arrow: boolean };

export type FlowNode = Node<FlowNodeData, 'shape'>;
export type FlowEdge = Edge<FlowEdgeData>;

export type ProjectDoc = {
  version: 1;
  direction: Direction;
  nodes: FlowNode[];
  edges: FlowEdge[];
};
