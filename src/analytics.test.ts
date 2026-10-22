import { describe, expect, it } from "vitest";
import { addReadingTime, speedBucket } from "./analytics";

describe("статистика", () => {
  it("скорость по сотням", () => {
    expect(speedBucket(100)).toBe("100-199");
    expect(speedBucket(350)).toBe("300-399");
    expect(speedBucket(1500)).toBe("1500");
  });

  it("время чтения кусками по 5 минут", () => {
    expect(addReadingTime(4 * 60_000)).toBe(0);
    expect(addReadingTime(11 * 60_000)).toBeGreaterThanOrEqual(2);
  });
});
