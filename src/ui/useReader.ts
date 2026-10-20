import { useCallback, useEffect, useRef, useState } from "react";
import type { Token } from "../engine/tokenize";
import { nextSentenceStart, prevSentenceStart } from "../engine/tokenize";
import type { Chapter } from "../engine/chapters";
import { delayMs, rampFactor } from "../engine/timing";
import type { Settings } from "./settings";

export const MIN_WPM = 100;
export const MAX_WPM = 1500;
/** Пауза с названием главы при переходе на новую главу. */
export const CHAPTER_PAUSE_MS = 1500;
const clampWpm = (wpm: number) => Math.min(MAX_WPM, Math.max(MIN_WPM, wpm));

interface Options {
  tokens: Token[];
  chapters: Chapter[];
  settings: Settings;
  initialIndex: number;
  initialWpm: number;
  /** Чтение дошло до новой главы и встало на паузу (настройка «Конец главы: пауза»). */
  onChapterPause?: (chapter: number) => void;
}

export function useReader({ tokens, chapters, settings, initialIndex, initialWpm, onChapterPause }: Options) {
  const [index, setIndex] = useState(initialIndex);
  const [playing, setPlaying] = useState(false);
  const [wpm, setWpmState] = useState(clampWpm(initialWpm));

  const indexRef = useRef(initialIndex);
  const wpmRef = useRef(clampWpm(initialWpm));
  const nextAt = useRef(0);
  const sincePlay = useRef(0);
  const rampClock = useRef(0);
  const lastFrame = useRef(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const onChapterPauseRef = useRef(onChapterPause);
  onChapterPauseRef.current = onChapterPause;

  const chapterStarts = useRef(new Map<number, number>());
  chapterStarts.current = new Map(chapters.map((c, i) => [c.start, i]));

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
    (i: number) => {
      const base = delayMs(tokens[i], wpmRef.current, { strict: !settingsRef.current.delays }) * rampFactor(sincePlay.current);
      return i > 0 && chapterStarts.current.has(i) ? base + CHAPTER_PAUSE_MS : base;
    },
    [tokens],
  );

  const play = useCallback(() => {
    if (!tokens.length) return;
    if (indexRef.current >= tokens.length - 1) goTo(0);
    else if (indexRef.current > 0 && !chapterStarts.current.has(indexRef.current))
      goTo(indexRef.current - settingsRef.current.rewindWords);
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
        const next = indexRef.current + 1;
        goTo(next);
        const chapter = chapterStarts.current.get(next);
        if (chapter !== undefined && s.chapterEnd === "pause") {
          setPlaying(false);
          onChapterPauseRef.current?.(chapter);
          return;
        }
        sincePlay.current++;
        const delay = delayFor(next);
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
  };
}
