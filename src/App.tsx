import { ReactFlowProvider } from '@xyflow/react';
import { FlowCanvas } from './flow/FlowCanvas';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import '@xyflow/react/dist/style.css';
import './index.css';

export default function App() {
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
