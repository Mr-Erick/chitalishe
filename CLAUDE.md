# CLAUDE.md

Памятка для новых сессий: прочитай её вместо того, чтобы заново изучать весь код.

## Что это

SPEEDTEXT — Telegram Mini App для скорочтения (RSVP): слова идут по одному, опорная буква стоит в одной точке экрана. Для всех пользователей Telegram, бесплатно, интерфейс только на русском. Книги хранятся на устройстве, сервера нет, синхронизации между устройствами нет.

- Сайт: https://mr-erick.github.io/chitalishe/ (GitHub Pages, статика).
- Бот: `@fastt_reader_bot`, мини-приложение подключено через @BotFather (Main Mini App + кнопка меню «Читать»). Своего кода у бота нет.
- Проектный документ (логика, управление, решения): в общей папке проекта `design/speed-reader-design.md`, макеты экранов: `design/screens/`.
- Пользователь пишет по-русски. Комментарии в коде, тексты интерфейса, коммиты и PR тоже по-русски.

## Стек и команды

React 18 + TypeScript (strict) + Vite 5, тесты на Vitest. Из зависимостей только `fflate` (zip для DOCX и FB2.ZIP). Telegram SDK подключён скриптом в `index.html`, npm-пакета нет.

```sh
npm install
npm run dev     # http://localhost:5173, вне Telegram всё работает, вызовы Telegram молча пропускаются
npm test        # vitest run: тесты движка в src/engine/*.test.ts
npm run build   # tsc -b && vite build → dist/ (base "./")
```

Перед PR обязательно `npm test` и `npm run build`: то же самое гоняет CI.

## Порядок работы

1. Ветка от `main` → коммиты → PR в `main`.
2. CI (`.github/workflows/pages.yml`): `npm ci`, `npm test`, `npm run build` на каждый PR.
3. Зелёная сборка → squash-merge. Название PR и коммита по-русски, по сути изменения: «Поддержка FB2 и FB2.ZIP (#9)».
4. Пуш в `main` сам собирается и выкладывается на Pages, отдельного деплоя нет.

## Карта кода

```
src/
  main.tsx            точка входа
  telegram.ts         обёртка над Telegram WebApp: tg(), initTelegram, startParam, openTelegramLink, openExternal, openMail, haptic
  analytics.ts        обезличенная статистика в GoatCounter (mrerick.goatcounter.com): открытие, скачивание книги каталога, минуты чтения, скорость
  engine/             чистая логика без React, покрыта тестами
    tokenize.ts       текст → Token[]; переходы по предложениям
    orp.ts            индекс опорной буквы (ORP)
    timing.ts         время показа слова, плавный старт (RAMP_WORDS)
    chapters.ts       распознавание заголовков глав в простом тексте, нарезка на части ~2000 слов, tokenizeBook
    cleanup.ts        пометка мусора (номера страниц, колонтитулы, сноски): слова не вырезаются, SPEEDTEXT их пропускает
  books/
    parse.ts          разбор файлов: TXT (UTF-8 / CP1251 / KOI8-R), DOCX, FB2 и FB2.ZIP, вставленный текст; DOC → просим DOCX
    store.ts          хранение: тексты в IndexedDB (база "speedtext", стор "books"), прогресс/закладки/настройки в localStorage
    catalog.ts        бесплатная библиотека: CATALOG из library.json, полки, ссылки t.me/…?startapp=book-<id>, скачивание книги
    library.json      список книг каталога (без текстов)
  ui/
    App.tsx           навигация: состояние View (books / catalog / catalog-book / settings / rights / book / reader / preview), кнопка «Назад» Telegram
    TabBar.tsx        нижняя панель: Мои книги / Библиотека / Настройки
    Library.tsx       «Мои книги» списком с цветной плашкой вместо обложки
    Catalog.tsx, CatalogBook.tsx, RightsScreen.tsx   бесплатная библиотека, карточка книги каталога, страница для правообладателей
    BookScreen.tsx    карточка своей книги: главы, закладки, отправка файла
    Preview.tsx       предпросмотр: книга обычным текстом, тап по слову или кнопка запускают SPEEDTEXT с этого места
    Reader.tsx + useReader.ts   экран чтения RSVP: таймер, жесты, клавиши, закладки на паузе
    SettingsScreen.tsx + settings.ts   общие настройки (книга помнит только свою скорость)
    ShareSheet.tsx, SendFileSheet.tsx, ReportSheet.tsx, AddSheet.tsx   нижние панели
    useKeepAwake.ts   экран не гаснет во время чтения (public/keep-awake.mp4)
    styles.css        все стили и цветовые токены
public/
  books/library/<id>.json   тексты книг каталога, качаются по «+»
  mail.html                 открывает письмо в почте (см. ловушки)
```

Ключи localStorage: `speedtext:library` (метаданные книг), `speedtext:progress:<id>`, `speedtext:bookmarks:<id>`, `speedtext:settings`, `speedtext:stats-carry` (остаток минут чтения для статистики). Доступ только через `local` из `store.ts`: он переживает приватный режим.

## Данные библиотеки

Книги собираются вне репозитория (Викитека, чистка, проверка прав) в общей папке проекта `books/library/` (там же README с правилами отбора). В репозиторий попадают:

- `src/books/library.json` — массив записей, это `catalog.json` из общей папки без полей со значением `null`:
  `{ id, title, author, authorYears, translator?, translatorYears?, shelves: ["school"|"russian"|"foreign"], words, chapters, file: "<id>.json", bytes, source }`.
  Полка «Стихи» (`poetry`) в файле не хранится, её добавляет `catalog.ts` по списку `POETRY`.
- `public/books/library/<id>.json` — книга целиком:
  `{ id, title, author, authorYears, translator, translatorYears, shelves, source, license, words, chapters: [{ title, text }] }`.
  `chapters` это `ChapterText[]`: абзацы через пустую строку, строки стихов через `\n`. Передаётся в `addBook` как есть, без `splitChapters`.

`id` — транслит «автор-название», он же в ссылке `startapp=book-<id>`, поэтому id существующих книг не меняем. Старые id трёх первых книг переводятся через `OLD_IDS`.

Права: только общественное достояние, автор и переводчик умерли в 1955 году или раньше. Контакт для правообладателей: `SUPPORT_EMAIL` в `catalog.ts`.

## Известные ловушки

- **WebView Telegram на Android** не умеет `navigator.share` с файлами, скачивание по `<a download>` и переход на `mailto:`. Скачивание молча ничего не делает, `mailto:` роняет мини-приложение (ERR_UNKNOWN_URL_SCHEME). Поэтому:
  - отправка файла на Android честно говорит, что здесь не работает (`blockedHere` в `SendFileSheet.tsx`);
  - письма идут через `openMail`: открываем `public/mail.html` во внешнем браузере через `openLink`, а он уже передаёт `mailto:` почте;
  - внешние ссылки только через `openExternal` / `openTelegramLink`, не через `window.open` и не через обычный `<a href>`.
- **iPhone, safe-area**: снизу полоска Home, нижние кнопки уезжали под неё (чинили в #8); сверху у Telegram свои кнопки «Закрыть» и меню, под них уходил заголовок (#12). Отступы берём из `--safe-top` и `--safe-bottom` в `styles.css` (там уже учтены `env(safe-area-inset-*)` и `--tg-safe-area-inset-*` / `--tg-content-safe-area-inset-top`). Новые экраны и нижние панели должны их использовать.
- **Что не проверено**: всё тестировали только на Android (Samsung S23). На iOS и в Telegram для ПК «Поделиться» файлом, скачивание и письмо через `mail.html` пока не проверены. Меняя эти места, не считай их рабочими там, пока не проверили на устройстве.
- **Кнопка «Назад»** — это `BackButton` Telegram, она управляется в `App.tsx`. На корневых вкладках скрыта.
- **Хранилище может пропасть**: Telegram или iOS иногда чистят IndexedDB. Код должен переживать отсутствие книги (в `App.tsx` для этого есть `missing`).
- Вне Telegram (`npm run dev` в браузере) `tg()` возвращает `undefined`, все обёртки молча ничего не делают. Параметр ссылки можно проверить через `?startapp=book-<id>` в адресе.
- `vite.config.ts` с `base: "./"`: пути к файлам строим от `import.meta.env.BASE_URL`, а не от `/`.

## Стиль интерфейса

- Библиотека, карточки, настройки: в духе образца SPECTRA. Светлый фон `#ecebe6`, почти чёрный `#111110`, кислотно-салатовый акцент `#c6f03a`, тёмные плашки. Заголовки крупным жирным капсом (Unbounded, `--display`), подписи моноширинным капсом (JetBrains Mono, `--mono`), текст Inter (`--text`). Разделы с номером «01 · …». Цвета берём только из токенов в `:root` в `styles.css`.
- **Экран чтения максимально нейтральный**: никакого лайма и стиля приложения. Фон на выбор (серый / белый / тёмный / чёрный, классы `.bg-*`), опорная буква приглушённо-цветная (по умолчанию `#b23a32`).
- Тексты интерфейса короткие, по-русски, без англицизмов там, где есть обычное слово.

## Продуктовые решения, которые легко нарушить

- Конец главы по умолчанию: читать дальше без паузы.
- Скорость: постоянная или разгон по словам, на выбор в настройках.
- Настройки общие, книга помнит только свою последнюю скорость (`bookWpm`).
- Новый пользователь без книг стартует во вкладке «Библиотека».
- Нет и не планируется: P2P-обмен книгами, каталог «у кого есть», ссылки на сторонние магазины. Делиться можно ссылкой на книгу каталога и своим файлом.
- Детское чтение вслух — только исследование, в рабочую версию не выкладывать.
