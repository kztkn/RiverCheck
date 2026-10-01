import { describe, expect, it } from "vitest";
import { canConsumeScroll } from "./modal-scroll-lock";

describe("モーダル内のスクロールと背面への伝播", () => {
  it("途中位置では上下へ読めるが、上下端から背面へ伝わる操作を止める", () => {
    expect(canConsumeScroll(0, 900, 400, 20)).toBe(true);
    expect(canConsumeScroll(0, 900, 400, -20)).toBe(false);
    expect(canConsumeScroll(250, 900, 400, 20)).toBe(true);
    expect(canConsumeScroll(250, 900, 400, -20)).toBe(true);
    expect(canConsumeScroll(500, 900, 400, 20)).toBe(false);
    expect(canConsumeScroll(500, 900, 400, -20)).toBe(true);
  });
  it("スクロール不要な内容やiOSの上端のバウンス位置では背面へ伝播しない", () => {
    expect(canConsumeScroll(0, 200, 400, 20)).toBe(false);
    expect(canConsumeScroll(0, 200, 400, -20)).toBe(false);
    expect(canConsumeScroll(-3, 900, 400, -20)).toBe(false);
    expect(canConsumeScroll(503, 900, 400, 20)).toBe(false);
  });
});
