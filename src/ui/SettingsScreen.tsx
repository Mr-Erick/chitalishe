import { splitAtOrp } from "../engine/orp";
import { IconArrowLeft } from "./icons";
import { PIVOT_COLORS, type PivotColor, type ReaderBg, type Settings } from "./settings";
import { SectionTitle } from "./TabBar";

interface Props {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  onBack?: () => void;
}

const BGS: [ReaderBg, string][] = [
  ["gray", "Серый"],
  ["white", "Белый"],
  ["dark", "Тёмный"],
  ["black", "Чёрный"],
];
const STEPS = [10, 25, 50];
const RAMP_EVERY = [1, 10, 20, 50, 100];
const RAMP_STEPS = [1, 2, 5, 10, 25];
const REWINDS = [0, 3, 5, 10];
const next = <T,>(list: T[], value: T) => list[(list.indexOf(value) + 1) % list.length];
/** «До 600 сл/мин за ~350 слов (~50 с)». */
function rampSummary(from: number, to: number, step: number, every: number): string {
  if (to <= from) return "Потолок не выше старта: скорость не растёт";
  const words = Math.ceil((to - from) / step) * every;
  const seconds = Math.round((words / ((from + to) / 2)) * 60);
  const time = seconds < 60 ? `${Math.max(5, Math.round(seconds / 5) * 5)} с` : `${Math.round(seconds / 60)} мин`;
  return `До ${to} сл/мин за ~${words} слов (~${time})`;
}
const wordsLabel = (n: number) => (n === 0 ? "нет" : `${n} ${n === 1 ? "слово" : n < 5 ? "слова" : "слов"}`);

export function SettingsScreen({ settings: s, update, onBack }: Props) {
  const [before, pivot, after] = splitAtOrp("скорость");
  return (
    <main className="app-screen">
      <header className="screen-head">
        {onBack && (
          <button className="icon-btn" onClick={onBack} aria-label="Назад">
            <IconArrowLeft />
          </button>
        )}
        <h1>Настройки</h1>
      </header>
      <p className="muted">Общие для всех книг. Каждая книга помнит только свою последнюю скорость.</p>

      <SectionTitle n="01">Скорость</SectionTitle>
      <section className="card">
        <div className="segmented">
          <button className={s.mode === "constant" ? "on" : ""} onClick={() => update({ mode: "constant" })}>
            Постоянная
          </button>
          <button className={s.mode === "ramp" ? "on" : ""} onClick={() => update({ mode: "ramp" })}>
            Разгон
          </button>
        </div>
        <label className="slider">
          <span>
            Старт <b>{s.wpm} сл/мин</b>
          </span>
          <input type="range" min={100} max={1000} step={25} value={s.wpm} onChange={(e) => update({ wpm: Number(e.target.value) })} />
        </label>
        {s.mode === "ramp" && (
          <label className="slider">
            <span>
              Потолок разгона <b>{s.maxWpm} сл/мин</b>
            </span>
            <input
              type="range"
              min={200}
              max={1200}
              step={25}
              value={s.maxWpm}
              onChange={(e) => update({ maxWpm: Number(e.target.value) })}
            />
          </label>
        )}
        {s.mode === "ramp" && (
          <>
            <span className="mono-label">Прибавлять каждые</span>
            <div className="segmented five">
              {RAMP_EVERY.map((n) => (
                <button key={n} className={s.rampEveryWords === n ? "on" : ""} onClick={() => update({ rampEveryWords: n })}>
                  {n === 1 ? "слово" : n}
                </button>
              ))}
            </div>
            <button className="row" onClick={() => update({ rampStep: next(RAMP_STEPS, s.rampStep) })}>
              Прибавка <b>+{s.rampStep} сл/мин ›</b>
            </button>
            <small className="mono-label">{rampSummary(s.wpm, s.maxWpm, s.rampStep, s.rampEveryWords)}</small>
          </>
        )}
        <button className="row" onClick={() => update({ step: next(STEPS, s.step) })}>
          Шаг свайпа и кнопок <b>{s.step} ›</b>
        </button>
      </section>

      <SectionTitle n="02">Экран чтения</SectionTitle>
      <section className="card">
        <div
          className={`preview bg-${s.bg} ${s.serif ? "serif" : "sans"}`}
          style={{ "--pivot": PIVOT_COLORS[s.pivot], fontSize: Math.min(s.fontSize, 48) } as React.CSSProperties}
        >
          {before}
          <span className="pivot">{pivot}</span>
          {after}
        </div>
        <div className="row static">
          Шрифт
          <span className="choice">
            <button className={s.serif ? "on serif" : "serif"} onClick={() => update({ serif: true })}>
              С засечками
            </button>
            <button className={!s.serif ? "on" : ""} onClick={() => update({ serif: false })}>
              Без
            </button>
          </span>
        </div>
        <div className="row static">
          Размер
          <span className="choice">
            <button aria-label="Меньше" onClick={() => update({ fontSize: Math.max(28, s.fontSize - 4) })}>
              A
            </button>
            <b className="mono-num">{s.fontSize}</b>
            <button aria-label="Больше" className="big" onClick={() => update({ fontSize: Math.min(72, s.fontSize + 4) })}>
              A
            </button>
          </span>
        </div>
        <div className="row static">
          Опорная буква
          <span className="choice">
            {(Object.keys(PIVOT_COLORS) as PivotColor[]).map((c) => (
              <button
                key={c}
                className={`swatch ${s.pivot === c ? "on" : ""}`}
                style={{ background: PIVOT_COLORS[c] }}
                aria-label={c}
                onClick={() => update({ pivot: c })}
              />
            ))}
          </span>
        </div>
        <div className="row static column">
          Фон
          <span className="bg-choice">
            {BGS.map(([bg, label]) => (
              <button key={bg} className={`bg-${bg} ${s.bg === bg ? "on" : ""}`} onClick={() => update({ bg })}>
                {label}
              </button>
            ))}
          </span>
        </div>
      </section>

      <SectionTitle n="03">Чтение</SectionTitle>
      <section className="card">
        <label className="row toggle">
          Задержка на знаках и длинных словах
          <input type="checkbox" checked={s.delays} onChange={(e) => update({ delays: e.target.checked })} />
        </label>
        <button className="row" onClick={() => update({ rewindWords: next(REWINDS, s.rewindWords) })}>
          Откат после паузы <b>{wordsLabel(s.rewindWords)} ›</b>
        </button>
        <button className="row" onClick={() => update({ chapterEnd: s.chapterEnd === "continue" ? "pause" : "continue" })}>
          Конец главы <b>{s.chapterEnd === "continue" ? "читать дальше" : "пауза"} ›</b>
        </button>
        <label className="row toggle">
          Вибрация
          <input type="checkbox" checked={s.haptics} onChange={(e) => update({ haptics: e.target.checked })} />
        </label>
      </section>
    </main>
  );
}
