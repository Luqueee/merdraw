import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../flow/store';
import { generateMermaid } from '../mermaid/generate';
import { renderMermaid } from '../mermaid/render';
import { Button } from '@/components/ui/button';

const titleClass =
  'text-xs font-bold uppercase tracking-wide text-muted-foreground';

export function MermaidPanel() {
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const direction = useStore((s) => s.direction);

  const code = useMemo(
    () => generateMermaid(nodes, edges, direction),
    [nodes, edges, direction],
  );
  const empty = nodes.length === 0;

  const [svg, setSvg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (empty) {
      setSvg('');
      setError(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      renderMermaid(code)
        .then((res) => {
          if (!cancelled) {
            setSvg(res.svg);
            setError(null);
          }
        })
        .catch((e: unknown) => {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : String(e));
          }
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code, empty]);

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="border-b p-4">
        <h2 className={`mb-2 ${titleClass}`}>Vista previa</h2>
        {empty ? (
          <p className="text-sm italic text-muted-foreground">
            Añade nodos para ver el diagrama.
          </p>
        ) : error ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2.5 font-mono text-xs whitespace-pre-wrap text-destructive">
            {error}
          </div>
        ) : (
          <div
            className="flex justify-center overflow-auto rounded-md border bg-muted/40 p-2 [&_svg]:h-auto [&_svg]:max-w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}
      </div>

      <div className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className={titleClass}>Mermaid</h2>
          <Button variant="outline" size="xs" onClick={copy}>
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
        <pre className="overflow-x-auto rounded-md bg-neutral-900 p-3 font-mono text-xs whitespace-pre text-neutral-100">
          {code}
        </pre>
      </div>
    </section>
  );
}
