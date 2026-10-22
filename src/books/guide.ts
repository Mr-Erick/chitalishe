// «Как читать быстро»: короткая инструкция, которая один раз сама кладётся в «Мои книги».
// Если её удалить, она больше не появится.
import type { ChapterText } from "../engine/chapters";
import { addBook, type BookMeta, local } from "./store";

const GUIDE_KEY = "speedtext:guide-added";
export const GUIDE_TITLE = "Как читать быстро";
export const GUIDE_AUTHOR = "SPEEDTEXT";

export async function addGuideOnce(books: BookMeta[]): Promise<boolean> {
  if (local.read(GUIDE_KEY, false)) return false;
  // У тех, кто ставил приложение до библиотеки, инструкция уже лежит.
  if (!books.some((b) => b.title === GUIDE_TITLE && b.author === GUIDE_AUTHOR)) {
    const res = await fetch(`${import.meta.env.BASE_URL}books/speedtext-guide.json`);
    if (!res.ok) return false;
    const { chapters } = (await res.json()) as { chapters: ChapterText[] };
    await addBook({ title: GUIDE_TITLE, author: GUIDE_AUTHOR, format: "TXT", chapters });
  }
  local.write(GUIDE_KEY, true);
  return true;
}
