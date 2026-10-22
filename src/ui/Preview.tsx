import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { type BookRecord, bookWpm, getProgress } from "../books/store";
import { chapterAt, tokenizeBook } from "../engine/chapters";
import { formatDuration, formatNumber } from "./format";
import { IconArrowLeft, IconPlay } from "./icons";
import type { Settings } from "./settings";

interface Props {
  book: BookRecord;
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  /** С какого слова открыть; по умолчанию — место, где остановились. */
  startIndex?: number;
  onBack: () => void;
  onRead: (index: number) => void;
}

const FORMAT: Record<string, string> = { TXT: "TXT", DOCX: "DOCX", DOC: "DOC", FB2: "FB2", TEXT: "ТЕКСТ" };
const MIN_FONT = 15;
const MAX_FONT = 27;

const wordsLabel = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)} тыс слов` : `${formatNumber(n)} слов`);
/** Слово для кнопки: без кавычек и знаков по краям, не длиннее 16 букв. */
const shortWord = (w: string) => {
  const t = w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "") || w;
  return t.length > 16 ? `${t.slice(0, 15)}…` : t;
};

/** Книга обычным текстом: выбрать главу и слово, с которого запустить SPEEDTEXT. */
export function Preview({ book, settings, update, startIndex, onBack, onRead }: Props) {
  const { tokens, chapters } = useMemo(() => tokenizeBook(book.chapters), [book]);
  const progress = getProgress(book.id);
  const [selected, setSelected] = useState(() => Math.min(startIndex ?? progress?.index ?? 0, Math.max(tokens.length - 1, 0)));
  const [fontMenu, setFontMenu] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const scrollTarget = useRef<"selected" | "top">("selected");

  const chapterIndex = chapterAt(chapters, selected);
  const chapter = chapters[chapterIndex];
  const speed = bookWpm(progress, settings.wpm);
  const fontSize = settings.previewFontSize;

  // Абзацы текущей главы: [начало, конец] по индексам слов.
  const paragraphs = useMemo(() => {
    if (!chapter) return [];
    const out: [number, number][] = [];
    let start = chapter.start;
    for (let i = chapter.start; i <= chapter.end; i++) {
      if (tokens[i].paragraphEnd || i === chapter.end) {
        out.push([start, i]);
        start = i + 1;
      }
    }
    return out;
  }, [chapter, tokens]);

  // При открытии — к выбранному слову, при смене главы из списка — в начало главы.
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    if (scrollTarget.current === "top") el.scrollTop = 0;
    else el.querySelector(".sel")?.scrollIntoView({ block: "center" });
    scrollTarget.current = "selected";
  }, [chapterIndex]);

  // Кнопка Esc на компьютере — назад.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onBack();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);

  if (!chapter) return <main className={`preview-screen bg-${settings.bg}`} />;

  const showTitle = chapters.length > 1 || chapter.title !== "Текст";
  const total = Math.max(tokens.length - 1, 1);

  return (
    <main className={`preview-screen bg-${settings.bg}`}>
      <header className="pv-top">
        <button className="ghost" onClick={onBack} aria-label="Назад">
          <IconArrowLeft />
        </button>
        {chapters.length > 1 ? (
          <label className="pv-chapter">
            <span>{chapter.title}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
            <select
              value={chapterIndex}
              aria-label="Глава"
              onChange={(e) => {
                scrollTarget.current = "top";
                setSelected(chapters[Number(e.target.value)].start);
              }}
            >
              {chapters.map((c, i) => (
                <option key={i} value={i}>
                  {i + 1}. {c.title}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="pv-chapter static">{book.title}</span>
        )}
        <button className="ghost pv-aa" onClick={() => setFontMenu(!fontMenu)} aria-label="Шрифт">
          Aa
        </button>
      </header>
      <p className="pv-meta">
        [текст · {FORMAT[book.format] ?? book.format} · {wordsLabel(tokens.length)} · {formatDuration(tokens.length, speed)}]
      </p>

      {fontMenu && (
        <div className="pv-font">
          <div className="pv-font-row">
            <button className={settings.serif ? "on serif" : "serif"} onClick={() => update({ serif: true })}>
              С засечками
            </button>
            <button className={!settings.serif ? "on sans" : "sans"} onClick={() => update({ serif: false })}>
              Без
            </button>
          </div>
          <div className="pv-font-row">
            <button onClick={() => update({ previewFontSize: Math.max(MIN_FONT, fontSize - 2) })} aria-label="Мельче">
              A−
            </button>
            <span>{fontSize}</span>
            <button onClick={() => update({ previewFontSize: Math.min(MAX_FONT, fontSize + 2) })} aria-label="Крупнее">
              A+
            </button>
          </div>
        </div>
      )}

      <div
        className={`pv-text ${settings.serif ? "serif" : "sans"}`}
        ref={textRef}
        style={{ fontSize }}
        onClick={(e) => {
          setFontMenu(false);
          const i = (e.target as HTMLElement).dataset.i;
          if (i !== undefined) setSelected(Number(i));
        }}
      >
        {showTitle && <h2 className="pv-title">{chapter.title}</h2>}
        {paragraphs.map(([from, to]) => (
          <p key={from}>
            {tokens.slice(from, to + 1).map((t, k) => {
              const i = from + k;
              return (
                <Fragment key={i}>
                  <span data-i={i} className={i === selected ? "sel" : i < selected ? "past" : undefined}>
                    {t.text}
                  </span>{" "}
                </Fragment>
              );
            })}
          </p>
        ))}
        {chapterIndex < chapters.length - 1 && (
          <button
            className="pv-next"
            onClick={(e) => {
              e.stopPropagation();
              scrollTarget.current = "top";
              setSelected(chapters[chapterIndex + 1].start);
            }}
          >
            Следующая глава: {chapters[chapterIndex + 1].title}
          </button>
        )}
      </div>

      <footer className="pv-bottom">
        <p className="hint">Тап по слову выбирает, откуда начать</p>
        <div className="pv-actions">
          <button className="pv-go" onClick={() => onRead(selected)}>
            <IconPlay />
            <span>
              SPEEDTEXT с «{shortWord(tokens[selected]?.text ?? "")}»
            </span>
          </button>
          <span className="pv-wpm">
            <b>{speed}</b>
            <small>сл/мин</small>
          </span>
        </div>
        <div className="pv-progress">
          <span style={{ width: `${(selected / total) * 100}%` }} />
        </div>
      </footer>
    </main>
  );
}
