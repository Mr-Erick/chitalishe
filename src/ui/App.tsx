import { useMemo, useState } from "react";
import { tokenize } from "../engine/tokenize";
import { Reader } from "./Reader";
import { SAMPLE_TEXT } from "./sample";

export function App() {
  const [draft, setDraft] = useState(SAMPLE_TEXT);
  const [text, setText] = useState<string | null>(null);
  const tokens = useMemo(() => (text ? tokenize(text) : []), [text]);

  if (text && tokens.length) return <Reader tokens={tokens} onExit={() => setText(null)} />;

  return (
    <main className="start">
      <h1>Читалище</h1>
      <p className="hint">Вставьте текст и нажмите «Читать». Слова пойдут по одному, глаза останутся на месте.</p>
      <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Вставьте текст сюда" />
      <button className="primary" disabled={!draft.trim()} onClick={() => setText(draft)}>
        Читать
      </button>
    </main>
  );
}
