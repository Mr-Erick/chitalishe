import { useState } from "react";
import type { BookRecord } from "../books/store";

/** Своя книга одним TXT: название, автор и главы с заголовками, чтобы у друга главы нашлись снова. */
export function bookToTxt(book: BookRecord): string {
  const head = [book.title, book.author].filter(Boolean).join("\n");
  const body = book.chapters.map((c) => (book.chapters.length > 1 ? `${c.title}\n\n${c.text}` : c.text)).join("\n\n\n");
  return `${head}\n\n\n${body}\n`;
}

const safeName = (title: string) => (title.replace(/[\\/:*?"<>|]+/g, " ").trim() || "Книга").slice(0, 80);

type Status = "idle" | "sent" | "saved" | "failed";

/** «Отправить файл другу»: только свой текст или свободная книга; файл уходит через системное меню «Поделиться». */
export function SendFileSheet({ book, onClose }: { book: BookRecord; onClose: () => void }) {
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const text = bookToTxt(book);
  const name = `${safeName(book.title)}.txt`;
  const kb = Math.max(1, Math.round(new Blob([text]).size / 1024));

  const send = async () => {
    const file = new File([text], name, { type: "text/plain" });
    // Телефоны: системное «Поделиться» с Telegram в списке.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: book.title });
        setStatus("sent");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setStatus("failed");
      }
      return;
    }
    // Компьютер и WebView без «Поделиться»: сохраняем файл, дальше его можно перетащить в чат.
    try {
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setStatus("saved");
    } catch {
      setStatus("failed");
    }
  };

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet app-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Отправить файл другу">
        <div className="grip" />
        <h2>Отправить файл другу</h2>
        <div className="file-row">
          <span className="plaque">TXT</span>
          <span className="row-text">
            <span className="row-title">{name}</span>
            <span className="row-sub">{kb} КБ · без закладок и прогресса</span>
          </span>
        </div>
        <label className="consent">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            Это мой собственный текст или книга, свободная от авторских прав
            <small>Чужие книги, купленные или скачанные, отправлять нельзя.</small>
          </span>
        </label>
        <button className="btn dark wide" disabled={!agreed} onClick={send}>
          Выбрать чат в Telegram
        </button>
        {status === "saved" && <p className="muted">Файл сохранён в «Загрузки». Перетащите или прикрепите его в чат с другом.</p>}
        {status === "sent" && <p className="muted">Готово.</p>}
        {status === "failed" && <p className="error">Не получилось отправить. Попробуйте ещё раз.</p>}
        <p className="note-box">Файл уходит через Telegram напрямую в выбранный чат. SPEEDTEXT его не хранит и не видит.</p>
      </div>
    </div>
  );
}
