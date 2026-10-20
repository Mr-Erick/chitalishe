// Хранение на устройстве: тексты книг в IndexedDB, прогресс, закладки и настройки в localStorage.
import type { ChapterText } from "../engine/chapters";
import type { BookFormat, ParsedBook } from "./parse";

export interface BookRecord {
  id: string;
  title: string;
  author: string;
  format: BookFormat;
  chapters: ChapterText[];
  words: number;
  addedAt: number;
}

export type BookMeta = Omit<BookRecord, "chapters"> & { chapterCount: number };

export interface Progress {
  index: number;
  /** Последняя скорость в этой книге. */
  wpm?: number;
  openedAt: number;
}

export interface Bookmark {
  id: string;
  index: number;
  chapter: number;
  percent: number;
  fragment: string;
  note: string;
  createdAt: number;
}

const DB = "speedtext";
const STORE = "books";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---- localStorage с защитой от приватного режима ----

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Нет места или хранилище недоступно — читаем дальше без сохранения.
  }
}

export const local = { read: readJson, write: writeJson };

// ---- книги ----

async function fingerprint(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  if (crypto.subtle) {
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
  }
  let h = 0;
  for (const b of data) h = (h * 31 + b) >>> 0;
  return `h${h.toString(16)}${data.length}`;
}

const META_KEY = "speedtext:library";

export function listBooks(): BookMeta[] {
  return readJson<BookMeta[]>(META_KEY, []);
}

export async function addBook(parsed: ParsedBook): Promise<BookMeta> {
  const full = parsed.chapters.map((c) => c.text).join("\n\n");
  const record: BookRecord = {
    id: await fingerprint(full),
    ...parsed,
    words: full.split(/\s+/).filter(Boolean).length,
    addedAt: Date.now(),
  };
  await tx("readwrite", (s) => s.put(record));
  const { chapters, ...rest } = record;
  const meta: BookMeta = { ...rest, chapterCount: chapters.length };
  writeJson(META_KEY, [meta, ...listBooks().filter((b) => b.id !== meta.id)]);
  return meta;
}

export function getBook(id: string): Promise<BookRecord | undefined> {
  return tx("readonly", (s) => s.get(id));
}

/** Прогресс и закладки не трогаем: если добавить книгу снова, они вернутся. */
export async function removeBook(id: string) {
  await tx("readwrite", (s) => s.delete(id));
  writeJson(
    META_KEY,
    listBooks().filter((b) => b.id !== id),
  );
}

// ---- прогресс и закладки ----

export const getProgress = (id: string) => readJson<Progress | null>(`speedtext:progress:${id}`, null);
export const saveProgress = (id: string, p: Omit<Progress, "openedAt">) =>
  writeJson(`speedtext:progress:${id}`, { ...p, openedAt: Date.now() });

export const getBookmarks = (id: string) => readJson<Bookmark[]>(`speedtext:bookmarks:${id}`, []);
export const saveBookmarks = (id: string, list: Bookmark[]) =>
  writeJson(
    `speedtext:bookmarks:${id}`,
    [...list].sort((a, b) => a.index - b.index),
  );
