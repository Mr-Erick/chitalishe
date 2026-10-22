// Бесплатная библиотека: только общественное достояние (автор и переводчик умерли в 1955 году или раньше).
import type { ChapterText } from "../engine/chapters";
import { addBook, type BookMeta, getBookmarks, getProgress, local, removeBook } from "./store";
import library from "./library.json";

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
  shelves: Shelf[];
  words: number;
  chapters: number;
  /** Путь к книге от корня сайта. */
  file: string;
  bytes: number;
  /** Откуда взят текст (страница Викитеки). */
  source: string;
}

type LibraryRow = Omit<CatalogEntry, "authorShort" | "shelves"> & { shelves: string[] };

/** Стихи и поэмы: в списке книг полки «Стихи» нет, отмечаем здесь. */
const POETRY = new Set([
  "blok-dvenadtsat",
  "esenin-anna-snegina",
  "lermontov-mtsyri",
  "lermontov-pesnya-pro-tsarya-ivana-vasilevicha-molodogo-opric",
  "mayakovskiy-oblako-v-shtanakh",
  "nekrasov-komu-na-rusi-zhit-khorosho",
  "pushkin-evgeniy-onegin",
  "pushkin-mednyy-vsadnik",
  "pushkin-ruslan-i-lyudmila",
  "pushkin-skazka-o-mertvoy-tsarevne-i-o-semi-bogatyryakh",
  "pushkin-skazka-o-tsare-saltane",
  "gomer-iliada",
  "gomer-odisseya",
]);

// Список книг собирается отдельно (Викитека, чистка, проверка прав) и кладётся в library.json, тексты — в public/books/library/.
export const CATALOG: CatalogEntry[] = (library as LibraryRow[]).map((row) => ({
  ...row,
  authorShort: row.author.split(" ").slice(-1)[0],
  shelves: [...(row.shelves as Shelf[]), ...(POETRY.has(row.id) ? (["poetry"] as Shelf[]) : [])],
  file: `books/library/${row.file}`,
}));

/** Первые три книги лежали под другими id: по старым ссылкам и у тех, кто их уже скачал, они должны находиться. */
const OLD_IDS: Record<string, string> = {
  "kapitanskaya-dochka": "pushkin-kapitanskaya-dochka",
  "evgeniy-onegin": "pushkin-evgeniy-onegin",
  "zapiski-ohotnika": "turgenev-zapiski-okhotnika",
};
const currentId = (id: string) => OLD_IDS[id] ?? id;

/** Бот, через которого открывается приложение; ссылкой делимся на него. */
export const BOT_USERNAME = "fastt_reader_bot";
/** Почта для правообладателей. */
export const SUPPORT_EMAIL = "Ektb66@bk.ru";

export const catalogEntry = (id: string) => CATALOG.find((e) => e.id === currentId(id));
export const shareLink = (e: CatalogEntry) => `https://t.me/${BOT_USERNAME}?startapp=book-${e.id}`;

/** «book-kapitanskaya-dochka» из ссылки → книга каталога. */
export function entryFromStartParam(param: string): CatalogEntry | undefined {
  const m = param.match(/^book-([\w-]+)$/);
  return m ? catalogEntry(m[1]) : undefined;
}

/** Эта книга каталога уже есть на устройстве? Ранние версии клали классику без catalogId — узнаём по названию. */
export function localCopy(entry: CatalogEntry, books: BookMeta[]): BookMeta | undefined {
  return books.find((b) => b.catalogId && currentId(b.catalogId) === entry.id) ?? books.find((b) => !b.catalogId && b.title === entry.title && b.author === entry.author);
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
