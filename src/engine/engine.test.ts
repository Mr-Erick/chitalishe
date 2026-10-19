import { describe, expect, it } from "vitest";
import { nextSentenceStart, prevSentenceStart, tokenize } from "./tokenize";
import { orpIndex, splitAtOrp } from "./orp";
import { delayFactor, delayMs, rampFactor } from "./timing";

describe("tokenize", () => {
  it("разбивает на слова, абзацы и предложения", () => {
    const t = tokenize("Раз два. Три!\n\nЧетыре пять");
    expect(t.map((x) => x.text)).toEqual(["Раз", "два.", "Три!", "Четыре", "пять"]);
    expect(t.map((x) => x.paragraphEnd)).toEqual([false, false, true, false, true]);
    expect(t.map((x) => x.sentenceStart)).toEqual([0, 0, 2, 3, 3]);
  });

  it("перематывает по предложениям", () => {
    const t = tokenize("Раз два. Три четыре. Пять.");
    expect(nextSentenceStart(t, 0)).toBe(2);
    expect(prevSentenceStart(t, 3)).toBe(2);
    expect(prevSentenceStart(t, 2)).toBe(0);
  });
});

describe("orp", () => {
  it("ставит опорную букву по длине слова", () => {
    expect(orpIndex("я")).toBe(0);
    expect(orpIndex("минуту")).toBe(2);
    expect(orpIndex("толпе")).toBe(1);
    expect(orpIndex("скорочтение")).toBe(3);
  });

  it("пропускает пунктуацию в начале", () => {
    expect(splitAtOrp("«минуту.»")).toEqual(["«ми", "н", "уту.»"]);
  });
});

describe("timing", () => {
  it("базовая задержка по скорости", () => {
    expect(delayMs({ text: "слово", paragraphEnd: false, sentenceStart: 0 }, 300)).toBe(200);
  });

  it("дольше держит конец предложения и длинные слова", () => {
    expect(delayFactor({ text: "конец.", paragraphEnd: false, sentenceStart: 0 })).toBe(2);
    expect(delayFactor({ text: "скорочтение", paragraphEnd: false, sentenceStart: 0 })).toBe(1.3);
  });

  it("строгий режим без множителей", () => {
    expect(delayMs({ text: "конец.", paragraphEnd: true, sentenceStart: 0 }, 600, { strict: true })).toBe(100);
  });

  it("плавный старт", () => {
    expect(rampFactor(0)).toBeCloseTo(1 / 0.6);
    expect(rampFactor(10)).toBe(1);
  });
});
