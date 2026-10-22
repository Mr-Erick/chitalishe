import { useMemo, useState } from "react";
import { type BookMeta, bookWpm, getProgress } from "../books/store";
import { formatDuration, percent } from "./format";
import { IconArrowRight, IconPlus, IconSearch } from "./icons";
import { Plaque, SectionTitle } from "./TabBar";

type Sort = "recent" | "title";

interface Props {
  books: BookMeta[];
  wpm: number;
  onOpen: (id: string) => void;
  onContinue: (id: string) => void;
  onAdd: () => void;
}

const FORMAT_LABEL: Record<string, string> = { TXT: "TXT", DOCX: "DOCX", DOC: "DOC", FB2: "FB2", TEXT: "Вставленный текст" };

export function Library({ books, wpm, onOpen, onContinue, onAdd }: Props) {
  const [sort, setSort] = useState<Sort>("recent");
  const [query, setQuery] = useState<string | null>(null);

  const rows = useMemo(() => {
    const withProgress = books.map((b) => {
      const p = getProgress(b.id);
      const pct = p ? percent(p.index, b.words) : 0;
      return { book: b, pct, index: p?.index ?? 0, openedAt: p?.openedAt ?? 0, wpm: bookWpm(p, wpm) };
    });
    const q = query?.trim().toLowerCase();
    const filtered = q
      ? withProgress.filter((r) => `${r.book.title} ${r.book.author}`.toLowerCase().includes(q))
      : withProgress;
    return filtered.sort((a, b) =>
      sort === "title"
        ? a.book.title.localeCompare(b.book.title, "ru")
        : Math.max(b.openedAt, b.book.addedAt) - Math.max(a.openedAt, a.book.addedAt),
    );
  }, [books, sort, query, wpm]);

  const current = [...rows].filter((r) => r.openedAt && r.pct < 100).sort((a, b) => b.openedAt - a.openedAt)[0];

  return (
    <main className="app-screen">
      <header className="brand">
        <span className="logo">S</span>
        <div>
          <h1>SPEEDTEXT</h1>
          <p className="mono-label">[RSVP · RU]</p>
        </div>
        <button className="icon-btn" aria-label="Поиск" onClick={() => setQuery(query === null ? "" : null)}>
          <IconSearch />
        </button>
      </header>

      {query !== null ? (
        <input className="search" autoFocus placeholder="Название или автор" value={query} onChange={(e) => setQuery(e.target.value)} />
      ) : (
        <div className="strip">
          <b>Скорочтение</b> // одно слово · TXT · DOCX · FB2
        </div>
      )}

      {current && (
        <>
          <SectionTitle n="01">Продолжить</SectionTitle>
          <button className="continue-card" onClick={() => onContinue(current.book.id)}>
            <Plaque title={current.book.title} big />
            <span className="cc-text">
              <span className="cc-title">{current.book.title}</span>
              <span className="mono-label dark">
                {current.pct}% // {formatDuration(current.book.words - current.index, current.wpm)}
              </span>
            </span>
            <span className="round-btn">
              <IconArrowRight />
            </span>
            <span className="cc-bar">
              <span style={{ width: `${current.pct}%` }} />
            </span>
          </button>
        </>
      )}

      <SectionTitle
        n={current ? "02" : "01"}
        aside={
          <select className="sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Сортировка">
            <option value="recent">Недавние</option>
            <option value="title">По названию</option>
          </select>
        }
      >
        Мои книги · {books.length}
      </SectionTitle>

      {rows.length > 0 && (
        <ul className="card-list">
          {rows.map(({ book, pct, index, wpm: speed }) => (
            <li key={book.id}>
              <button onClick={() => onOpen(book.id)}>
                <Plaque title={book.title} />
                <span className="row-text">
                  <span className="row-title">{book.title}</span>
                  <span className="row-sub">
                    {[book.author, book.catalogId ? "библиотека" : FORMAT_LABEL[book.format], pct >= 100 ? "прочитано" : formatDuration(book.words - index, speed)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="mono-num">{pct}%</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query && !rows.length && <p className="muted">Ничего не нашлось.</p>}

      <button className="add-btn" onClick={onAdd}>
        <IconPlus /> Добавить свою книгу
      </button>
    </main>
  );
}
