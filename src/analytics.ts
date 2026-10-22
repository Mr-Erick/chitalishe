// Обезличенная статистика в GoatCounter: без имён, Telegram ID и текста книг.
// Если счётчик недоступен или заблокирован, событие просто теряется, приложение этого не замечает.
import { local } from "./books/store";
import { tg } from "./telegram";

const ENDPOINT = "https://mrerick.goatcounter.com/count";
/** Событие «чтение» уходит за каждые столько минут чтения: число событий × 5 = минуты. */
export const READ_CHUNK_MIN = 5;
/** Скорость у сессии короче этого не отмечаем: случайный тап по «Читать». Время всё равно копится. */
const MIN_SESSION_MS = 20_000;
const CARRY_KEY = "speedtext:stats-carry";

const enabled = () => !import.meta.env.DEV && import.meta.env.MODE !== "test" && !/^(localhost|127\.|\[::1\])/.test(location.hostname);

function send(params: Record<string, string>) {
  if (!enabled()) return;
  try {
    const q = new URLSearchParams({ ...params, rnd: Math.random().toString(36).slice(2) });
    const url = `${ENDPOINT}?${q}`;
    if (navigator.sendBeacon?.(url)) return;
    new Image().src = url;
  } catch {
    // Нет сети, блокировщик, старый WebView: статистика не важнее чтения.
  }
}

const event = (path: string, title: string) => send({ p: path, t: title, e: "true" });

/** Открыли приложение: один просмотр «страницы» с площадкой (ios, android, tdesktop… или browser). */
export function trackOpen() {
  const platform = tg()?.platform;
  send({ p: "/", t: "SPEEDTEXT", q: `platform=${platform && platform !== "unknown" ? platform : "browser"}` });
}

/** Скачали книгу из «Бесплатной библиотеки». Только книги каталога, свои файлы не считаем. */
export function trackDownload(catalogId: string, title: string) {
  event(`download/${catalogId}`, `Скачали: ${title}`);
}

/** Сотня слов в минуту: 100–199, 200–299 … 1500. */
export const speedBucket = (wpm: number) => {
  const lo = Math.floor(wpm / 100) * 100;
  return lo >= 1500 ? "1500" : `${lo}-${lo + 99}`;
};

/**
 * Время чтения. Остаток меньше 5 минут копится между сессиями и книгами, поэтому короткие сессии тоже доходят.
 * Возвращает, сколько событий «чтение» отправлено.
 */
export function addReadingTime(ms: number): number {
  let total = local.read<number>(CARRY_KEY, 0) + Math.max(0, ms);
  const chunk = READ_CHUNK_MIN * 60_000;
  let sent = 0;
  while (total >= chunk) {
    total -= chunk;
    sent++;
    event(`read/${READ_CHUNK_MIN}min`, `Чтение: ${READ_CHUNK_MIN} минут`);
  }
  local.write(CARRY_KEY, Math.round(total));
  return sent;
}

/** Закончилась сессия чтения (пауза, выход, свернули): копим время и отмечаем скорость. */
export function trackSession(ms: number, wpm: number) {
  addReadingTime(ms);
  if (ms < MIN_SESSION_MS) return;
  const bucket = speedBucket(wpm);
  event(`speed/${bucket}`, `Скорость: ${bucket} сл/мин`);
}
