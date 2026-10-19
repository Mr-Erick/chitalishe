export interface Token {
  /** Слово вместе с прилипшей пунктуацией: «минуту.», «(например,». */
  text: string;
  /** Последнее слово абзаца. */
  paragraphEnd: boolean;
  /** Индекс первого слова предложения, к которому относится токен. */
  sentenceStart: number;
}

const SENTENCE_END = /[.!?…]["»”')\]]*$/;

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const paragraphs = text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n|\n(?=\s)/)
    .map((p) => p.trim())
    .filter(Boolean);

  let sentenceStart = 0;
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    words.forEach((word, i) => {
      const index = tokens.length;
      tokens.push({ text: word, paragraphEnd: i === words.length - 1, sentenceStart });
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
