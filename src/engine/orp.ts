const LETTER = /[\p{L}\p{N}]/u;

/** Индекс опорной буквы (с 0) внутри строки слова, пунктуация по краям пропускается. */
export function orpIndex(word: string): number {
  const first = [...word].findIndex((ch) => LETTER.test(ch));
  if (first < 0) return 0;
  let last = word.length - 1;
  while (last > first && !LETTER.test(word[last])) last--;
  const length = last - first + 1;
  const offset = length <= 1 ? 0 : length <= 5 ? 1 : length <= 9 ? 2 : length <= 13 ? 3 : 4;
  return first + offset;
}

export function splitAtOrp(word: string): [string, string, string] {
  const i = orpIndex(word);
  return [word.slice(0, i), word.charAt(i), word.slice(i + 1)];
}
