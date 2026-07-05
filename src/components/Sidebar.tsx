import { useStore } from '../flow/store';
import { Inspector } from './Inspector';
import { MermaidPanel } from './MermaidPanel';
import { IconPicker } from './IconPicker';

export function Sidebar() {
  const tab = useStore((s) => s.sidebarTab);
  const setTab = useStore((s) => s.setSidebarTab);

  return (
    <aside className="sidebar">
      <div className="sidebar__tabs">
        <button
          className={`sidebar__tab${tab === 'diagram' ? ' sidebar__tab--active' : ''}`}
          onClick={() => setTab('diagram')}
        >
          Diagrama
        </button>
        <button
          className={`sidebar__tab${tab === 'icons' ? ' sidebar__tab--active' : ''}`}
          onClick={() => setTab('icons')}
        >
          Iconos
        </button>
      </div>

      {tab === 'diagram' ? (
        <div className="sidebar__body">
          <Inspector />
          <MermaidPanel />
        </div>
      ) : (
        <IconPicker />
      )}
    </aside>
  );
}
