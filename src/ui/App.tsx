import { useCallback, useEffect, useState } from "react";
import { seedLibrary } from "../books/seed";
import { type BookMeta, type BookRecord, getBook, listBooks, removeBook } from "../books/store";
import { tg } from "../telegram";
import { AddSheet } from "./AddSheet";
import { BookScreen } from "./BookScreen";
import { Library } from "./Library";
import { Reader } from "./Reader";
import { SettingsScreen } from "./SettingsScreen";
import { useSettings } from "./settings";
import { TabBar } from "./TabBar";

type View =
  | { name: "books" }
  | { name: "settings"; from?: View }
  | { name: "book"; id: string; tab?: "bookmarks" }
  | { name: "reader"; id: string; start?: number };

export function App() {
  const [settings, update] = useSettings();
  const [books, setBooks] = useState<BookMeta[]>(listBooks);
  const [view, setView] = useState<View>({ name: "books" });
  const [record, setRecord] = useState<BookRecord | null>(null);
  const [adding, setAdding] = useState(false);
  const [missing, setMissing] = useState(false);

  const refresh = useCallback(() => setBooks(listBooks()), []);

  useEffect(() => {
    seedLibrary().then((added) => added && refresh());
  }, [refresh]);

  // Текст книги нужен карточке и чтению; грузим из IndexedDB при переходе.
  const bookId = view.name === "book" || view.name === "reader" ? view.id : null;
  useEffect(() => {
    if (!bookId) return;
    if (record?.id === bookId) return;
    setRecord(null);
    setMissing(false);
    getBook(bookId).then((b) => (b ? setRecord(b) : setMissing(true)));
  }, [bookId, record?.id]);

  const back = useCallback(() => {
    setView((v) => {
      if (v.name === "reader") return { name: "book", id: v.id };
      if (v.name === "settings") return v.from ?? { name: "books" };
      return { name: "books" };
    });
    refresh();
  }, [refresh]);

  // Кнопка «Назад» в Telegram.
  useEffect(() => {
    const button = tg()?.BackButton;
    if (!button) return;
    if (view.name === "books") {
      button.hide();
      return;
    }
    button.show();
    button.onClick(back);
    return () => button.offClick(back);
  }, [view.name, back]);

  let screen: React.ReactNode;
  if (view.name === "settings") {
    screen = <SettingsScreen settings={settings} update={update} onBack={view.from ? back : undefined} />;
  } else if (view.name === "books") {
    screen = (
      <Library
        books={books}
        wpm={settings.wpm}
        onOpen={(id) => setView({ name: "book", id })}
        onContinue={(id) => setView({ name: "reader", id })}
        onAdd={() => setAdding(true)}
      />
    );
  } else if (missing) {
    screen = (
      <main className="app-screen">
        <p className="muted">Текст этой книги удалён с устройства. Добавьте файл заново: место чтения и закладки сохранились.</p>
        <button className="btn dark wide" onClick={() => setView({ name: "books" })}>
          В библиотеку
        </button>
      </main>
    );
  } else if (!record || record.id !== view.id) {
    screen = <main className="app-screen" />;
  } else if (view.name === "book") {
    screen = (
      <BookScreen
        key={`${record.id}:${view.tab ?? ""}`}
        book={record}
        wpm={settings.wpm}
        initialTab={view.tab}
        onBack={back}
        onRead={(start) => setView({ name: "reader", id: record.id, start })}
        onDelete={async () => {
          await removeBook(record.id);
          setRecord(null);
          refresh();
          setView({ name: "books" });
        }}
      />
    );
  } else {
    screen = (
      <Reader
        key={`${record.id}:${view.start ?? ""}`}
        book={record}
        startIndex={view.start}
        settings={settings}
        onExit={back}
        onOpenSettings={() => setView({ name: "settings", from: { name: "reader", id: record.id } })}
        onAllBookmarks={() => setView({ name: "book", id: record.id, tab: "bookmarks" })}
      />
    );
  }

  const showTabs = view.name === "books" || (view.name === "settings" && !view.from);
  return (
    <>
      {screen}
      {showTabs && <TabBar tab={view.name === "settings" ? "settings" : "books"} onTab={(t) => setView(t === "books" ? { name: "books" } : { name: "settings" })} />}
      {adding && (
        <AddSheet
          onClose={() => setAdding(false)}
          onAdded={(b) => {
            setAdding(false);
            refresh();
            setView({ name: "book", id: b.id });
          }}
        />
      )}
    </>
  );
}
