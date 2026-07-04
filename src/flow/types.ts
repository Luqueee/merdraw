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

export type ShapeNodeData = { label: string; shape: ShapeKind };
/** `src` is the SVG inlined as a base64 data URI (self-contained, taint-free for PNG export). */
export type IconNodeData = { label: string; title: string; src: string };
export type FlowEdgeData = { label: string; lineStyle: LineStyle; arrow: boolean };

export type ShapeFlowNode = Node<ShapeNodeData, 'shape'>;
export type IconFlowNode = Node<IconNodeData, 'icon'>;
export type FlowNode = ShapeFlowNode | IconFlowNode;
export type FlowEdge = Edge<FlowEdgeData>;

export type ProjectDoc = {
  version: 1;
  direction: Direction;
  nodes: FlowNode[];
  edges: FlowEdge[];
};
