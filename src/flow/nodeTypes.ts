// Must live at module level (outside any render) or React Flow remounts
// the nodes on every render.
import type { NodeTypes } from '@xyflow/react';
import { ShapeNode } from './ShapeNode';
import { IconNode } from './IconNode';

export const nodeTypes: NodeTypes = { shape: ShapeNode, icon: IconNode };
