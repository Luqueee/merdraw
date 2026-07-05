import { ReactFlowProvider } from '@xyflow/react';
import { FlowCanvas } from './flow/FlowCanvas';
import { Toolbar } from './components/Toolbar';
import { Inspector } from './components/Inspector';
import { MermaidPanel } from './components/MermaidPanel';
import { IconPicker } from './components/IconPicker';
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
        <aside className="sidebar">
          <Inspector />
          <MermaidPanel />
        </aside>
        <IconPicker />
      </div>
    </div>
  );
}
