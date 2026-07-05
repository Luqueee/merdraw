import { useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { FlowCanvas } from './flow/FlowCanvas';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { initMcpBridge } from './mcp/bridge';
import '@xyflow/react/dist/style.css';
import './index.css';

export default function App() {
  useEffect(() => {
    let un: (() => void) | undefined;
    let cancelled = false;
    // initMcpBridge is async; under StrictMode the effect mounts twice. If we
    // unmount before it resolves, unlisten as soon as it does — otherwise a
    // leaked duplicate listener applies every AI edit twice.
    initMcpBridge().then((f) => {
      if (cancelled) f();
      else un = f;
    });
    return () => {
      cancelled = true;
      un?.();
    };
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <ReactFlowProvider>
          <div className="h-full min-w-0 flex-1">
            <FlowCanvas />
          </div>
        </ReactFlowProvider>
        <Sidebar />
      </div>
    </div>
  );
}
