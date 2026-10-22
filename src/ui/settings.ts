import { useCallback, useState } from "react";
import { local } from "../books/store";

export type SpeedMode = "constant" | "ramp";
export type ReaderBg = "gray" | "white" | "dark" | "black";
export type PivotColor = "red" | "blue" | "ink";
export type ChapterEnd = "continue" | "pause";

/** Общие для всех книг настройки. Книга помнит только свою последнюю скорость. */
export interface Settings {
  wpm: number;
  mode: SpeedMode;
  maxWpm: number;
  rampStep: number;
  /** Прибавлять rampStep каждые столько показанных слов (1 — плавно, с каждым словом). */
  rampEveryWords: number;
  /** Шаг свайпа и кнопок ±. */
  step: number;
  serif: boolean;
  fontSize: number;
  pivot: PivotColor;
  bg: ReaderBg;
  /** Задерживаться на знаках препинания и длинных словах. */
  delays: boolean;
  rewindWords: number;
  /** Размер текста в предпросмотре, px. */
  previewFontSize: number;
  chapterEnd: ChapterEnd;
  haptics: boolean;
}

export const defaultSettings: Settings = {
  wpm: 250,
  mode: "constant",
  maxWpm: 600,
  rampStep: 10,
  rampEveryWords: 10,
  step: 25,
  serif: true,
  fontSize: 46,
  pivot: "red",
  bg: "gray",
  delays: true,
  rewindWords: 3,
  previewFontSize: 19,
  chapterEnd: "continue",
  haptics: true,
};

export const PIVOT_COLORS: Record<PivotColor, string> = { red: "#b23a32", blue: "#4a6fa5", ink: "#222222" };

const KEY = "speedtext:settings";

export function useSettings() {
  const [settings, setState] = useState<Settings>(() => ({ ...defaultSettings, ...local.read(KEY, {}) }));
  const update = useCallback((patch: Partial<Settings>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      local.write(KEY, next);
      return next;
    });
  }, []);
  return [settings, update] as const;
}
