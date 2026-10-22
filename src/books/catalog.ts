// Бесплатная библиотека: только общественное достояние (автор и переводчик умерли в 1955 году или раньше).
// Тексты подготовлены вручную и лежат статикой в public/books/, список — здесь.
import type { ChapterText } from "../engine/chapters";
import { addBook, type BookMeta, getBookmarks, getProgress, local, removeBook } from "./store";

export type Shelf = "school" | "russian" | "foreign" | "poetry";

export const SHELVES: { id: Shelf; label: string }[] = [
  { id: "school", label: "Школа" },
  { id: "russian", label: "Русская" },
  { id: "foreign", label: "Зарубежная" },
  { id: "poetry", label: "Стихи" },
];

export interface CatalogEntry {
  /** Короткий id для ссылок: t.me/<бот>?startapp=book-<id>. */
  id: string;
  title: string;
  author: string;
  /** Фамилия для списка. */
  authorShort: string;
  authorYears: string;
  translator?: string;
  translatorYears?: string;
  year: number;
  shelves: Shelf[];
  words: number;
  chapters: number;
  file: string;
}

export const CATALOG: CatalogEntry[] = [
  {
    id: "kapitanskaya-dochka",
    title: "Капитанская дочка",
    author: "Александр Пушкин",
    authorShort: "Пушкин",
    authorYears: "1799–1837",
    year: 1836,
    shelves: ["school", "russian"],
    words: 33710,
    chapters: 15,
    file: "books/kapitanskaya-dochka.json",
  },
  {
    id: "evgeniy-onegin",
    title: "Евгений Онегин",
    author: "Александр Пушкин",
    authorShort: "Пушкин",
    authorYears: "1799–1837",
    year: 1833,
    shelves: ["school", "russian", "poetry"],
    words: 24127,
    chapters: 10,
    file: "books/evgeniy-onegin.json",
  },
  {
    id: "zapiski-ohotnika",
    title: "Записки охотника",
    author: "Иван Тургенев",
    authorShort: "Тургенев",
    authorYears: "1818–1883",
    year: 1852,
    shelves: ["school", "russian"],
    words: 104823,
    chapters: 25,
    file: "books/zapiski-ohotnika.json",
  },
];

/** Бот, через которого открывается приложение; ссылкой делимся на него. */
export const BOT_USERNAME = "fastt_reader_bot";
/** Почта для правообладателей. */
export const SUPPORT_EMAIL = "Ektb66@bk.ru";

export const catalogEntry = (id: string) => CATALOG.find((e) => e.id === id);
export const shareLink = (e: CatalogEntry) => `https://t.me/${BOT_USERNAME}?startapp=book-${e.id}`;

/** «book-kapitanskaya-dochka» из ссылки → книга каталога. */
export function entryFromStartParam(param: string): CatalogEntry | undefined {
  const m = param.match(/^book-([\w-]+)$/);
  return m ? catalogEntry(m[1]) : undefined;
}

/** Эта книга каталога уже есть на устройстве? Ранние версии клали классику без catalogId — узнаём по названию. */
export function localCopy(entry: CatalogEntry, books: BookMeta[]): BookMeta | undefined {
  return books.find((b) => b.catalogId === entry.id) ?? books.find((b) => !b.catalogId && b.title === entry.title && b.author === entry.author);
}

const SEEDED_KEY = "speedtext:seeded";

/**
 * Раньше классика сама клалась в «Мои книги». Теперь она в библиотеке и скачивается по «+»:
 * убираем с устройства те предустановленные копии, которые так и не открывали (ни места чтения, ни закладок).
 */
export async function removeUntouchedSeeds(books: BookMeta[]): Promise<boolean> {
  const seeded = local.read<string[]>(SEEDED_KEY, []);
  if (!seeded.length) return false;
  let removed = false;
  for (const entry of CATALOG) {
    if (!seeded.includes(entry.title)) continue;
    const copy = books.find((b) => !b.catalogId && b.title === entry.title && b.author === entry.author);
    if (copy && !getProgress(copy.id) && !getBookmarks(copy.id).length) {
      await removeBook(copy.id);
      removed = true;
    }
  }
  local.write(
    SEEDED_KEY,
    seeded.filter((t) => !CATALOG.some((e) => e.title === t)),
  );
  return removed;
}

export async function addFromCatalog(entry: CatalogEntry): Promise<BookMeta> {
  const res = await fetch(`${import.meta.env.BASE_URL}${entry.file}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { chapters } = (await res.json()) as { chapters: ChapterText[] };
  return addBook({ title: entry.title, author: entry.author, format: "TXT", chapters, catalogId: entry.id });
}
