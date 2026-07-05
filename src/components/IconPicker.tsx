import { useEffect, useState } from 'react';
import { useStore } from '../flow/store';
import { ICON_SOURCES, iconToDataUri, type IconResult } from '../io/icons';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';

export function IconPicker() {
  const addIcon = useStore((s) => s.addIcon);
  const setSidebarTab = useStore((s) => s.setSidebarTab);

  const [sourceId, setSourceId] = useState(ICON_SOURCES[0].id);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<IconResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  const source = ICON_SOURCES.find((s) => s.id === sourceId) ?? ICON_SOURCES[0];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = setTimeout(
      () => {
        source
          .search(query)
          .then((list) => {
            if (!cancelled) {
              setResults(list);
              setLoading(false);
            }
          })
          .catch((e: unknown) => {
            if (!cancelled) {
              setError(e instanceof Error ? e.message : String(e));
              setResults([]);
              setLoading(false);
            }
          });
      },
      query ? 300 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, sourceId, source]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarTab('diagram');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setSidebarTab]);

  const choose = async (icon: IconResult) => {
    setAdding(icon.id);
    setError(null);
    try {
      const src = await iconToDataUri(source, icon);
      addIcon({ title: icon.title, src });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-col gap-2.5 border-b p-3.5">
        <Tabs value={sourceId} onValueChange={(v) => setSourceId(v as string)}>
          <TabsList>
            {ICON_SOURCES.map((s) => (
              <TabsTrigger key={s.id} value={s.id}>
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Input
          placeholder={`Buscar en ${source.label}…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {error && (
        <div className="mx-3.5 mt-3 rounded-md border border-destructive/50 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <p className="p-8 text-center text-muted-foreground">Cargando…</p>
      ) : results.length === 0 ? (
        <p className="p-8 text-center text-muted-foreground">
          {query ? 'Sin resultados.' : 'Escribe para buscar.'}
        </p>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-2 overflow-y-auto p-3.5">
          {results.map((icon) => (
            <button
              key={icon.id}
              className="flex flex-col items-center gap-1.5 rounded-lg border bg-card p-3 transition-colors hover:border-primary hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
              title={icon.title}
              disabled={adding !== null}
              onClick={() => choose(icon)}
            >
              <img
                className="size-10 object-contain"
                src={icon.previewUrl}
                alt={icon.title}
                loading="lazy"
              />
              <span className="max-w-full truncate text-center text-[11px] text-muted-foreground">
                {icon.title}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
