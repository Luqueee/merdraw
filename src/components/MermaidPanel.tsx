import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../flow/store';
import { generateMermaid } from '../mermaid/generate';
import { renderMermaid } from '../mermaid/render';

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
    <section className="panel">
      <div className="panel__section">
        <h2 className="panel__title">Vista previa</h2>
        {empty ? (
          <p className="panel__empty">Añade nodos para ver el diagrama.</p>
        ) : error ? (
          <div className="panel__error">{error}</div>
        ) : (
          <div className="panel__preview" dangerouslySetInnerHTML={{ __html: svg }} />
        )}
      </div>

      <div className="panel__section">
        <div className="panel__header">
          <h2 className="panel__title">Mermaid</h2>
          <button className="btn btn--sm" onClick={copy}>
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <pre className="panel__code">{code}</pre>
      </div>
    </section>
  );
}
