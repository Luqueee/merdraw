import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FlowNode } from './types';

export function ShapeNode({ data, selected }: NodeProps<FlowNode>) {
  return (
    <div className={`shape shape--${data.shape}${selected ? ' shape--selected' : ''}`}>
      <Handle type="target" position={Position.Top} />
      <span className="shape__label">{data.label || ' '}</span>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
