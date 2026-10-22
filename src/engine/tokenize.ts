import type { Cleaner } from "./cleanup";

export interface Token {
  /** Слово вместе с прилипшей пунктуацией: «минуту.», «(например,». */
  text: string;
  /** Последнее слово абзаца. */
  paragraphEnd: boolean;
  /** Индекс первого слова предложения, к которому относится токен. */
  sentenceStart: number;
  /** Мусор (номер страницы, колонтитул, сноска): SPEEDTEXT его пропускает, в предпросмотре слово остаётся. */
  skip?: boolean;
  /** Что показывать в SPEEDTEXT, если отличается от text: слово без метки сноски. */
  shown?: string;
}

const SENTENCE_END = /[.!?…]["»”')\]]*$/;

/** Слово для показа в SPEEDTEXT. */
export const shownText = (t: Token) => t.shown ?? t.text;

export function tokenize(text: string, cleaner?: Cleaner): Token[] {
  const tokens: Token[] = [];
  const paragraphs = text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n|\n(?=\s)/)
    .map((p) => p.trim())
    .filter(Boolean);

  let sentenceStart = 0;
  for (const paragraph of paragraphs) {
    // Слова те же, что при простом делении абзаца по пробелам: очистка только помечает их, индексы не сдвигаются.
    const note = cleaner?.noteParagraph(paragraph) ?? false;
    const words: { text: string; junk: boolean }[] = [];
    for (const line of paragraph.split("\n")) {
      const junk = note || (cleaner?.junkLine(line.trim()) ?? false);
      for (const w of line.split(/\s+/)) if (w) words.push({ text: w, junk });
    }
    words.forEach(({ text: word, junk }, i) => {
      const index = tokens.length;
      const token: Token = { text: word, paragraphEnd: i === words.length - 1, sentenceStart };
      if (cleaner) {
        const clean = cleaner.word(word);
        // Слово, от которого после снятия метки ничего не осталось («[12]»), тоже пропускаем; одинокое тире — нет.
        if (junk || (clean !== word && !/[\p{L}\p{N}]/u.test(clean))) token.skip = true;
        else if (clean !== word) token.shown = clean;
      }
      tokens.push(token);
      if (SENTENCE_END.test(word) || i === words.length - 1) sentenceStart = index + 1;
    });
  }
  return tokens;
}

/** Начало предложения, следующего за тем, где стоит index. */
export function nextSentenceStart(tokens: Token[], index: number): number {
  const current = tokens[index]?.sentenceStart ?? 0;
  for (let i = index + 1; i < tokens.length; i++) {
    if (tokens[i].sentenceStart !== current) return tokens[i].sentenceStart;
  }
  return tokens.length - 1;
}

/** Начало текущего предложения, а если мы уже на нём — предыдущего. */
export function prevSentenceStart(tokens: Token[], index: number): number {
  const current = tokens[index]?.sentenceStart ?? 0;
  if (index > current) return current;
  return current > 0 ? tokens[current - 1].sentenceStart : 0;
}
