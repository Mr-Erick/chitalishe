// Тонкая обёртка над Telegram WebApp: вне Telegram все вызовы молча ничего не делают.
interface TelegramWebApp {
  ready(): void;
  expand(): void;
  disableVerticalSwipes?(): void;
  platform?: string;
  initDataUnsafe?: { start_param?: string };
  openTelegramLink?(url: string): void;
  openLink?(url: string): void;
  safeAreaInset?: { top?: number; bottom: number };
  contentSafeAreaInset?: { top?: number };
  onEvent?(event: "safeAreaChanged" | "contentSafeAreaChanged" | "fullscreenChanged", cb: () => void): void;
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
    const css = document.documentElement.style;
    css.setProperty("--tg-safe-area-inset-bottom", `${bottom}px`);
    // Сверху: вырез камеры плюс полоса с кнопками Telegram в полноэкранном режиме.
    css.setProperty("--tg-safe-area-inset-top", `${app.safeAreaInset?.top ?? 0}px`);
    css.setProperty("--tg-content-safe-area-inset-top", `${app.contentSafeAreaInset?.top ?? 0}px`);
  };
  applyInset();
  app.onEvent?.("safeAreaChanged", applyInset);
  app.onEvent?.("contentSafeAreaChanged", applyInset);
  app.onEvent?.("fullscreenChanged", applyInset);
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

const inTelegram = () => {
  const platform = tg()?.platform;
  return !!platform && platform !== "unknown";
};

/**
 * Письмо на почту. Внутри Telegram переход на mailto: роняет мини-приложение (ERR_UNKNOWN_URL_SCHEME),
 * а openLink принимает только http(s). Поэтому открываем во внешнем браузере свою страницу mail.html,
 * она уже передаёт письмо почтовому приложению. Письмо идёт после #, на сервер оно не отправляется.
 */
export function openMail(mailto: string) {
  const app = tg();
  if (inTelegram() && app?.openLink) app.openLink(`${new URL("mail.html", document.baseURI)}#${encodeURIComponent(mailto)}`);
  else window.location.href = mailto;
}

export const haptic = {
  tap: () => tg()?.HapticFeedback?.impactOccurred("light"),
  tick: () => tg()?.HapticFeedback?.selectionChanged(),
};
