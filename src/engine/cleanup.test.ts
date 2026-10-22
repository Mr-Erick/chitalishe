import { describe, expect, it } from "vitest";
import { tokenizeBook } from "./chapters";
import { shownText } from "./tokenize";

const filler = (n: number) => Array.from({ length: n }, (_, i) => `слово${i % 7 ? "" : "."}`).join(" ");
const read = (text: string) =>
  tokenizeBook([{ title: "Текст", text }], { clean: true })
    .tokens.filter((t) => !t.skip)
    .map(shownText);

describe("очистка для SPEEDTEXT", () => {
  it("пропускает номера страниц, но не меняет число слов", () => {
    const text = `Начало строки\n- 12 -\nконец строки.\n\n13\n\nСтр. 14\n\nДальше текст.`;
    const all = tokenizeBook([{ title: "", text }]).tokens;
    const clean = tokenizeBook([{ title: "", text }], { clean: true }).tokens;
    expect(clean.length).toBe(all.length);
    expect(read(text)).toEqual(["Начало", "строки", "конец", "строки.", "Дальше", "текст."]);
  });

  it("убирает колонтитулы, повторяющиеся через страницу, вместе с номером", () => {
    const page = (n: number) => `${n} А. С. Пушкин. Капитанская дочка\n\n${filler(200)}`;
    const words = read([1, 2, 3, 4].map(page).join("\n\n"));
    expect(words.join(" ")).not.toMatch(/Пушкин|Капитанская/);
    expect(words.length).toBe(800);
  });

  it("не трогает припев и повторяющиеся реплики", () => {
    const poem = Array.from({ length: 5 }, () => `Строка куплета одна\nСтрока куплета две\nАх, мой милый Августин`).join("\n\n");
    expect(read(poem).filter((w) => w === "Августин").length).toBe(5);
    const talk = Array.from({ length: 4 }, () => `— Да.\n\n${filler(200)}`).join("\n\n");
    expect(read(talk).filter((w) => w === "Да.").length).toBe(4);
  });

  it("снимает метки сносок со слов и пропускает тексты сносок", () => {
    expect(read("Слово[1] и другое¹, ещё одно. Конец [2]. Граф *** и князь Б**.\n\n[1] Пояснение к слову.")).toEqual([
      "Слово",
      "и",
      "другое,",
      "ещё",
      "одно.",
      "Конец",
      "Граф",
      "***",
      "и",
      "князь",
      "Б**.",
    ]);
  });

  it("одинокое тире остаётся", () => {
    expect(read("— Пойдём, — сказал он.")).toEqual(["—", "Пойдём,", "—", "сказал", "он."]);
  });
});
