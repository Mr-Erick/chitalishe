// Предустановленные книги: кладутся в библиотеку один раз, при первом запуске.
// Классика лежит в public/books/ как JSON с готовыми главами и скачивается только при первом запуске, а не входит в сборку.
// Источник и лицензия текстов — в поле source/license каждого файла (общественное достояние).
import type { ChapterText } from "../engine/chapters";
import { splitChapters } from "../engine/chapters";
import { addBook, local } from "./store";
import { SAMPLE_TEXT } from "./sample";

interface SeedEntry {
  title: string;
  author: string;
  /** JSON в public/books/ с полем chapters: ChapterText[], или текст прямо здесь. */
  file?: string;
  text?: string;
}

// Книги ложатся в библиотеку по порядку, последняя оказывается сверху.
const SEEDS: SeedEntry[] = [
  { title: "Записки охотника", author: "Иван Тургенев", file: "books/zapiski-ohotnika.json" },
  { title: "Евгений Онегин", author: "Александр Пушкин", file: "books/evgeniy-onegin.json" },
  { title: "Капитанская дочка", author: "Александр Пушкин", file: "books/kapitanskaya-dochka.json" },
  { title: "Как читать быстро", author: "SPEEDTEXT", text: SAMPLE_TEXT },
];

const SEEDED_KEY = "speedtext:seeded";

async function loadChapters(seed: SeedEntry): Promise<ChapterText[]> {
  if (seed.text) return splitChapters(seed.text);
  const res = await fetch(`${import.meta.env.BASE_URL}${seed.file}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { chapters } = (await res.json()) as { chapters: ChapterText[] };
  return chapters;
}

export async function seedLibrary(): Promise<boolean> {
  const done = local.read<string[]>(SEEDED_KEY, []);
  const pending = SEEDS.filter((s) => !done.includes(s.title));
  if (!pending.length) return false;
  let added = false;
  for (const seed of pending) {
    try {
      await addBook({ title: seed.title, author: seed.author, format: "TXT", chapters: await loadChapters(seed) });
      done.push(seed.title);
      added = true;
    } catch {
      // Нет сети или хранилища — попробуем при следующем запуске.
    }
  }
  local.write(SEEDED_KEY, done);
  return added;
}
