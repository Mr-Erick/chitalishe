import { type Token, tokenize } from "./tokenize";

export interface ChapterText {
  title: string;
  text: string;
}

export interface Chapter {
  title: string;
  /** Индекс первого и последнего слова главы в общем списке слов книги. */
  start: number;
  end: number;
}

// Строка-заголовок: «Глава 3», «ГЛАВА ПЕРВАЯ», «Часть II», «Chapter 1», «XII», «***».
const HEADING =
  /^\s*((глава|часть|chapter|part|пролог|эпилог|prologue|epilogue)(?!\p{L}).{0,60}|[IVXLC]{1,7}\.?|\d{1,3}\.?|\*\s*\*\s*\*)\s*$/iu;

/** Если глав нет, режем на части примерно такого размера по границам абзацев. */
export const PART_WORDS = 2000;

/** Делит простой текст на главы по строкам-заголовкам. */
export function splitChapters(text: string): ChapterText[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const chapters: ChapterText[] = [];
  let title = "";
  let body: string[] = [];
  const flush = () => {
    const chunk = body.join("\n").trim();
    if (chunk) chapters.push({ title, text: chunk });
    body = [];
  };
  for (const line of lines) {
    if (HEADING.test(line) && line.trim().length < 80) {
      flush();
      title = line.trim();
    } else {
      body.push(line);
    }
  }
  flush();
  if (chapters.length > 1) return chapters.map((c) => ({ ...c, title: c.title || "Начало" }));
  return splitIntoParts(chapters[0]?.text ?? "");
}

/** Режет текст без глав на части по ~PART_WORDS слов, не разрывая абзацы. */
export function splitIntoParts(text: string): ChapterText[] {
  const paragraphs = text.split(/\n\s*\n/);
  const parts: ChapterText[] = [];
  let current: string[] = [];
  let words = 0;
  for (const p of paragraphs) {
    current.push(p);
    words += p.split(/\s+/).filter(Boolean).length;
    if (words >= PART_WORDS) {
      parts.push({ title: `Часть ${parts.length + 1}`, text: current.join("\n\n") });
      current = [];
      words = 0;
    }
  }
  if (current.join("").trim()) parts.push({ title: `Часть ${parts.length + 1}`, text: current.join("\n\n") });
  if (parts.length === 1) parts[0].title = "Текст";
  return parts;
}

/** Слова всей книги одним списком плюс границы глав. */
export function tokenizeBook(chapters: ChapterText[]): { tokens: Token[]; chapters: Chapter[] } {
  const tokens: Token[] = [];
  const result: Chapter[] = [];
  for (const ch of chapters) {
    const offset = tokens.length;
    const part = tokenize(ch.text);
    if (!part.length) continue;
    for (const t of part) tokens.push({ ...t, sentenceStart: t.sentenceStart + offset });
    result.push({ title: ch.title, start: offset, end: tokens.length - 1 });
  }
  return { tokens, chapters: result };
}

export function chapterAt(chapters: Chapter[], index: number): number {
  for (let i = chapters.length - 1; i >= 0; i--) if (index >= chapters[i].start) return i;
  return 0;
}
