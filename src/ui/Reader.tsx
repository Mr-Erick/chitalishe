import { useEffect, useRef, useState } from "react";
import type { Token } from "../engine/tokenize";
import { splitAtOrp } from "../engine/orp";
import { haptic, tg } from "../telegram";
import { defaultSettings, type ReaderSettings, useReader } from "./useReader";

const SPEED_STEP = 25;
const SWIPE_PX = 40;

interface Props {
  tokens: Token[];
  onExit: () => void;
}

export function Reader({ tokens, onExit }: Props) {
  const [settings, setSettings] = useState<ReaderSettings>(defaultSettings);
  const [showSettings, setShowSettings] = useState(false);
  const r = useReader(tokens, settings);
  const start = useRef<{ x: number; y: number } | null>(null);

  const [before, pivot, after] = splitAtOrp(tokens[r.index]?.text ?? "");
  const progress = tokens.length > 1 ? r.index / (tokens.length - 1) : 1;
  const left = tokens.length - r.index;
  const minutesLeft = Math.max(1, Math.round(left / r.wpm));

  const changeSpeed = (delta: number) => {
    r.setWpm(r.wpm + delta);
    haptic.tick();
  };

  // Кнопка «Назад» в Telegram и клавиатура на ПК.
  useEffect(() => {
    const back = tg()?.BackButton;
    back?.show();
    back?.onClick(onExit);
    return () => {
      back?.offClick(onExit);
      back?.hide();
    };
  }, [onExit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const actions: Record<string, () => void> = {
        " ": r.toggle,
        ArrowLeft: r.prevSentence,
        ArrowRight: r.nextSentence,
        ArrowUp: () => changeSpeed(SPEED_STEP),
        ArrowDown: () => changeSpeed(-SPEED_STEP),
        Escape: onExit,
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
      haptic.tick();
    } else if (Math.abs(dy) > SWIPE_PX) {
      changeSpeed(dy < 0 ? SPEED_STEP : -SPEED_STEP);
    } else {
      r.toggle();
      haptic.tap();
    }
  };

  // Контекст на паузе: текущее предложение целиком, текущее слово подсвечено.
  const sentenceFrom = tokens[r.index]?.sentenceStart ?? 0;
  let sentenceTo = sentenceFrom;
  while (sentenceTo + 1 < tokens.length && tokens[sentenceTo + 1].sentenceStart === sentenceFrom) sentenceTo++;

  return (
    <main className={`reader ${r.playing ? "is-playing" : ""}`}>
      <header className="topbar">
        <button className="ghost" onClick={onExit} aria-label="Назад">
          ←
        </button>
        <span>{Math.round(progress * 100)}% · ~{minutesLeft} мин</span>
        <button className="ghost" onClick={() => setShowSettings((v) => !v)} aria-label="Настройки">
          ⚙︎
        </button>
      </header>

      <section className="stage" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <p className="context">
          {!r.playing &&
            tokens.slice(sentenceFrom, sentenceTo + 1).map((t, i) => (
              <span
                key={sentenceFrom + i}
                className={sentenceFrom + i === r.index ? "current" : undefined}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  r.goTo(sentenceFrom + i);
                }}
              >
                {t.text}{" "}
              </span>
            ))}
        </p>
        <div className="frame">
          <div className="tick top" />
          <div className="word">
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
          aria-label="Позиция в тексте"
        />
        <div className="buttons">
          <button onClick={() => changeSpeed(-SPEED_STEP)}>−25</button>
          <button onClick={r.prevSentence} aria-label="Предыдущее предложение">
            ⏮
          </button>
          <button className="primary round" onClick={r.toggle} aria-label={r.playing ? "Пауза" : "Читать"}>
            {r.playing ? "⏸" : "▶"}
          </button>
          <button onClick={r.nextSentence} aria-label="Следующее предложение">
            ⏭
          </button>
          <button onClick={() => changeSpeed(SPEED_STEP)}>+25</button>
        </div>
      </footer>

      {showSettings && (
        <div className="sheet" role="dialog" aria-label="Настройки">
          <h2>Скорость</h2>
          <div className="segmented">
            <button
              className={settings.mode === "constant" ? "active" : ""}
              onClick={() => setSettings({ ...settings, mode: "constant" })}
            >
              Постоянная
            </button>
            <button
              className={settings.mode === "ramp" ? "active" : ""}
              onClick={() => setSettings({ ...settings, mode: "ramp" })}
            >
              Разгон
            </button>
          </div>
          {settings.mode === "ramp" && (
            <label>
              Потолок: {settings.maxWpm} слов/мин
              <input
                type="range"
                min={200}
                max={1000}
                step={25}
                value={settings.maxWpm}
                onChange={(e) => setSettings({ ...settings, maxWpm: Number(e.target.value) })}
              />
              <small>+{settings.rampStep} слов/мин каждые {settings.rampEveryMs / 60000} мин чтения</small>
            </label>
          )}
          <label className="check">
            <input
              type="checkbox"
              checked={!settings.strict}
              onChange={(e) => setSettings({ ...settings, strict: !e.target.checked })}
            />
            Задерживаться на знаках препинания и длинных словах
          </label>
          <button className="primary" onClick={() => setShowSettings(false)}>
            Готово
          </button>
        </div>
      )}
    </main>
  );
}
