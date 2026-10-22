/** «~3 ч 10 мин», «~4 мин». */
export function formatDuration(words: number, wpm: number): string {
  const minutes = Math.max(1, Math.round(words / Math.max(wpm, 1)));
  if (minutes < 60) return `~${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `~${h} ч ${m} мин` : `~${h} ч`;
}

export const formatNumber = (n: number) => n.toLocaleString("ru-RU");

export const percent = (index: number, total: number) => (total > 1 ? Math.round((index / (total - 1)) * 100) : 100);

/** Кегль названия книги: самое длинное слово должно влезть в строку целиком, а не рваться посередине. */
export function titleSize(title: string, max = 34): string {
  const longest = Math.max(1, ...title.split(/\s+/).map((w) => w.length));
  // Широкий гротеск капсом: буква ≈ 0.95 кегля. Ширина строки — экран минус поля 16px с двух сторон.
  return `min(${max}px, calc((min(100vw, 560px) - 32px) / ${(longest * 0.95).toFixed(2)}))`;
}
