import { describe, expect, it } from "vitest";
import { chapterAt, splitChapters, splitIntoParts, tokenizeBook } from "./chapters";

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
