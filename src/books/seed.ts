// Предустановленные книги: кладутся в библиотеку один раз, при первом запуске.
// Большие тексты лежат в public/books/ и скачиваются только при первом запуске, а не входят в сборку.
import { parsePasted } from "./parse";
import { splitChapters } from "../engine/chapters";
import { addBook, local } from "./store";
import { SAMPLE_TEXT } from "./sample";

interface SeedEntry {
  title: string;
  author: string;
  /** Путь к TXT в public/books/ или текст прямо здесь. */
  file?: string;
  text?: string;
}

const SEEDS: SeedEntry[] = [{ title: "Как читать быстро", author: "SPEEDTEXT", text: SAMPLE_TEXT }];

const SEEDED_KEY = "speedtext:seeded";

export async function seedLibrary(): Promise<boolean> {
  const done = local.read<string[]>(SEEDED_KEY, []);
  const pending = SEEDS.filter((s) => !done.includes(s.title));
  if (!pending.length) return false;
  for (const seed of pending) {
    try {
      const text: string = seed.text ?? (await fetch(`${import.meta.env.BASE_URL}${seed.file}`).then((r) => r.text()));
      const parsed = parsePasted(text);
      await addBook({ ...parsed, title: seed.title, author: seed.author, format: "TXT", chapters: splitChapters(text) });
      done.push(seed.title);
    } catch {
      // Нет сети или хранилища — попробуем при следующем запуске.
    }
  }
  local.write(SEEDED_KEY, done);
  return true;
}
