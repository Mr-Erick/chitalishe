import { useEffect } from "react";

// Не даём экрану погаснуть, пока идёт чтение.
// Где есть Screen Wake Lock API — используем его, иначе (старые iOS/Android WebView в Telegram)
// крутим невидимое беззвучное видео: пока оно играет, система экран не гасит.

interface WakeLockSentinelLike {
  release(): Promise<void>;
}

let video: HTMLVideoElement | null = null;

function fallbackVideo(): HTMLVideoElement {
  if (video) return video;
  video = document.createElement("video");
  video.src = `${import.meta.env.BASE_URL}keep-awake.mp4`;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("aria-hidden", "true");
  Object.assign(video.style, { position: "fixed", width: "1px", height: "1px", opacity: "0", pointerEvents: "none", left: "0", top: "0" });
  document.body.appendChild(video);
  return video;
}

export function useKeepAwake(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let lock: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const acquire = async () => {
      const wl = (navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<WakeLockSentinelLike> } }).wakeLock;
      try {
        if (!wl) throw new Error("no wake lock");
        const l = await wl.request("screen");
        if (cancelled) l.release().catch(() => {});
        else lock = l;
      } catch {
        // Видео надо запускать прямо из нажатия «Читать» — эффект срабатывает в том же такте, этого хватает.
        fallbackVideo().play().catch(() => {});
      }
    };
    // Блокировка снимается, когда приложение сворачивают; возвращаем её при возврате.
    const onVisible = () => {
      if (document.visibilityState === "visible") acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
      video?.pause();
    };
  }, [active]);
}
