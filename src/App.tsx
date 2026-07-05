import { ReactFlowProvider } from '@xyflow/react';
import { FlowCanvas } from './flow/FlowCanvas';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import '@xyflow/react/dist/style.css';
import './index.css';

export default function App() {
  return (
    <div className="app">
      <Toolbar />
      <div className="app__body">
        <ReactFlowProvider>
          <div className="canvas">
            <FlowCanvas />
          </div>
        </ReactFlowProvider>
        <Sidebar />
      </div>
    </div>
  );
}
