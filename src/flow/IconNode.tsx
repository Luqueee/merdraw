import { useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import DOMPurify from 'dompurify';
import type { IconFlowNode } from './types';

export function IconNode({ data, selected }: NodeProps<IconFlowNode>) {
  // Inline the SVG as sanitized DOM so it re-vectorizes crisply under React Flow's
  // zoom transform. An <img> would be rasterized at its base size and then scaled
  // as a bitmap by the viewport transform, which looks pixelated when zoomed in.
  const svg = useMemo(() => {
    const match = /^data:image\/svg\+xml;base64,(.+)$/.exec(data.src);
    if (!match) return null;
    try {
      const raw = new TextDecoder().decode(
        Uint8Array.from(atob(match[1]), (c) => c.charCodeAt(0)),
      );
      return DOMPurify.sanitize(raw, { USE_PROFILES: { svg: true, svgFilters: true } });
    } catch {
      return null;
    }
  }, [data.src]);

  return (
    <div
      className={`icon-node${selected ? ' icon-node--selected' : ''}`}
      title={data.title}
    >
      <Handle type="target" position={Position.Top} />
      {svg ? (
        <span className="icon-node__img" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <img className="icon-node__img" src={data.src} alt={data.title} draggable={false} />
      )}
      {data.label ? <span className="icon-node__label">{data.label}</span> : null}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
