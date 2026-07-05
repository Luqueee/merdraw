import { useEffect, useState } from 'react';
import { useStore } from '../flow/store';
import { ICON_SOURCES, iconToDataUri, type IconResult } from '../io/icons';

export function IconPicker() {
  const open = useStore((s) => s.iconPickerOpen);
  const setOpen = useStore((s) => s.setIconPickerOpen);
  const addIcon = useStore((s) => s.addIcon);

  const [sourceId, setSourceId] = useState(ICON_SOURCES[0].id);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<IconResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  const source = ICON_SOURCES.find((s) => s.id === sourceId) ?? ICON_SOURCES[0];

  useEffect(() => {
    if (!open) return;
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
  }, [open, query, sourceId, source]);

  if (!open) return null;

  const choose = async (icon: IconResult) => {
    setAdding(icon.id);
    setError(null);
    try {
      const src = await iconToDataUri(source, icon);
      addIcon({ title: icon.title, src });
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
          <div className="picker__tabs">
            {ICON_SOURCES.map((s) => (
              <button
                key={s.id}
                className={`picker__tab${s.id === sourceId ? ' picker__tab--active' : ''}`}
                onClick={() => setSourceId(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="picker__searchrow">
            <input
              className="input picker__search"
              placeholder={`Buscar en ${source.label}…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <button className="btn" onClick={() => setOpen(false)}>
              Cerrar
            </button>
          </div>
        </div>

        {error && <div className="picker__error">{error}</div>}

        {loading ? (
          <p className="picker__msg">Cargando…</p>
        ) : results.length === 0 ? (
          <p className="picker__msg">{query ? 'Sin resultados.' : 'Escribe para buscar.'}</p>
        ) : (
          <div className="picker__grid">
            {results.map((icon) => (
              <button
                key={icon.id}
                className="picker__item"
                title={icon.title}
                disabled={adding !== null}
                onClick={() => choose(icon)}
              >
                <img
                  className="picker__icon"
                  src={icon.previewUrl}
                  alt={icon.title}
                  loading="lazy"
                />
                <span className="picker__name">{icon.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
