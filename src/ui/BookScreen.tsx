import { useState } from "react";
import { type BookRecord, type Bookmark, getBookmarks, getProgress, saveBookmarks } from "../books/store";
import { tokenizeBook } from "../engine/chapters";
import { formatDuration, formatNumber, percent } from "./format";
import { IconArrowLeft, IconArrowRight, IconMore, IconPlay, IconSliders } from "./icons";

interface Props {
  book: BookRecord;
  wpm: number;
  initialTab?: "toc" | "bookmarks";
  onBack: () => void;
  onRead: (index?: number) => void;
  onDelete: () => void;
  onSettings: () => void;
}

export function BookScreen({ book, wpm, initialTab, onBack, onRead, onDelete, onSettings }: Props) {
  const [tab, setTab] = useState<"toc" | "bookmarks">(initialTab ?? "toc");
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => getBookmarks(book.id));
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const { tokens, chapters } = tokenizeBook(book.chapters);
  const progress = getProgress(book.id);
  const index = progress?.index ?? 0;
  const bookWpm = progress?.wpm ?? wpm;
  const pct = percent(index, tokens.length);
  const current = chapters.findIndex((c) => index >= c.start && index <= c.end);

  const updateBookmarks = (list: Bookmark[]) => {
    setBookmarks(list);
    saveBookmarks(book.id, list);
  };

  return (
    <main className="app-screen">
      <header className="topnav">
        <button className="icon-btn" onClick={onBack} aria-label="Назад">
          <IconArrowLeft />
        </button>
        <span className="mono-label">
          [{chapters.length} гл. · {formatNumber(tokens.length)} слов]
        </span>
        <span className="topnav-actions">
          <button className="icon-btn" onClick={onSettings} aria-label="Настройки">
            <IconSliders />
          </button>
          <button className="icon-btn" onClick={() => setMenu(!menu)} aria-label="Ещё">
            <IconMore />
          </button>
        </span>
      </header>
      {menu && (
        <div className="menu">
          {confirmDelete ? (
            <>
              <p>Удалить книгу с устройства? Закладки сохранятся, если добавить её снова.</p>
              <button className="btn danger" onClick={onDelete}>
                Удалить
              </button>
              <button className="btn" onClick={() => setConfirmDelete(false)}>
                Отмена
              </button>
            </>
          ) : (
            <button className="btn" onClick={() => setConfirmDelete(true)}>
              Удалить книгу
            </button>
          )}
        </div>
      )}

      <h1 className="book-title">{book.title}</h1>
      {book.author && <p className="book-author">{book.author}</p>}

      <button className="continue-card" onClick={() => onRead()}>
        <span className="plaque big">
          <IconPlay />
        </span>
        <span className="cc-text">
          <span className="cc-title">{index > 0 ? "Продолжить" : "Читать"}</span>
          <span className="mono-label dark">
            гл. {current + 1} · {pct}% // {formatDuration(tokens.length - index, bookWpm)}
          </span>
        </span>
        <span className="round-btn">
          <IconArrowRight />
        </span>
      </button>

      <div className="tabs2">
        <button className={tab === "toc" ? "on" : ""} onClick={() => setTab("toc")}>
          Оглавление
        </button>
        <button className={tab === "bookmarks" ? "on" : ""} onClick={() => setTab("bookmarks")}>
          Закладки <b>· {bookmarks.length}</b>
        </button>
      </div>

      {tab === "toc" ? (
        <ul className="card-list">
          {chapters.map((c, i) => {
            const words = c.end - c.start + 1;
            const done = index > c.end ? 100 : index < c.start ? 0 : Math.round(((index - c.start) / words) * 100);
            return (
              <li key={i}>
                <button onClick={() => onRead(c.start)}>
                  <span className={`num-badge ${i === current ? "on" : ""}`}>{i + 1}</span>
                  <span className="row-text">
                    <span className="row-title">{c.title}</span>
                    <span className="row-sub">{formatDuration(words, bookWpm)}</span>
                  </span>
                  <span className="mono-num">{done}%</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : bookmarks.length ? (
        <>
          <ul className="card-list">
            {bookmarks.map((b, i) => (
              <li key={b.id} className="bookmark-row">
                <button onClick={() => onRead(b.index)}>
                  <span className="num-badge on">{i + 1}</span>
                  <span className="row-text">
                    <span className="mono-label">
                      гл. {b.chapter + 1} · {b.percent}%
                    </span>
                    <span className="quote">«{b.fragment}»</span>
                    {b.note && editing !== b.id && <span className="note">{b.note}</span>}
                  </span>
                </button>
                {editing === b.id ? (
                  <div className="bm-edit">
                    <input
                      autoFocus
                      defaultValue={b.note}
                      placeholder="Заметка"
                      onBlur={(e) => {
                        updateBookmarks(bookmarks.map((x) => (x.id === b.id ? { ...x, note: e.target.value.trim() } : x)));
                        setEditing(null);
                      }}
                    />
                  </div>
                ) : (
                  <div className="bm-actions">
                    <button className="link" onClick={() => setEditing(b.id)}>
                      {b.note ? "Изменить заметку" : "Добавить заметку"}
                    </button>
                    <button className="link danger" onClick={() => updateBookmarks(bookmarks.filter((x) => x.id !== b.id))}>
                      Удалить
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="muted">Тап открывает чтение с этого слова.</p>
        </>
      ) : (
        <p className="muted">Закладок пока нет. Поставьте её кнопкой 🔖 на паузе во время чтения.</p>
      )}
    </main>
  );
}
