import { SUPPORT_EMAIL } from "../books/catalog";
import { openMail } from "../telegram";
import { IconArrowLeft } from "./icons";
import { SectionTitle } from "./TabBar";

export function RightsScreen({ onBack }: { onBack: () => void }) {
  return (
    <main className="app-screen">
      <header className="topnav">
        <button className="icon-btn" onClick={onBack} aria-label="Назад">
          <IconArrowLeft />
        </button>
      </header>
      <h1 className="screen-title">Книги и права</h1>

      <SectionTitle n="01">Бесплатная библиотека</SectionTitle>
      <section className="card prose">
        <p>
          В бесплатной библиотеке только книги в общественном достоянии: авторы умерли более 70 лет назад, а переводы тоже
          свободны.
        </p>
        <p>Каждый текст мы готовим сами: убираем сноски и примечания, размечаем главы.</p>
      </section>

      <SectionTitle n="02">Ваши файлы</SectionTitle>
      <section className="card prose">
        <p>Книги, которые вы добавили сами, хранятся только на этом устройстве. Мы их не видим и никуда не загружаем.</p>
      </section>

      <SectionTitle n="03">Правообладателям</SectionTitle>
      <section className="card prose">
        <p>
          Если считаете, что книга в библиотеке нарушает ваши права, напишите нам. Ответим и при необходимости уберём книгу в
          течение 24 часов.
        </p>
        <a className="btn dark wide mono" href={`mailto:${SUPPORT_EMAIL}`} onClick={(e) => { e.preventDefault(); openMail(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("SPEEDTEXT: правообладателю")}`); }}>
          {SUPPORT_EMAIL}
        </a>
      </section>
    </main>
  );
}
