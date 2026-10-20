// Небольшой набор иконок, чтобы не тянуть библиотеку.
const base = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const IconArrowLeft = () => (
  <svg {...base}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
);
export const IconArrowRight = () => (
  <svg {...base}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const IconSearch = () => (
  <svg {...base}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
);
export const IconBook = () => (
  <svg {...base}><path d="M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3zM21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z" /></svg>
);
export const IconSliders = () => (
  <svg {...base}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
);
export const IconPlus = () => (
  <svg {...base}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconMore = () => (
  <svg {...base}><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></svg>
);
export const IconPlay = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z" /></svg>
);
export const IconPause = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
);
export const IconBookmark = ({ filled = false }: { filled?: boolean }) => (
  <svg {...base} fill={filled ? "currentColor" : "none"}><path d="M6 3h12v18l-6-5-6 5z" /></svg>
);
export const IconPrev = () => (
  <svg {...base}><path d="M6 5v14M19 6l-9 6 9 6z" /></svg>
);
export const IconNext = () => (
  <svg {...base}><path d="M18 5v14M5 6l9 6-9 6z" /></svg>
);
