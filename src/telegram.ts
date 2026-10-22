// Тонкая обёртка над Telegram WebApp: вне Telegram все вызовы молча ничего не делают.
interface TelegramWebApp {
  ready(): void;
  expand(): void;
  disableVerticalSwipes?(): void;
  platform?: string;
  initDataUnsafe?: { start_param?: string };
  openTelegramLink?(url: string): void;
  safeAreaInset?: { bottom: number };
  onEvent?(event: "safeAreaChanged", cb: () => void): void;
  HapticFeedback?: { impactOccurred(style: "light" | "medium"): void; selectionChanged(): void };
  BackButton?: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export const tg = (): TelegramWebApp | undefined => window.Telegram?.WebApp;

export function initTelegram() {
  const app = tg();
  app?.ready();
  app?.expand();
  app?.disableVerticalSwipes?.();
  if (!app) return;
  // Нижний отступ под полоску Home. Новые Telegram сами сообщают safeAreaInset; старым на iPhone даём запас.
  const applyInset = () => {
    const reported = app.safeAreaInset?.bottom ?? 0;
    const bottom = Math.max(reported, app.platform === "ios" ? 24 : 0);
    document.documentElement.style.setProperty("--tg-safe-area-inset-bottom", `${bottom}px`);
  };
  applyInset();
  app.onEvent?.("safeAreaChanged", applyInset);
}

/** Параметр из ссылки t.me/<бот>?startapp=…; вне Telegram — из адреса страницы, чтобы проверять в браузере. */
export function startParam(): string {
  const fromTg = tg()?.initDataUnsafe?.start_param;
  if (fromTg) return fromTg;
  const q = new URLSearchParams(location.search);
  return q.get("tgWebAppStartParam") ?? q.get("startapp") ?? "";
}

/** Ссылка на t.me: внутри Telegram открываем средствами Telegram, иначе в новой вкладке. */
export function openTelegramLink(url: string) {
  const app = tg();
  if (app?.openTelegramLink) app.openTelegramLink(url);
  else window.open(url, "_blank");
}

export const haptic = {
  tap: () => tg()?.HapticFeedback?.impactOccurred("light"),
  tick: () => tg()?.HapticFeedback?.selectionChanged(),
};
