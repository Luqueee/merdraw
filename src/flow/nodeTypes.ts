// Must live at module level (outside any render) or React Flow remounts
// the nodes on every render.
import type { NodeTypes } from '@xyflow/react';
import { ShapeNode } from './ShapeNode';

export const nodeTypes: NodeTypes = { shape: ShapeNode };
