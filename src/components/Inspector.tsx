import { useStore } from '../flow/store';
import type { ShapeKind, LineStyle, FlowEdgeData } from '../flow/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

const sectionClass = 'flex flex-col gap-3 border-b p-4';
const titleClass =
  'text-xs font-bold uppercase tracking-wide text-muted-foreground';

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
      <section className={sectionClass}>
        <h2 className={titleClass}>Icono</h2>
        <div className="flex items-center gap-2.5">
          <img
            src={node.data.src}
            alt={node.data.title}
            className="size-10 object-contain"
          />
          <span className="text-sm font-semibold">{node.data.title}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="icon-label">Etiqueta</Label>
          <Input
            id="icon-label"
            value={node.data.label}
            onChange={(e) => updateNode(node.id, { label: e.target.value })}
          />
        </div>
      </section>
    );
  }

  if (node) {
    return (
      <section className={sectionClass}>
        <h2 className={titleClass}>Nodo</h2>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="node-label">Etiqueta</Label>
          <Input
            id="node-label"
            value={node.data.label}
            onChange={(e) => updateNode(node.id, { label: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Forma</Label>
          <Select
            value={node.data.shape}
            onValueChange={(v) => updateNode(node.id, { shape: v as ShapeKind })}
            items={SHAPE_OPTIONS}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHAPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
      <section className={sectionClass}>
        <h2 className={titleClass}>Arista</h2>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edge-label">Etiqueta</Label>
          <Input
            id="edge-label"
            value={data.label}
            onChange={(e) => updateEdge(edge.id, { label: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Estilo de línea</Label>
          <Select
            value={data.lineStyle}
            onValueChange={(v) => updateEdge(edge.id, { lineStyle: v as LineStyle })}
            items={LINE_OPTIONS}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LINE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="edge-arrow"
            checked={data.arrow}
            onCheckedChange={(c) => updateEdge(edge.id, { arrow: c === true })}
          />
          <Label htmlFor="edge-arrow">Flecha</Label>
        </div>
      </section>
    );
  }

  return (
    <section className={sectionClass}>
      <p className="text-sm italic text-muted-foreground">Nada seleccionado</p>
    </section>
  );
}
