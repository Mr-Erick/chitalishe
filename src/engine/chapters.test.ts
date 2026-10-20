import { describe, expect, it } from "vitest";
import { chapterAt, prettifyTitle, splitChapters, splitIntoParts, tokenizeBook } from "./chapters";

const long = (word: string) => Array(200).fill(word).join(" ") + ".";
const titles = (text: string) => splitChapters(text).map((c) => c.title);

describe("splitChapters", () => {
  it("находит главы по заголовкам", () => {
    const ch = splitChapters("Глава 1\nРаз два.\n\nГлава 2\nТри четыре.");
    expect(ch.map((c) => c.title)).toEqual(["Глава 1", "Глава 2"]);
    expect(ch[1].text).toBe("Три четыре.");
  });

  it("текст без глав — одна часть", () => {
    expect(splitChapters("Просто текст. Без глав.")).toEqual([{ title: "Текст", text: "Просто текст. Без глав." }]);
  });

  it("длинный текст без глав режется на части по абзацам", () => {
    const para = Array(500).fill("слово").join(" ");
    expect(splitIntoParts(Array(6).fill(para).join("\n\n")).length).toBe(2);
  });
});

describe("умное распознавание глав", () => {
  it("«I. Детство», «ПЕРВАЯ ГЛАВА» и капс", () => {
    expect(titles(`I. Детство\n\n${long("а")}\n\nПЕРВАЯ ГЛАВА\n\n${long("б")}\n\nВ ДЕРЕВНЕ\n\n${long("в")}`)).toEqual([
      "I. Детство",
      "Первая глава",
      "В деревне",
    ]);
  });

  it("подзаголовок на следующей строке входит в название", () => {
    expect(titles(`ГЛАВА I\n\nСЕРЖАНТ ГВАРДИИ\n\n${long("а")}\n\nГлава 2\nВожатый\n\n${long("б")}`)).toEqual([
      "Глава I. Сержант гвардии",
      "Глава 2. Вожатый",
    ]);
  });

  it("название отдельным абзацем: рассказы в сборнике", () => {
    expect(titles(`Хорь и Калиныч\n\n${long("а")}\n\nБежин луг\n\n${long("б")}`)).toEqual(["Хорь и Калиныч", "Бежин луг"]);
  });

  it("обычные фразы со словом «Часть» не считаются главами", () => {
    expect(titles(`Глава 1\n${long("а")}\n\nЧасть денег пропала.\n${long("б")}\n\nГлава 2\n${long("в")}`)).toEqual(["Глава 1", "Глава 2"]);
  });

  it("короткие «главы» с номером возвращаются в текст", () => {
    const ch = splitChapters(`${long("а")}\n\n7.\nКупить хлеб.\n\n8.\nПозвонить.`);
    expect(ch).toHaveLength(1);
    expect(ch[0].text).toContain("Купить хлеб.");
  });

  it("номера строф внутри «Глава …» не становятся главами", () => {
    const stanza = (n: string) => `${n}\n\nМой дядя самых честных правил,\nКогда не в шутку занемог.`;
    const text = ["Глава первая", stanza("I"), stanza("II"), long("а"), "Глава вторая", stanza("I"), long("б")].join("\n\n");
    expect(titles(text)).toEqual(["Глава первая", "Глава вторая"]);
  });

  it("«Часть первая» и сразу «Глава 1» склеиваются", () => {
    expect(titles(`Часть первая\n\nГлава 1\n\n${long("а")}\n\nГлава 2\n\n${long("б")}`)).toEqual([
      "Часть первая · Глава 1",
      "Глава 2",
    ]);
  });

  it("название и автор до первой главы уходят в её начало", () => {
    const ch = splitChapters(`Капитанская дочка\nАлександр Пушкин\n\nГлава I\n${long("а")}\n\nГлава II\n${long("б")}`);
    expect(ch.map((c) => c.title)).toEqual(["Глава I", "Глава II"]);
    expect(ch[0].text.startsWith("Капитанская дочка")).toBe(true);
  });

  it("капс в названиях приводится к обычному виду", () => {
    expect(prettifyTitle("ГЛАВА XII. СИРОТА")).toBe("Глава XII. Сирота");
    expect(prettifyTitle("Глава 3. Встреча")).toBe("Глава 3. Встреча");
  });
});

describe("tokenizeBook", () => {
  it("склеивает главы и запоминает границы", () => {
    const { tokens, chapters } = tokenizeBook([
      { title: "А", text: "Раз два." },
      { title: "Б", text: "Три." },
    ]);
    expect(tokens.map((t) => t.text)).toEqual(["Раз", "два.", "Три."]);
    expect(chapters).toEqual([
      { title: "А", start: 0, end: 1 },
      { title: "Б", start: 2, end: 2 },
    ]);
    expect(tokens[2].sentenceStart).toBe(2);
    expect(chapterAt(chapters, 2)).toBe(1);
  });
});
