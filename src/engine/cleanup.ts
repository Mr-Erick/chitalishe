// Мусор, который остаётся в книгах, сконвертированных из PDF и сканов: номера страниц, колонтитулы, сноски.
// Ничего не вырезаем из текста: только помечаем слова, которые SPEEDTEXT пропускает. Предпросмотр показывает всё.

/** Строка — номер страницы: «12», «- 12 -», «— 12 —», «Стр. 12», «12 из 300», «Page 12». */
const PAGE_NUMBER = /^[-–—\s]*(?:(?:стр|с|page|p)\.?\s*)?\d{1,4}(?:\s*(?:из|\/|of)\s*\d{1,4})?[-–—\s]*$/i;
/** Сноска в слове: «слово[12]», «слово{3}», «слово¹²». Звёздочки не трогаем: в классике это скрытые имена, «князь Б**», «в *** губернии». */
const NOTE_MARK = /\[\d{1,3}\]|\{\d{1,3}\}|[¹²³⁰⁴⁵⁶⁷⁸⁹]+/g;
/** Абзац — текст сноски: начинается с метки «[12]», «{12}» или «¹». */
const NOTE_PARAGRAPH = /^(?:\[\d{1,3}\]|\{\d{1,3}\}|[¹²³⁰⁴⁵⁶⁷⁸⁹]+)/;

/** Колонтитул повторяется хотя бы столько раз… */
const HEADER_MIN_REPEATS = 3;
/** …и между повторами в среднем не меньше стольких слов (страница), иначе это припев стихотворения. */
const HEADER_MIN_GAP_WORDS = 120;
const HEADER_MAX_CHARS = 80;

const lines = (text: string) => text.replace(/\r\n?/g, "\n").split("\n");
/** Колонтитул часто идёт вместе с номером страницы: «12 Капитанская дочка», поэтому цифры не учитываем. */
const headerKey = (line: string) => line.replace(/\d+/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/** Строки, которые повторяются по всей книге через страницу: название книги, автор, «Глава 3» над каждой страницей. */
export function findRunningHeaders(texts: string[]): Set<string> {
  const seen = new Map<string, { count: number; first: number; last: number }>();
  let words = 0;
  for (const text of texts) {
    for (const raw of lines(text)) {
      const line = raw.trim();
      if (!line) continue;
      const key = headerKey(line);
      if (key && line.length <= HEADER_MAX_CHARS && /\p{L}/u.test(key) && !/^[-–—«"„]/.test(line)) {
        const s = seen.get(key);
        if (s) {
          s.count++;
          s.last = words;
        } else seen.set(key, { count: 1, first: words, last: words });
      }
      words += line.split(/\s+/).length;
    }
  }
  const headers = new Set<string>();
  for (const [key, s] of seen) {
    if (s.count >= HEADER_MIN_REPEATS && (s.last - s.first) / (s.count - 1) >= HEADER_MIN_GAP_WORDS) headers.add(key);
  }
  return headers;
}

export interface Cleaner {
  /** Строка целиком мусорная: номер страницы или колонтитул. */
  junkLine(line: string): boolean;
  /** Абзац — текст сноски. */
  noteParagraph(paragraph: string): boolean;
  /** Слово без меток сносок; пустая строка — слово целиком метка. */
  word(word: string): string;
}

export function makeCleaner(texts: string[]): Cleaner {
  const headers = findRunningHeaders(texts);
  return {
    junkLine: (line) => PAGE_NUMBER.test(line) || headers.has(headerKey(line)),
    noteParagraph: (p) => NOTE_PARAGRAPH.test(p),
    word: (w) => w.replace(NOTE_MARK, ""),
  };
}
