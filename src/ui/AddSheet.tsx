import { useRef, useState } from "react";
import { parseFile, parsePasted, UnsupportedFormatError } from "../books/parse";
import { addBook, type BookMeta } from "../books/store";

export function AddSheet({ onClose, onAdded }: { onClose: () => void; onAdded: (b: BookMeta) => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const run = async (job: () => Promise<BookMeta>) => {
    setBusy(true);
    setError("");
    try {
      onAdded(await job());
    } catch (e) {
      setError(e instanceof UnsupportedFormatError ? e.message : "Не удалось добавить. Попробуйте другой файл.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet app-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Добавить книгу">
        <div className="grip" />
        <h2>Добавить книгу или текст</h2>
        <button className="btn dark wide" disabled={busy} onClick={() => input.current?.click()}>
          Выбрать файл · TXT, DOCX
        </button>
        <input
          ref={input}
          type="file"
          accept=".txt,.docx,.doc,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) run(async () => addBook(await parseFile(file)));
          }}
        />
        <p className="mono-label">или вставьте текст</p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Статья, глава, письмо…" />
        <button className="btn lime wide" disabled={busy || !text.trim()} onClick={() => run(() => addBook(parsePasted(text)))}>
          {busy ? "Добавляю…" : "Добавить текст"}
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
