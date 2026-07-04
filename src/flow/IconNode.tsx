import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { IconFlowNode } from './types';

export function IconNode({ data, selected }: NodeProps<IconFlowNode>) {
  return (
    <div
      className={`icon-node${selected ? ' icon-node--selected' : ''}`}
      title={data.title}
    >
      <Handle type="target" position={Position.Top} />
      <img className="icon-node__img" src={data.src} alt={data.title} draggable={false} />
      {data.label ? <span className="icon-node__label">{data.label}</span> : null}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
