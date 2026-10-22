import { useState } from "react";
import { type BookRecord, type Bookmark, bookWpm, getBookmarks, getProgress, saveBookmarks } from "../books/store";
import { tokenizeBook } from "../engine/chapters";
import { formatDuration, formatNumber, percent, titleSize } from "./format";
import { IconArrowLeft, IconArrowRight, IconBook, IconFlag, IconMore, IconPencil, IconPlay, IconSend, IconShare, IconSliders, IconTrash } from "./icons";
import { SendFileSheet } from "./SendFileSheet";
import { fragmentAround, ReportSheet } from "./ReportSheet";

interface Props {
  book: BookRecord;
  wpm: number;
  initialTab?: "toc" | "bookmarks";
  onBack: () => void;
  onRead: (index?: number) => void;
  onDelete: () => void;
  onSettings: () => void;
  onPreview: () => void;
  onRename: (title: string) => void;
  /** Книга из библиотеки: делимся ссылкой, а не файлом. */
  onShare?: () => void;
}

export function BookScreen({ book, wpm, initialTab, onBack, onRead, onDelete, onSettings, onPreview, onRename, onShare }: Props) {
  const [tab, setTab] = useState<"toc" | "bookmarks">(initialTab ?? "toc");
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => getBookmarks(book.id));
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [reporting, setReporting] = useState(false);

  const { tokens, chapters } = tokenizeBook(book.chapters);
  const progress = getProgress(book.id);
  const index = progress?.index ?? 0;
  const speed = bookWpm(progress, wpm);
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
          {renaming !== null ? (
            <>
              <input className="search" autoFocus value={renaming} onChange={(e) => setRenaming(e.target.value)} aria-label="Название" />
              <button
                className="btn dark"
                disabled={!renaming.trim()}
                onClick={() => {
                  onRename(renaming.trim());
                  setRenaming(null);
                  setMenu(false);
                }}
              >
                Сохранить
              </button>
              <button className="btn" onClick={() => setRenaming(null)}>
                Отмена
              </button>
            </>
          ) : confirmDelete ? (
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
            <>
              {onShare ? (
                <button className="menu-item accent" onClick={() => { setMenu(false); onShare(); }}>
                  <IconShare /> Поделиться книгой
                </button>
              ) : (
                <button className="menu-item accent" onClick={() => { setMenu(false); setSending(true); }}>
                  <IconSend /> Отправить файл другу
                </button>
              )}
              <button className="menu-item" onClick={() => setRenaming(book.title)}>
                <IconPencil /> Переименовать
              </button>
              <button className="menu-item" onClick={() => { setMenu(false); setReporting(true); }}>
                <IconFlag /> Сообщить об ошибке
              </button>
              <button className="menu-item danger" onClick={() => setConfirmDelete(true)}>
                <IconTrash /> Удалить с устройства
              </button>
            </>
          )}
        </div>
      )}

      <h1 className="book-title" style={{ fontSize: titleSize(book.title) }}>{book.title}</h1>
      {book.author && <p className="book-author">{book.author}</p>}

      <button className="continue-card" onClick={() => onRead()}>
        <span className="plaque big">
          <IconPlay />
        </span>
        <span className="cc-text">
          <span className="cc-title">{index > 0 ? "Продолжить" : "Читать"}</span>
          <span className="mono-label dark">
            гл. {current + 1} · {pct}% // {formatDuration(tokens.length - index, speed)}
          </span>
        </span>
        <span className="round-btn">
          <IconArrowRight />
        </span>
      </button>

      <button className="text-btn" onClick={onPreview}>
        <IconBook />
        Открыть текст
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
                    <span className="row-sub">{formatDuration(words, speed)}</span>
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
      {sending && <SendFileSheet book={book} onClose={() => setSending(false)} />}
      {reporting && (
        <ReportSheet
          context={{
            title: book.title,
            format: book.format,
            place: `гл. ${current + 1} «${chapters[current]?.title ?? ""}» · ${pct}% · слово ${index + 1}`,
            fragment: fragmentAround(tokens.map((t) => t.text), index),
          }}
          onClose={() => setReporting(false)}
        />
      )}
    </main>
  );
}
