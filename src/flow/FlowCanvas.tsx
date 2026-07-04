import { ReactFlow, Background, BackgroundVariant, Controls, MiniMap } from '@xyflow/react';
import { nodeTypes } from './nodeTypes';
import { useStore } from './store';

export function FlowCanvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, onReconnect, select } =
    useStore();
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onReconnect={onReconnect}
      nodeTypes={nodeTypes}
      onNodeClick={(_, n) => select(n.id, null)}
      onEdgeClick={(_, e) => select(null, e.id)}
      onPaneClick={() => select(null, null)}
      fitView
    >
      <Background variant={BackgroundVariant.Dots} gap={16} />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}
