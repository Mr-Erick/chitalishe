import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { chapterAt, tokenizeBook } from "../engine/chapters";
import { splitAtOrp } from "../engine/orp";
import { shownText } from "../engine/tokenize";
import { type BookRecord, type Bookmark, bookWpm, getBookmarks, getProgress, saveBookmarks, saveProgress } from "../books/store";
import { trackSession } from "../analytics";
import { haptic } from "../telegram";
import { percent } from "./format";
import { IconArrowLeft, IconBook, IconBookmark, IconNext, IconPause, IconPlay, IconPrev, IconSliders } from "./icons";
import { PIVOT_COLORS, type Settings } from "./settings";
import { useReader } from "./useReader";
import { useKeepAwake } from "./useKeepAwake";

const SWIPE_PX = 40;
/** Отступ от края экрана для длинных слов, px. */
const EDGE_PX = 8;
const LONG_PRESS_MS = 500;
const AUTOSAVE_MS = 10_000;

interface Props {
  book: BookRecord;
  startIndex?: number;
  settings: Settings;
  onExit: () => void;
  onOpenSettings: () => void;
  onAllBookmarks: () => void;
  /** Открыть книгу текстом на этом слове. */
  onText: (index: number) => void;
}

type SheetState = { mode: "added"; bookmark: Bookmark } | { mode: "list" } | null;

export function Reader({ book, startIndex, settings, onExit, onOpenSettings, onAllBookmarks, onText }: Props) {
  const { tokens, chapters } = useMemo(
    () => tokenizeBook(book.chapters, { clean: settings.cleanText }),
    [book, settings.cleanText],
  );
  const saved = useMemo(() => getProgress(book.id), [book.id]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => getBookmarks(book.id));
  const [sheet, setSheet] = useState<SheetState>(null);
  const [chapterDone, setChapterDone] = useState<number | null>(null);
  const vibrate = settings.haptics ? haptic : { tap: () => {}, tick: () => {} };

  const r = useReader({
    tokens,
    chapters,
    settings,
    initialIndex: Math.min(startIndex ?? saved?.index ?? 0, tokens.length - 1),
    initialWpm: bookWpm(saved, settings.wpm),
    onChapterPause: (ch) => setChapterDone(ch - 1),
  });

  useKeepAwake(r.playing);

  // ---- обезличенная статистика: сколько читали и на какой скорости ----
  const wpmRef = useRef(r.wpm);
  wpmRef.current = r.wpm;
  useEffect(() => {
    if (!r.playing) return;
    const started = performance.now();
    return () => trackSession(performance.now() - started, wpmRef.current);
  }, [r.playing]);

  const chapter = chapterAt(chapters, r.index);
  const pct = percent(r.index, tokens.length);
  const atChapterStart = chapters[chapter]?.start === r.index;

  // ---- сохранение места и скорости ----
  const save = useCallback(() => saveProgress(book.id, { index: r.index, wpm: r.wpm, wpmBase: settings.wpm }), [book.id, r.index, r.wpm, settings.wpm]);
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (!r.playing) saveRef.current();
  }, [r.playing]);
  useEffect(() => {
    const timer = setInterval(() => saveRef.current(), AUTOSAVE_MS);
    const onHide = () => document.hidden && saveRef.current();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      saveRef.current();
    };
  }, []);

  const exit = () => {
    r.pause();
    save();
    onExit();
  };

  // ---- длинные слова ----
  const word = tokens[r.index] ? shownText(tokens[r.index]) : "";
  const [before, pivot, after] = splitAtOrp(word);
  const wordRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = wordRef.current;
    if (!el) return;
    // Уменьшаем шрифт ровно настолько, чтобы обе половины слова поместились по свою сторону от опорной точки.
    // --fit ставим на рамку, чтобы метки сверху и снизу сдвигались вместе с опорной буквой.
    const frame = el.parentElement!;
    const fit = () => {
      frame.style.setProperty("--fit", "1");
      const box = el.getBoundingClientRect();
      const afterEl = el.querySelector(".after") as HTMLElement;
      const anchorX = afterEl.getBoundingClientRect().left - box.left;
      const leftW = (el.querySelector(".before") as HTMLElement).getBoundingClientRect().width;
      const rightW = afterEl.getBoundingClientRect().width;
      const scale = Math.min(1, (anchorX - EDGE_PX) / (leftW || 1), (box.width - anchorX - EDGE_PX) / (rightW || 1));
      frame.style.setProperty("--fit", String(scale));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [word, settings.fontSize, settings.serif]);

  // ---- закладки ----
  const sentenceBounds = (i: number) => {
    const from = tokens[i]?.sentenceStart ?? 0;
    let to = from;
    while (to + 1 < tokens.length && tokens[to + 1].sentenceStart === from) to++;
    return [from, to] as const;
  };

  const updateBookmarks = (list: Bookmark[]) => {
    setBookmarks(list);
    saveBookmarks(book.id, list);
  };

  const addBookmark = () => {
    r.pause();
    const existing = bookmarks.find((b) => b.index === r.index);
    if (existing) return setSheet({ mode: "added", bookmark: existing });
    const [from, to] = sentenceBounds(r.index);
    const start = Math.max(from, r.index - 12);
    const end = Math.min(to, r.index + 12);
    const fragment =
      (start > from ? "…" : "") +
      tokens
        .slice(start, end + 1)
        .filter((t) => !t.skip)
        .map(shownText)
        .join(" ") +
      (end < to ? "…" : "");
    const bookmark: Bookmark = {
      id: `${Date.now()}`,
      index: r.index,
      chapter,
      percent: pct,
      fragment,
      note: "",
      createdAt: Date.now(),
    };
    updateBookmarks([...bookmarks, bookmark]);
    vibrate.tap();
    setSheet({ mode: "added", bookmark });
  };

  const pressTimer = useRef<number>();
  const longPressed = useRef(false);
  const bookmarkHere = bookmarks.some((b) => b.index === r.index);

  // ---- жесты и клавиши ----
  const changeSpeed = (delta: number) => {
    r.setWpm(r.wpm + delta);
    vibrate.tick();
  };

  const start = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    start.current = null;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      dx < 0 ? r.nextSentence() : r.prevSentence();
      vibrate.tick();
    } else if (Math.abs(dy) > SWIPE_PX) {
      changeSpeed(dy < 0 ? settings.step : -settings.step);
    } else {
      setChapterDone(null);
      r.toggle();
      vibrate.tap();
    }
  };

  useEffect(() => {
    if (sheet) return;
    const onKey = (e: KeyboardEvent) => {
      const actions: Record<string, () => void> = {
        " ": r.toggle,
        ArrowLeft: r.prevSentence,
        ArrowRight: r.nextSentence,
        ArrowUp: () => changeSpeed(settings.step),
        ArrowDown: () => changeSpeed(-settings.step),
        b: addBookmark,
        Escape: exit,
      };
      const action = actions[e.key];
      if (action) {
        e.preventDefault();
        action();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const [from, to] = sentenceBounds(r.index);
  const style = {
    "--pivot": PIVOT_COLORS[settings.pivot],
    "--word-size": `${settings.fontSize}px`,
  } as React.CSSProperties;

  return (
    <main className={`reader bg-${settings.bg} ${settings.serif ? "serif" : "sans"} ${r.playing ? "is-playing" : ""}`} style={style}>
      <header className="topbar">
        <button className="ghost" onClick={exit} aria-label="Назад">
          <IconArrowLeft />
        </button>
        <span>
          {chapters[chapter]?.title ?? ""} · {pct}%
        </span>
        <span className="topbar-right">
          <button
            className="ghost"
            aria-label="К тексту"
            onClick={() => {
              r.pause();
              save();
              onText(r.index);
            }}
          >
            <IconBook />
          </button>
          <button
            className="ghost"
            aria-label="Закладка"
            onPointerDown={() => {
              longPressed.current = false;
              pressTimer.current = window.setTimeout(() => {
                longPressed.current = true;
                r.pause();
                setSheet({ mode: "list" });
              }, LONG_PRESS_MS);
            }}
            onPointerUp={() => clearTimeout(pressTimer.current)}
            onPointerLeave={() => clearTimeout(pressTimer.current)}
            onClick={() => !longPressed.current && addBookmark()}
          >
            <IconBookmark filled={bookmarkHere} />
          </button>
          <button
            className="ghost"
            aria-label="Настройки"
            onClick={() => {
              r.pause();
              save();
              onOpenSettings();
            }}
          >
            <IconSliders />
          </button>
        </span>
      </header>

      <section className="stage" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <p className="context">
          {chapterDone !== null ? (
            <span className="chapter-banner">
              {chapters[chapterDone]?.title} прочитана. Тап — следующая глава.
            </span>
          ) : atChapterStart && chapters.length > 1 ? (
            <span className="chapter-banner">{chapters[chapter].title}</span>
          ) : (
            !r.playing &&
            tokens.slice(from, to + 1).map((t, i) => !t.skip && (
              <span
                key={from + i}
                className={from + i === r.index ? "current" : undefined}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  r.goTo(from + i);
                }}
              >
                {shownText(t)}{" "}
              </span>
            ))
          )}
        </p>
        <div className="frame">
          <div className="tick top" />
          <div className="word" ref={wordRef}>
            <span className="before">{before}</span>
            <span className="after">
              <span className="pivot">{pivot}</span>
              {after}
            </span>
          </div>
          <div className="tick bottom" />
        </div>
        <p className="speed">
          {r.wpm} слов/мин{settings.mode === "ramp" ? " · разгон" : ""}
          {!r.playing ? " · пауза" : ""}
        </p>
        <p className="hint gesture-hint">Тап — старт · свайп ←→ предложение · ↑↓ скорость</p>
      </section>

      <footer className="controls">
        <input
          className="progress"
          type="range"
          min={0}
          max={tokens.length - 1}
          value={r.index}
          onChange={(e) => r.goTo(Number(e.target.value))}
          aria-label="Позиция в книге"
        />
        <div className="buttons">
          <button onClick={() => changeSpeed(-settings.step)}>−{settings.step}</button>
          <button onClick={r.prevSentence} aria-label="Предыдущее предложение">
            <IconPrev />
          </button>
          <button className="round" onClick={r.toggle} aria-label={r.playing ? "Пауза" : "Читать"}>
            {r.playing ? <IconPause /> : <IconPlay />}
          </button>
          <button onClick={r.nextSentence} aria-label="Следующее предложение">
            <IconNext />
          </button>
          <button onClick={() => changeSpeed(settings.step)}>+{settings.step}</button>
        </div>
      </footer>

      {sheet && (
        <BookmarkSheet
          sheet={sheet}
          bookmarks={bookmarks}
          chapters={chapters.map((c) => c.title)}
          currentWord={word}
          onUpdate={updateBookmarks}
          onClose={(resume) => {
            setSheet(null);
            if (resume) r.play();
          }}
          onJump={(i) => {
            setSheet(null);
            r.goTo(i);
          }}
          onAll={() => {
            setSheet(null);
            save();
            onAllBookmarks();
          }}
        />
      )}
    </main>
  );
}

interface SheetProps {
  sheet: NonNullable<SheetState>;
  bookmarks: Bookmark[];
  chapters: string[];
  currentWord: string;
  onUpdate: (list: Bookmark[]) => void;
  onClose: (resume: boolean) => void;
  onJump: (index: number) => void;
  onAll: () => void;
}

function BookmarkSheet({ sheet, bookmarks, chapters, currentWord, onUpdate, onClose, onJump, onAll }: SheetProps) {
  const [note, setNote] = useState(sheet.mode === "added" ? sheet.bookmark.note : "");
  const others = sheet.mode === "added" ? bookmarks.filter((b) => b.id !== sheet.bookmark.id) : bookmarks;

  const finish = (resume: boolean) => {
    if (sheet.mode === "added")
      onUpdate(bookmarks.map((b) => (b.id === sheet.bookmark.id ? { ...b, note: note.trim() } : b)));
    onClose(resume);
  };

  // Фрагмент с выделенным текущим словом.
  const fragment = (text: string) => {
    const i = text.indexOf(currentWord);
    if (i < 0) return text;
    return (
      <>
        {text.slice(0, i)}
        <b>{currentWord}</b>
        {text.slice(i + currentWord.length)}
      </>
    );
  };

  return (
    <div className="backdrop" onClick={() => finish(false)}>
      <div className="sheet reader-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Закладки">
        <div className="grip" />
        {sheet.mode === "added" && (
          <>
            <div className="sheet-head">
              <h2>Закладка поставлена</h2>
              <button
                className="link danger"
                onClick={() => {
                  onUpdate(bookmarks.filter((b) => b.id !== sheet.bookmark.id));
                  onClose(false);
                }}
              >
                Убрать
              </button>
            </div>
            <p className="fragment">«{fragment(sheet.bookmark.fragment)}»</p>
            <label className="field">
              Заметка, если нужна
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Например: обсудить в клубе" />
            </label>
            <button className="btn dark wide" onClick={() => finish(true)}>
              Готово, читать дальше
            </button>
          </>
        )}
        <div className="sheet-head small">
          <h3>Закладки этой книги · {bookmarks.length}</h3>
          <button className="link" onClick={onAll}>
            Все
          </button>
        </div>
        {others.length ? (
          <ul className="bm-list">
            {others.slice(0, 6).map((b) => (
              <li key={b.id}>
                <button onClick={() => onJump(b.index)}>
                  <IconBookmark filled />
                  <span>
                    <small>
                      {chapters[b.chapter] ?? `Глава ${b.chapter + 1}`} · {b.percent}%{b.note ? " · есть заметка" : ""}
                    </small>
                    {b.fragment}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{sheet.mode === "list" ? "Закладок пока нет." : "Других закладок пока нет."}</p>
        )}
      </div>
    </div>
  );
}
