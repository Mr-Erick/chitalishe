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

// ---- Распознавание заголовков в простом тексте ----

const KEY = "глава|часть|книга|том|chapter|part|book";
const SOLO = "пролог|эпилог|предисловие|послесловие|вступление|заключение|приложение|prologue|epilogue|preface|introduction|afterword|appendix";
const ORDINAL =
  "(?:перв|втор|трет|четв[её]рт|пят|шест|седьм|восьм|девят|десят|одиннадцат|двенадцат|тринадцат|четырнадцат|пятнадцат|шестнадцат|семнадцат|восемнадцат|девятнадцат|двадцат|тридцат|последн)\\p{L}*" +
  "|one|two|three|four|five|six|seven|eight|nine|ten|first|second|third|fourth|fifth|last";
const NUM = `(?:\\d{1,3}|[IVXLCDM]{1,7}|${ORDINAL})`;
const TAIL = "(?:\\s*[.:—–-]\\s*(.{0,60}))?";

// «Глава 3», «ГЛАВА ПЕРВАЯ», «Часть II. Буран», «Chapter 1: The Boy»
const KEY_NUM = new RegExp(`^(?:${KEY})\\s+${NUM}\\.?${TAIL}$`, "iu");
// «Первая глава», «Часть первая» уже выше
const NUM_KEY = new RegExp(`^(?:${ORDINAL})\\s+(?:${KEY})$`, "iu");
// «Пролог», «Эпилог. Через десять лет»
const SOLO_KEY = new RegExp(`^(?:${SOLO})\\.?${TAIL}$`, "iu");
// «XII», «I. Детство», «IV — Встреча»
const ROMAN = /^[IVXLC]{1,7}\.?(?:\s*[.:—–-]?\s+(\p{Lu}.{0,60}))?$/u;
const DIGITS = /^\d{1,3}\.?$/u;
const STARS = /^\*\s*\*\s*\*$/u;
const CHAPTER_WORD = /^(глава|chapter)/iu;

type HeadingKind = "chapter" | "part" | "weak";

interface Heading {
  kind: HeadingKind;
  title: string;
  /** В той же строке уже есть название: «Глава 3. Встреча». */
  hasTail?: boolean;
}

const letters = (s: string) => s.match(/\p{L}/gu) ?? [];

/** Короткая строка капсом: «ДЕТСТВО», «В ДЕРЕВНЕ». */
function isCaps(line: string): boolean {
  const ls = letters(line);
  return (
    ls.length >= 3 &&
    line.length <= 60 &&
    line.split(/\s+/).length <= 8 &&
    !/^[—–-]/u.test(line) &&
    !/[,;:!?…]$/u.test(line) &&
    ls.every((c) => c === c.toUpperCase() && c !== c.toLowerCase())
  );
}

/** Что это за строка: заголовок главы, части или «слабый» кандидат (номер, капс, звёздочки). */
export function classifyHeading(raw: string): Heading | null {
  const line = raw.trim();
  if (!line || line.length > 80) return null;
  const m = line.match(KEY_NUM) ?? line.match(NUM_KEY);
  if (m) return { kind: CHAPTER_WORD.test(line) ? "chapter" : "part", title: line, hasTail: !!m[1] };
  const solo = line.match(SOLO_KEY);
  if (solo) return { kind: "part", title: line, hasTail: !!solo[1] };
  if (ROMAN.test(line) || DIGITS.test(line) || STARS.test(line) || isCaps(line)) return { kind: "weak", title: line };
  return null;
}

/** Подзаголовок сразу после «Глава I»: короткий, без точки в конце, отдельной строкой. */
function isSubtitle(line: string, after: string | undefined): boolean {
  const t = line.trim();
  const h = classifyHeading(t);
  if (!t || t.length > 60 || t.split(/\s+/).length > 8 || (h && h.kind !== "weak") || ROMAN.test(t) || DIGITS.test(t)) return false;
  if (!/^\p{Lu}/u.test(t) || /[.,;:!?…—-]$/u.test(t)) return false;
  return isCaps(t) || !after || !after.trim();
}

/** Отдельный абзац из пары слов без точки: «Хорь и Калиныч». */
function isStandaloneTitle(raw: string): boolean {
  const t = raw.trim();
  return t.length <= 50 && t.split(/\s+/).length <= 6 && /^\p{Lu}/u.test(t) && !/[.,;:!?…—«»"“”()-]/u.test(t) && letters(t).length >= 3;
}

/** «ГЛАВА ПЕРВАЯ. СЕРЖАНТ ГВАРДИИ» → «Глава первая. Сержант гвардии»; римские номера не трогаем. */
export function prettifyTitle(title: string): string {
  const t = title.replace(/\s+/g, " ").trim();
  if (letters(t).some((c) => c !== c.toUpperCase())) return t;
  let first = true;
  return t.replace(/([.:—–-]\s*)?(\p{L}+)/gu, (_, sep: string | undefined, w: string) => {
    if (/^[IVXLC]{1,7}$/.test(w)) return (sep ?? "") + w;
    const cap = first || !!sep;
    first = false;
    return (sep ?? "") + (cap ? w[0] + w.slice(1).toLowerCase() : w.toLowerCase());
  });
}

/** Если глав нет, режем на части примерно такого размера по границам абзацев. */
export const PART_WORDS = 2000;

/** Глава короче этого с «слабым» заголовком считается ложной и приклеивается к предыдущей. */
export const MIN_CHAPTER_WORDS = 150;
/** Если в книге есть «Глава …», прочие заголовки внутри неё должны быть гораздо длиннее. */
const STRICT_MIN_WORDS = 1000;

const countWords = (s: string) => s.split(/\s+/).filter(Boolean).length;

interface Draft {
  title: string;
  heading: string[];
  body: string[];
  weak: boolean;
}

/** Делит простой текст на главы по строкам-заголовкам. */
export function splitChapters(text: string): ChapterText[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blank = (k: number) => k < 0 || k >= lines.length || !lines[k].trim();
  const found = lines.map((line, k) => classifyHeading(line) ?? (blank(k - 1) && blank(k + 1) && isStandaloneTitle(line) ? { kind: "weak" as const, title: line.trim() } : null));
  const strict = found.filter((h) => h?.kind === "chapter").length >= 2;

  const drafts: Draft[] = [];
  let cur: Draft = { title: "", heading: [], body: [], weak: false };
  for (let i = 0; i < lines.length; i++) {
    const h = found[i];
    // Номера и звёздочки внутри настоящих глав — строфы и сцены, не главы.
    if (!h || (strict && h.kind === "weak" && (ROMAN.test(h.title) || DIGITS.test(h.title) || STARS.test(h.title)))) {
      cur.body.push(lines[i]);
      continue;
    }
    const heading = [lines[i]];
    let title = h.title;
    // Подзаголовок на следующей непустой строке: «Глава I» + «Сержант гвардии».
    let j = i + 1;
    while (j < lines.length && !lines[j].trim()) j++;
    const bare = h.kind !== "weak" ? !h.hasTail : ROMAN.test(h.title) || DIGITS.test(h.title);
    if (bare && j < lines.length && isSubtitle(lines[j], lines[j + 1])) {
      title = `${title.replace(/[.:]$/u, "")}. ${lines[j].trim()}`;
      heading.push(lines[j]);
      i = j;
    }
    if (!cur.body.join("").trim() && cur.title) {
      // Заголовок сразу за заголовком: «Часть первая» + «Глава 1»; «слабый» просто заменяем.
      cur.title = cur.weak ? title : `${cur.title} · ${title}`;
      cur.body.push(...cur.heading);
      cur.heading = heading;
      cur.weak = h.kind === "weak";
      continue;
    }
    drafts.push(cur);
    cur = { title, heading, body: [], weak: h.kind === "weak" };
  }
  drafts.push(cur);

  // Ложные главы (короткие, со «слабым» заголовком) возвращаем в текст предыдущей.
  const merged: Draft[] = [];
  for (const d of drafts) {
    const prev = merged[merged.length - 1];
    if (prev && d.weak && countWords(d.body.join(" ")) < (strict ? STRICT_MIN_WORDS : MIN_CHAPTER_WORDS)) {
      prev.body.push(...d.heading, ...d.body);
    } else merged.push(d);
  }
  // Короткое вступление до первой главы (название, автор) — в начало первой главы.
  const chapters = merged
    .map((d) => ({ title: d.title ? prettifyTitle(d.title) : "", text: d.body.join("\n").trim(), heading: d.heading }))
    .filter((c, i) => c.text || i > 0);
  if (chapters.length > 1 && !chapters[0].title && countWords(chapters[0].text) < MIN_CHAPTER_WORDS) {
    chapters[1].text = `${chapters[0].text}\n\n${chapters[1].text}`.trim();
    chapters.shift();
  }
  const result = chapters.filter((c) => c.text).map(({ title, text }) => ({ title: title || "Начало", text }));
  if (result.length > 1) return result;
  return splitIntoParts(lines.join("\n").trim());
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
