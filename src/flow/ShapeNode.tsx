import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ShapeFlowNode } from './types';

export function ShapeNode({ data, selected }: NodeProps<ShapeFlowNode>) {
  return (
    <div className={`shape shape--${data.shape}${selected ? ' shape--selected' : ''}`}>
      <Handle type="target" position={Position.Top} />
      <span className="shape__label">{data.label || ' '}</span>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
