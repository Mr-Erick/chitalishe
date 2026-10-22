import { useState } from "react";
import { type CatalogEntry, localCopy, SUPPORT_EMAIL } from "../books/catalog";
import { type BookMeta, bookWpm, getProgress } from "../books/store";
import { formatDuration, formatNumber, percent, titleSize } from "./format";
import { IconArrowLeft, IconArrowRight, IconBook, IconCheck, IconPlay, IconShare } from "./icons";
import { ShareSheet } from "./ShareSheet";

interface Props {
  entry: CatalogEntry;
  books: BookMeta[];
  wpm: number;
  /** Открыто по ссылке друга. */
  shared?: boolean;
  onBack: () => void;
  /** Добавить (если ещё нет) и открыть: чтение или текст. */
  onOpen: (entry: CatalogEntry, mode: "read" | "text") => Promise<void>;
}

/** Карточка книги из бесплатной библиотеки. */
export function CatalogBook({ entry, books, wpm, shared, onBack, onOpen }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);

  const local = localCopy(entry, books);
  const progress = local ? getProgress(local.id) : null;
  const index = progress?.index ?? 0;
  const speed = bookWpm(progress, wpm);
  const pct = local ? percent(index, local.words) : 0;

  const open = async (mode: "read" | "text") => {
    setBusy(true);
    setError("");
    try {
      await onOpen(entry, mode);
    } catch {
      setError("Не удалось скачать книгу. Проверьте интернет и попробуйте ещё раз.");
      setBusy(false);
    }
  };

  return (
    <main className="app-screen">
      <header className="topnav">
        <button className="icon-btn" onClick={onBack} aria-label="Назад">
          <IconArrowLeft />
        </button>
      </header>

      {shared && (
        <section className="shared-banner">
          <span className="logo small">S</span>
          <span>
            <b className="mono-label lime">Вам поделились</b>
            <span>Друг советует эту книгу</span>
          </span>
        </section>
      )}

      <h1 className="book-title" style={{ fontSize: titleSize(entry.title) }}>{entry.title}</h1>
      <p className="book-author">{entry.author}</p>
      <p className="mono-label">
        [библиотека · {entry.chapters} гл. · {formatNumber(entry.words)} слов]
      </p>

      <button className="continue-card" disabled={busy} onClick={() => open("read")}>
        <span className="plaque big">
          <IconPlay />
        </span>
        <span className="cc-text">
          <span className="cc-title">{busy ? "Загружаю…" : local ? (index > 0 ? "Продолжить" : "Читать") : "Добавить и читать"}</span>
          <span className="mono-label dark">
            {local && index > 0 ? `${pct}% // ` : ""}
            {formatDuration(entry.words - index, speed)} чтения
          </span>
        </span>
        <span className="round-btn">
          <IconArrowRight />
        </span>
      </button>
      {error && <p className="error">{error}</p>}

      <div className="tabs2">
        <button className="icon-label" disabled={busy} onClick={() => open("text")}>
          <IconBook /> Текст
        </button>
        <button className="icon-label" onClick={() => setSharing(true)}>
          <IconShare /> Поделиться
        </button>
      </div>

      <section className="card pd-card">
        <span className="pd-badge">
          <IconCheck /> Общественное достояние
        </span>
        <div className="row">
          Автор <b className="plain">{entry.authorYears}</b>
        </div>
        {entry.translator && (
          <div className="row">
            Переводчик <b className="plain">{[entry.translator, entry.translatorYears].filter(Boolean).join(", ")}</b>
          </div>
        )}
        <div className="row">
          Охрана <b className="plain">истекла, книга свободна</b>
        </div>
        <div className="row">
          Текст <b className="plain">подготовлен SPEEDTEXT: без сносок и примечаний</b>
        </div>
      </section>
      <p className="muted small">
        Нашли ошибку или считаете, что книга охраняется?{" "}
        <a className="link" href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`SPEEDTEXT: ${entry.title}`)}`}>
          Напишите нам
        </a>
        , разберёмся за 24 часа.
      </p>

      {sharing && <ShareSheet entry={entry} wpm={wpm} onClose={() => setSharing(false)} />}
    </main>
  );
}
