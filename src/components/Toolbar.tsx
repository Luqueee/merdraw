import { useStore } from '../flow/store';
import type { ShapeKind, Direction } from '../flow/types';
import {
  saveProject,
  openProject,
  exportMermaid,
  exportSvg,
  exportPng,
} from '../io/project';

const SHAPES: { kind: ShapeKind; label: string }[] = [
  { kind: 'rectangle', label: 'Rectángulo' },
  { kind: 'rounded', label: 'Redondeado' },
  { kind: 'stadium', label: 'Estadio' },
  { kind: 'subroutine', label: 'Subrutina' },
  { kind: 'circle', label: 'Círculo' },
  { kind: 'decision', label: 'Decisión' },
];

const DIRECTIONS: Direction[] = ['TD', 'LR', 'BT', 'RL'];

export function Toolbar() {
  const addNode = useStore((s) => s.addNode);
  const direction = useStore((s) => s.direction);
  const setDirection = useStore((s) => s.setDirection);

  return (
    <header className="toolbar">
      <div className="toolbar__group">
        <span className="toolbar__label">Añadir</span>
        {SHAPES.map(({ kind, label }) => (
          <button key={kind} className="btn" onClick={() => addNode(kind)}>
            {label}
          </button>
        ))}
      </div>

      <div className="toolbar__group">
        <label className="toolbar__label" htmlFor="direction">
          Dirección
        </label>
        <select
          id="direction"
          className="select"
          value={direction}
          onChange={(e) => setDirection(e.target.value as Direction)}
        >
          {DIRECTIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <div className="toolbar__group toolbar__group--right">
        <button className="btn btn--primary" onClick={saveProject}>
          Guardar
        </button>
        <button className="btn" onClick={openProject}>
          Abrir
        </button>
        <button className="btn" onClick={exportMermaid}>
          .mmd
        </button>
        <button className="btn" onClick={exportSvg}>
          SVG
        </button>
        <button className="btn" onClick={exportPng}>
          PNG
        </button>
      </div>
    </header>
  );
}
