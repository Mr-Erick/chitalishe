import { useMemo, useState } from "react";
import { CATALOG, type CatalogEntry, localCopy, SHELVES, type Shelf } from "../books/catalog";
import type { BookMeta } from "../books/store";
import { formatDuration } from "./format";
import { IconCheck, IconPlus, IconSearch } from "./icons";
import { Plaque, SectionTitle } from "./TabBar";

interface Props {
  books: BookMeta[];
  wpm: number;
  onOpen: (entry: CatalogEntry) => void;
  onAdd: (entry: CatalogEntry) => Promise<void>;
  onOpenLocal: (id: string) => void;
}

/** Бесплатная библиотека: классика из общественного достояния, книги добавляются в «Мои книги» по «+». */
export function Catalog({ books, wpm, onOpen, onAdd, onOpenLocal }: Props) {
  const [query, setQuery] = useState("");
  const [shelf, setShelf] = useState<Shelf | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const shelves = SHELVES.map((s) => ({ ...s, count: CATALOG.filter((e) => e.shelves.includes(s.id)).length })).filter((s) => s.count);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATALOG.filter((e) => (!shelf || e.shelves.includes(shelf)) && (!q || `${e.title} ${e.author}`.toLowerCase().includes(q)));
  }, [query, shelf]);

  const add = async (e: CatalogEntry) => {
    setBusy(e.id);
    setError("");
    try {
      await onAdd(e);
    } catch {
      setError("Не удалось скачать книгу. Проверьте интернет и попробуйте ещё раз.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="app-screen">
      <h1 className="screen-title">Бесплатная библиотека</h1>

      {books.length === 0 && (
        <section className="hello-card">
          <p className="mono-label lime">Привет! Это SPEEDTEXT</p>
          <h2>
            Выбери книгу и <em>читай быстрее</em>
          </h2>
          <p>Вся классика здесь бесплатная. Свои файлы можно добавить во вкладке «Мои книги».</p>
        </section>
      )}

      <div className="strip">
        <b>Общественное достояние</b> // бесплатно
      </div>

      <label className="search-box">
        <IconSearch />
        <input placeholder="Автор или название" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>

      <div className="chips">
        {shelves.map((s) => (
          <button key={s.id} className={shelf === s.id ? "on" : ""} onClick={() => setShelf(shelf === s.id ? null : s.id)}>
            {s.label} <small>{s.count}</small>
          </button>
        ))}
      </div>

      <SectionTitle n="01">{shelf ? SHELVES.find((s) => s.id === shelf)?.label : "Все книги"} · {rows.length}</SectionTitle>

      {error && <p className="error">{error}</p>}
      {rows.length > 0 ? (
        <ul className="card-list">
          {rows.map((e) => {
            const local = localCopy(e, books);
            return (
              <li key={e.id} className="catalog-row">
                <button onClick={() => onOpen(e)}>
                  <Plaque title={e.title} />
                  <span className="row-text">
                    <span className="row-title">{e.title}</span>
                    <span className="row-sub">
                      {e.authorShort} · {formatDuration(e.words, wpm)}
                    </span>
                  </span>
                </button>
                {local ? (
                  <button className="add-mark done" onClick={() => onOpenLocal(local.id)} aria-label="Уже в моих книгах">
                    <IconCheck />
                  </button>
                ) : (
                  <button className="add-mark" disabled={busy === e.id} onClick={() => add(e)} aria-label="Добавить в мои книги">
                    {busy === e.id ? "…" : <IconPlus />}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted">Ничего не нашлось.</p>
      )}
    </main>
  );
}
