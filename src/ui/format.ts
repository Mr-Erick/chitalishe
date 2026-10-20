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
