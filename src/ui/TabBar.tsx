import { IconBook, IconSliders } from "./icons";

export type Tab = "books" | "settings";

export function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <nav className="tabbar">
      <button className={tab === "books" ? "on" : ""} onClick={() => onTab("books")}>
        <IconBook /> Книги
      </button>
      <button className={tab === "settings" ? "on" : ""} onClick={() => onTab("settings")}>
        <IconSliders /> Настройки
      </button>
    </nav>
  );
}

export function SectionTitle({ n, children, aside }: { n: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="section-title">
      <span className="num">{n}</span>
      <span className="label">{children}</span>
      <span className="rule" />
      {aside}
    </div>
  );
}

export const Plaque = ({ title, big = false }: { title: string; big?: boolean }) => (
  <span className={`plaque ${big ? "big" : ""}`}>{(title.match(/\p{L}|\p{N}/u)?.[0] ?? "?").toUpperCase()}</span>
);
