import type { Token } from "./tokenize";

export interface TimingOptions {
  /** Без множителей: каждое слово ровно 60000 / wpm мс. */
  strict?: boolean;
}

const letters = (word: string) => word.replace(/[^\p{L}\p{N}]/gu, "").length;

/** Множитель времени показа слова. */
export function delayFactor(token: Token): number {
  const word = token.text;
  let factor = 1;
  const len = letters(word);
  if (len > 12) factor *= 1.5;
  else if (len > 8) factor *= 1.3;
  if (/\d/.test(word)) factor *= 1.5;

  if (token.paragraphEnd) factor *= 2.5;
  else if (/[.!?…]["»”')\]]*$/.test(word)) factor *= 2;
  else if (/[,;:—–-]["»”')\]]*$/.test(word)) factor *= 1.5;
  return factor;
}

export function delayMs(token: Token, wpm: number, options: TimingOptions = {}): number {
  const base = 60000 / wpm;
  return options.strict ? base : base * delayFactor(token);
}

/** Плавный старт: первые слова после «плей» идут медленнее, с 60% до 100% скорости. */
export const RAMP_WORDS = 10;
export function rampFactor(wordsSincePlay: number): number {
  if (wordsSincePlay >= RAMP_WORDS) return 1;
  const speed = 0.6 + (0.4 * wordsSincePlay) / RAMP_WORDS;
  return 1 / speed;
}
