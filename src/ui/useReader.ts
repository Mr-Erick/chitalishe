import { useCallback, useEffect, useRef, useState } from "react";
import type { Token } from "../engine/tokenize";
import { nextSentenceStart, prevSentenceStart } from "../engine/tokenize";
import { delayMs, rampFactor } from "../engine/timing";

export type SpeedMode = "constant" | "ramp";

export interface ReaderSettings {
  wpm: number;
  mode: SpeedMode;
  /** Потолок скорости в режиме разгона. */
  maxWpm: number;
  /** Насколько ускоряться и как часто в режиме разгона. */
  rampStep: number;
  rampEveryMs: number;
  /** Сколько слов откатить назад при продолжении после паузы. */
  rewindWords: number;
  strict: boolean;
}

export const defaultSettings: ReaderSettings = {
  wpm: 250,
  mode: "constant",
  maxWpm: 600,
  rampStep: 10,
  rampEveryMs: 120_000,
  rewindWords: 3,
  strict: false,
};

export const MIN_WPM = 100;
export const MAX_WPM = 1500;
const clampWpm = (wpm: number) => Math.min(MAX_WPM, Math.max(MIN_WPM, wpm));

export function useReader(tokens: Token[], settings: ReaderSettings) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [wpm, setWpmState] = useState(settings.wpm);

  const indexRef = useRef(0);
  const wpmRef = useRef(settings.wpm);
  const nextAt = useRef(0);
  const sincePlay = useRef(0);
  const rampClock = useRef(0);
  const lastFrame = useRef(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const goTo = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(tokens.length - 1, i));
      indexRef.current = clamped;
      setIndex(clamped);
    },
    [tokens.length],
  );

  const setWpm = useCallback((value: number) => {
    wpmRef.current = clampWpm(value);
    setWpmState(wpmRef.current);
  }, []);

  const delayFor = useCallback(
    (i: number) =>
      delayMs(tokens[i], wpmRef.current, { strict: settingsRef.current.strict }) * rampFactor(sincePlay.current),
    [tokens],
  );

  const play = useCallback(() => {
    if (!tokens.length) return;
    if (indexRef.current >= tokens.length - 1) goTo(0);
    else if (indexRef.current > 0) goTo(indexRef.current - settingsRef.current.rewindWords);
    sincePlay.current = 0;
    const now = performance.now();
    lastFrame.current = now;
    nextAt.current = now + delayFor(indexRef.current);
    setPlaying(true);
  }, [tokens.length, goTo, delayFor]);

  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => (playing ? pause() : play()), [playing, pause, play]);

  // Основной цикл: сверяемся с реальным временем, а не с setInterval, чтобы скорость не «плыла».
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const loop = (now: number) => {
      const s = settingsRef.current;
      if (s.mode === "ramp") {
        rampClock.current += now - lastFrame.current;
        if (rampClock.current >= s.rampEveryMs) {
          rampClock.current = 0;
          if (wpmRef.current < s.maxWpm) setWpm(Math.min(s.maxWpm, wpmRef.current + s.rampStep));
        }
      }
      lastFrame.current = now;

      if (now >= nextAt.current) {
        if (indexRef.current >= tokens.length - 1) {
          setPlaying(false);
          return;
        }
        goTo(indexRef.current + 1);
        sincePlay.current++;
        const delay = delayFor(indexRef.current);
        // Если вкладка «подвисла», не догоняем пачкой слов, а продолжаем с текущего момента.
        nextAt.current = now - nextAt.current > delay ? now + delay : nextAt.current + delay;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [playing, tokens.length, goTo, delayFor, setWpm]);

  // Свернули приложение — пауза.
  useEffect(() => {
    const onHide = () => document.hidden && setPlaying(false);
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  return {
    index,
    playing,
    wpm,
    toggle,
    play,
    pause,
    goTo,
    setWpm,
    nextSentence: () => goTo(nextSentenceStart(tokens, indexRef.current)),
    prevSentence: () => goTo(prevSentenceStart(tokens, indexRef.current)),
    skip: (n: number) => goTo(indexRef.current + n),
  };
}
