import { useStore } from '../flow/store';
import type { ShapeKind, LineStyle, FlowEdgeData } from '../flow/types';

const SHAPE_OPTIONS: { value: ShapeKind; label: string }[] = [
  { value: 'rectangle', label: 'Rectángulo' },
  { value: 'rounded', label: 'Redondeado' },
  { value: 'stadium', label: 'Estadio' },
  { value: 'subroutine', label: 'Subrutina' },
  { value: 'circle', label: 'Círculo' },
  { value: 'decision', label: 'Decisión' },
];

const LINE_OPTIONS: { value: LineStyle; label: string }[] = [
  { value: 'solid', label: 'Sólida' },
  { value: 'dotted', label: 'Punteada' },
  { value: 'thick', label: 'Gruesa' },
];

export function Inspector() {
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const selectedEdgeId = useStore((s) => s.selectedEdgeId);
  const updateNode = useStore((s) => s.updateNode);
  const updateEdge = useStore((s) => s.updateEdge);

  const node = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : undefined;
  const edge = selectedEdgeId ? edges.find((e) => e.id === selectedEdgeId) : undefined;

  if (node && node.type === 'icon') {
    return (
      <section className="inspector">
        <h2 className="inspector__title">Icono</h2>
        <div className="inspector__icon">
          <img src={node.data.src} alt={node.data.title} />
          <span>{node.data.title}</span>
        </div>
        <label className="field">
          <span className="field__label">Etiqueta</span>
          <input
            className="input"
            value={node.data.label}
            onChange={(e) => updateNode(node.id, { label: e.target.value })}
          />
        </label>
      </section>
    );
  }

  if (node) {
    return (
      <section className="inspector">
        <h2 className="inspector__title">Nodo</h2>
        <label className="field">
          <span className="field__label">Etiqueta</span>
          <input
            className="input"
            value={node.data.label}
            onChange={(e) => updateNode(node.id, { label: e.target.value })}
          />
        </label>
        <label className="field">
          <span className="field__label">Forma</span>
          <select
            className="select"
            value={node.data.shape}
            onChange={(e) => updateNode(node.id, { shape: e.target.value as ShapeKind })}
          >
            {SHAPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </section>
    );
  }

  if (edge) {
    const data = (edge.data as FlowEdgeData | undefined) ?? {
      label: '',
      lineStyle: 'solid',
      arrow: true,
    };
    return (
      <section className="inspector">
        <h2 className="inspector__title">Arista</h2>
        <label className="field">
          <span className="field__label">Etiqueta</span>
          <input
            className="input"
            value={data.label}
            onChange={(e) => updateEdge(edge.id, { label: e.target.value })}
          />
        </label>
        <label className="field">
          <span className="field__label">Estilo de línea</span>
          <select
            className="select"
            value={data.lineStyle}
            onChange={(e) => updateEdge(edge.id, { lineStyle: e.target.value as LineStyle })}
          >
            {LINE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field field--row">
          <input
            type="checkbox"
            checked={data.arrow}
            onChange={(e) => updateEdge(edge.id, { arrow: e.target.checked })}
          />
          <span className="field__label">Flecha</span>
        </label>
      </section>
    );
  }

  return (
    <section className="inspector">
      <p className="inspector__empty">Nada seleccionado</p>
    </section>
  );
}
