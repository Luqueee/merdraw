import { useEffect, useState } from 'react';
import { useStore } from '../flow/store';
import { fetchIcons, fetchSvgDataUri, type SvglEntry } from '../io/svgl';

export function IconPicker() {
  const open = useStore((s) => s.iconPickerOpen);
  const setOpen = useStore((s) => s.setIconPickerOpen);
  const addIcon = useStore((s) => s.addIcon);

  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<SvglEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = setTimeout(
      () => {
        fetchIcons(query)
          .then((list) => {
            if (!cancelled) {
              setEntries(list);
              setLoading(false);
            }
          })
          .catch((e: unknown) => {
            if (!cancelled) {
              setError(e instanceof Error ? e.message : String(e));
              setEntries([]);
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
  }, [open, query]);

  if (!open) return null;

  const choose = async (entry: SvglEntry) => {
    setAdding(entry.id);
    setError(null);
    try {
      const src = await fetchSvgDataUri(entry.route);
      addIcon({ title: entry.title, src });
      setQuery('');
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="picker-overlay" onClick={() => setOpen(false)}>
      <div className="picker" onClick={(e) => e.stopPropagation()}>
        <div className="picker__head">
          <input
            className="input picker__search"
            placeholder="Buscar iconos en svgl.app…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button className="btn" onClick={() => setOpen(false)}>
            Cerrar
          </button>
        </div>

        {error && <div className="picker__error">{error}</div>}

        {loading ? (
          <p className="picker__msg">Cargando…</p>
        ) : entries.length === 0 ? (
          <p className="picker__msg">Sin resultados.</p>
        ) : (
          <div className="picker__grid">
            {entries.map((entry) => {
              const preview =
                typeof entry.route === 'string' ? entry.route : entry.route.light;
              return (
                <button
                  key={entry.id}
                  className="picker__item"
                  title={entry.title}
                  disabled={adding !== null}
                  onClick={() => choose(entry)}
                >
                  <img
                    className="picker__icon"
                    src={preview}
                    alt={entry.title}
                    loading="lazy"
                  />
                  <span className="picker__name">{entry.title}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
