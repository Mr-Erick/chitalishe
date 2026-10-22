import { useCallback, useEffect, useState } from "react";
import { addFromCatalog, type CatalogEntry, catalogEntry, entryFromStartParam, localCopy, removeUntouchedSeeds } from "../books/catalog";
import { type BookMeta, type BookRecord, getBook, listBooks, removeBook, renameBook } from "../books/store";
import { startParam, tg } from "../telegram";
import { AddSheet } from "./AddSheet";
import { BookScreen } from "./BookScreen";
import { Catalog } from "./Catalog";
import { CatalogBook } from "./CatalogBook";
import { RightsScreen } from "./RightsScreen";
import { ShareSheet } from "./ShareSheet";
import { Library } from "./Library";
import { Preview } from "./Preview";
import { Reader } from "./Reader";
import { SettingsScreen } from "./SettingsScreen";
import { useSettings } from "./settings";
import { TabBar } from "./TabBar";

type View =
  | { name: "books" }
  | { name: "catalog" }
  | { name: "catalog-book"; id: string; shared?: boolean }
  | { name: "settings"; from?: View }
  | { name: "rights"; from: View }
  | { name: "book"; id: string; tab?: "bookmarks" }
  | { name: "reader"; id: string; start?: number }
  | { name: "preview"; id: string; start?: number };

export function App() {
  const [settings, update] = useSettings();
  const [books, setBooks] = useState<BookMeta[]>(listBooks);
  // По ссылке друга — сразу на книгу; новый пользователь без своих книг — в бесплатную библиотеку.
  const [view, setView] = useState<View>(() => {
    const shared = entryFromStartParam(startParam());
    if (shared) return { name: "catalog-book", id: shared.id, shared: true };
    return listBooks().length ? { name: "books" } : { name: "catalog" };
  });
  const [sharing, setSharing] = useState<CatalogEntry | null>(null);
  const [record, setRecord] = useState<BookRecord | null>(null);
  const [adding, setAdding] = useState(false);
  const [missing, setMissing] = useState(false);

  const refresh = useCallback(() => setBooks(listBooks()), []);

  useEffect(() => {
    removeUntouchedSeeds(listBooks()).then((removed) => removed && refresh());
  }, [refresh]);

  // Текст книги нужен карточке и чтению; грузим из IndexedDB при переходе.
  const bookId = view.name === "book" || view.name === "reader" || view.name === "preview" ? view.id : null;
  useEffect(() => {
    if (!bookId) return;
    if (record?.id === bookId) return;
    setRecord(null);
    setMissing(false);
    getBook(bookId).then((b) => (b ? setRecord(b) : setMissing(true)));
  }, [bookId, record?.id]);

  const back = useCallback(() => {
    setView((v) => {
      if (v.name === "reader" || v.name === "preview") return { name: "book", id: v.id };
      if (v.name === "settings") return v.from ?? { name: "books" };
      if (v.name === "rights") return v.from;
      if (v.name === "catalog-book") return { name: "catalog" };
      return { name: "books" };
    });
    refresh();
  }, [refresh]);

  // Кнопка «Назад» в Telegram.
  useEffect(() => {
    const button = tg()?.BackButton;
    if (!button) return;
    if (view.name === "books" || view.name === "catalog") {
      button.hide();
      return;
    }
    button.show();
    button.onClick(back);
    return () => button.offClick(back);
  }, [view.name, back]);

  let screen: React.ReactNode;
  if (view.name === "settings") {
    screen = (
      <SettingsScreen
        settings={settings}
        update={update}
        onBack={view.from ? back : undefined}
        onRights={() => setView({ name: "rights", from: view })}
      />
    );
  } else if (view.name === "rights") {
    screen = <RightsScreen onBack={back} />;
  } else if (view.name === "catalog") {
    screen = (
      <Catalog
        books={books}
        wpm={settings.wpm}
        onOpen={(e) => setView({ name: "catalog-book", id: e.id })}
        onAdd={async (e) => {
          await addFromCatalog(e);
          refresh();
        }}
        onOpenLocal={(id) => setView({ name: "book", id })}
      />
    );
  } else if (view.name === "catalog-book") {
    const entry = catalogEntry(view.id);
    screen = entry ? (
      <CatalogBook
        entry={entry}
        books={books}
        wpm={settings.wpm}
        shared={view.shared}
        onBack={back}
        onOpen={async (e, mode) => {
          const id = localCopy(e, listBooks())?.id ?? (await addFromCatalog(e)).id;
          refresh();
          setView(mode === "read" ? { name: "reader", id } : { name: "preview", id });
        }}
      />
    ) : (
      <main className="app-screen">
        <p className="muted">Этой книги уже нет в библиотеке.</p>
      </main>
    );
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
        onSettings={() => setView({ name: "settings", from: { name: "book", id: record.id, tab: view.tab } })}
        onPreview={() => setView({ name: "preview", id: record.id })}
        onRename={async (title) => {
          await renameBook(record.id, title);
          setRecord({ ...record, title });
          refresh();
        }}
        onShare={record.catalogId && catalogEntry(record.catalogId) ? () => setSharing(catalogEntry(record.catalogId!)!) : undefined}
        onDelete={async () => {
          await removeBook(record.id);
          setRecord(null);
          refresh();
          setView({ name: "books" });
        }}
      />
    );
  } else if (view.name === "preview") {
    screen = (
      <Preview
        key={`${record.id}:${view.start ?? ""}`}
        book={record}
        settings={settings}
        update={update}
        startIndex={view.start}
        onBack={back}
        onRead={(start) => setView({ name: "reader", id: record.id, start })}
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
        onText={(index) => setView({ name: "preview", id: record.id, start: index })}
      />
    );
  }

  const showTabs = view.name === "books" || view.name === "catalog" || (view.name === "settings" && !view.from);
  return (
    <>
      {screen}
      {showTabs && <TabBar tab={view.name as "books" | "catalog" | "settings"} onTab={(t) => setView({ name: t } as View)} />}
      {sharing && <ShareSheet entry={sharing} wpm={settings.wpm} onClose={() => setSharing(null)} />}
      {adding && (
        <AddSheet
          onClose={() => setAdding(false)}
          onAdded={(b) => {
            setAdding(false);
            refresh();
            // Новая книга сразу открывается текстом: видно, что файл прочитался, и можно выбрать, откуда начать.
            setView({ name: "preview", id: b.id });
          }}
        />
      )}
    </>
  );
}
