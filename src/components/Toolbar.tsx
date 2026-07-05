import { useStore } from '../flow/store';
import type { ShapeKind, Direction } from '../flow/types';
import {
  saveProject,
  openProject,
  exportMermaid,
  exportSvg,
  exportPng,
} from '../io/project';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

const SHAPES: { kind: ShapeKind; label: string }[] = [
  { kind: 'rectangle', label: 'Rectángulo' },
  { kind: 'rounded', label: 'Redondeado' },
  { kind: 'stadium', label: 'Estadio' },
  { kind: 'subroutine', label: 'Subrutina' },
  { kind: 'circle', label: 'Círculo' },
  { kind: 'decision', label: 'Decisión' },
];

const DIRECTIONS: Direction[] = ['TD', 'LR', 'BT', 'RL'];

const groupLabel =
  'text-xs font-semibold uppercase tracking-wide text-muted-foreground';

export function Toolbar() {
  const addNode = useStore((s) => s.addNode);
  const direction = useStore((s) => s.direction);
  const setDirection = useStore((s) => s.setDirection);
  const loadSample = useStore((s) => s.loadSample);
  const setSidebarTab = useStore((s) => s.setSidebarTab);

  return (
    <header className="flex flex-wrap items-center gap-3 border-b bg-background px-3 py-2">
      <div className="flex items-center gap-1.5">
        <span className={`mr-1 ${groupLabel}`}>Añadir</span>
        {SHAPES.map(({ kind, label }) => (
          <Button
            key={kind}
            variant="outline"
            size="sm"
            onClick={() => addNode(kind)}
          >
            {label}
          </Button>
        ))}
        <Button variant="outline" size="sm" onClick={() => setSidebarTab('icons')}>
          Icono
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      <div className="flex items-center gap-1.5">
        <span className={groupLabel}>Dirección</span>
        <Select
          value={direction}
          onValueChange={(v) => setDirection(v as Direction)}
        >
          <SelectTrigger size="sm" className="w-[74px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DIRECTIONS.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator orientation="vertical" className="h-6" />

      <Button variant="outline" size="sm" onClick={loadSample}>
        Ejemplo
      </Button>

      <div className="ml-auto flex items-center gap-1.5">
        <Button size="sm" onClick={saveProject}>
          Guardar
        </Button>
        <Button variant="outline" size="sm" onClick={openProject}>
          Abrir
        </Button>
        <Button variant="outline" size="sm" onClick={exportMermaid}>
          .mmd
        </Button>
        <Button variant="outline" size="sm" onClick={exportSvg}>
          SVG
        </Button>
        <Button variant="outline" size="sm" onClick={exportPng}>
          PNG
        </Button>
      </div>
    </header>
  );
}
