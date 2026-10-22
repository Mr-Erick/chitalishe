import { IconBook, IconLibrary, IconSliders } from "./icons";

export type Tab = "books" | "catalog" | "settings";

const TABS: { id: Tab; label: string; icon: () => JSX.Element }[] = [
  { id: "books", label: "Мои книги", icon: IconBook },
  { id: "catalog", label: "Библиотека", icon: IconLibrary },
  { id: "settings", label: "Настройки", icon: IconSliders },
];

export function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <nav className="tabbar">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button key={id} className={tab === id ? "on" : ""} onClick={() => onTab(id)}>
          <Icon />
          <span>{label}</span>
        </button>
      ))}
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
