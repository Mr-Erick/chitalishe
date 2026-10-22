import { useState } from "react";
import { type CatalogEntry, shareLink } from "../books/catalog";
import { openTelegramLink } from "../telegram";
import { formatDuration } from "./format";
import { Plaque } from "./TabBar";

/** «Поделиться книгой»: другу уходит ссылка, по ней приложение открывается сразу на книге. */
export function ShareSheet({ entry, wpm, onClose }: { entry: CatalogEntry; wpm: number; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const link = shareLink(entry);
  const text = `Читаю «${entry.title}» в SPEEDTEXT, присоединяйся 👇`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Старые WebView без доступа к буферу: выделяем ссылку, чтобы её можно было скопировать вручную.
      window.prompt("Скопируйте ссылку", link);
    }
    setCopied(true);
  };

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet app-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Поделиться книгой">
        <div className="grip" />
        <h2>Поделиться книгой</h2>
        <p className="muted">Друг получит ссылку. Приложение откроется сразу на этой книге, файл передавать не нужно.</p>
        <p className="mono-label">Так увидит друг</p>
        <div className="share-preview">
          <p>{text}</p>
          <div className="share-book">
            <Plaque title={entry.title} />
            <span className="row-text">
              <span className="row-title">{entry.title}</span>
              <span className="row-sub">
                {entry.authorShort} · бесплатно · {formatDuration(entry.words, wpm)}
              </span>
            </span>
          </div>
          <span className="share-open">Открыть в SPEEDTEXT</span>
        </div>
        <button
          className="btn dark wide"
          onClick={() => openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`)}
        >
          Выбрать чат в Telegram
        </button>
        <button className="btn wide" onClick={copy}>
          {copied ? "Ссылка скопирована" : "Скопировать ссылку"}
        </button>
      </div>
    </div>
  );
}
