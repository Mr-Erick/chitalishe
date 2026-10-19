// Тонкая обёртка над Telegram WebApp: вне Telegram все вызовы молча ничего не делают.
interface TelegramWebApp {
  ready(): void;
  expand(): void;
  disableVerticalSwipes?(): void;
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
}

export const haptic = {
  tap: () => tg()?.HapticFeedback?.impactOccurred("light"),
  tick: () => tg()?.HapticFeedback?.selectionChanged(),
};
