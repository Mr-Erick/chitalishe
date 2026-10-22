import { useState } from "react";
import { SUPPORT_EMAIL } from "../books/catalog";
import { tg } from "../telegram";

const KINDS = ["Мусор в тексте", "Пропал нужный текст", "Неправильные главы", "Книга не открывается", "Другое"];
/** Сколько слов вокруг места чтения кладём в письмо: чтобы найти ошибку, но не пересылать книгу. */
const FRAGMENT_WORDS = 24;

export interface ReportContext {
  title: string;
  format?: string;
  /** Где читатель сейчас: «гл. 3 · 41%». */
  place?: string;
  /** Слова вокруг места чтения. */
  fragment?: string;
}

/** Коротко, без полного user agent: ссылка mailto длиннее ~2000 символов на части телефонов не открывается. */
function device(): string {
  const platform = tg()?.platform;
  const where = platform && platform !== "unknown" ? `Telegram ${platform}` : "браузер";
  const system = /\(([^)]+)\)/.exec(navigator.userAgent)?.[1].split(";").slice(0, 3).join(";") ?? "";
  return `${where} · ${system} · экран ${screen.width}×${screen.height}`;
}

export function fragmentAround(words: string[], index: number): string {
  const from = Math.max(0, index - FRAGMENT_WORDS / 2);
  return words.slice(from, from + FRAGMENT_WORDS).join(" ");
}

/** «Сообщить об ошибке»: письмо на почту поддержки. Файл книги не прикладываем: не берём на себя чужие тексты. */
export function ReportSheet({ context, onClose }: { context?: ReportContext; onClose: () => void }) {
  const [kind, setKind] = useState(KINDS[0]);
  const [text, setText] = useState("");
  const [withFragment, setWithFragment] = useState(true);
  const [copied, setCopied] = useState(false);

  const subject = `SPEEDTEXT: ${kind}${context ? ` · ${context.title}` : ""}`;
  const body = [
    text.trim() || "(опишите, что не так)",
    "",
    "—",
    context && `Книга: ${context.title}${context.format ? ` (${context.format})` : ""}`,
    context?.place && `Место: ${context.place}`,
    withFragment && context?.fragment && `Фрагмент: «${context.fragment}»`,
    `Устройство: ${device()}`,
  ]
    .filter((line) => line !== undefined && line !== false && line !== "")
    .join("\n");
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  // Если почтовое приложение не открылось (так бывает внутри Telegram), письмо можно вставить вручную.
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${SUPPORT_EMAIL}\n${subject}\n\n${body}`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet app-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Сообщить об ошибке">
        <div className="grip" />
        <h2>Сообщить об ошибке</h2>
        <div className="chips">
          {KINDS.map((k) => (
            <button key={k} className={k === kind ? "on" : ""} onClick={() => setKind(k)}>
              {k}
            </button>
          ))}
        </div>
        <textarea maxLength={300} value={text} onChange={(e) => setText(e.target.value)} placeholder="Что случилось? Например: на 3-й главе показывает номера страниц" />
        {context?.fragment && (
          <label className="consent">
            <input type="checkbox" checked={withFragment} onChange={(e) => setWithFragment(e.target.checked)} />
            <span>
              Приложить кусочек текста, где я читаю
              <small>«{context.fragment.slice(0, 120)}…»</small>
            </span>
          </label>
        )}
        <a className="btn dark wide" href={mailto}>
          Написать письмо
        </a>
        <button className="btn wide" onClick={copy}>
          {copied ? "Скопировано — вставьте в письмо" : "Скопировать текст письма"}
        </button>
        <p className="note-box">
          Письмо уйдёт на {SUPPORT_EMAIL} из вашей почты. Файл книги не прикладывается: присылайте только описание и кусочек
          текста.
        </p>
      </div>
    </div>
  );
}
