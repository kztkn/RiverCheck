import { describe, expect, it } from "vitest";
import { shouldRevalidateRootData } from "@domain/routing/should-revalidate-root-data";

describe("root navigation revalidation", () => {
  it("同じグループ内のGET画面遷移では共通データを再取得しない", () => {
    expect(
      shouldRevalidateRootData({
        currentPathname: "/g/river-check/games/game-1/admin",
        defaultShouldRevalidate: true,
        nextPathname: "/g/river-check",
      }),
    ).toBe(false);
  });

  it("同じグループ内の明示更新でも共通データは再取得しない", () => {
    expect(
      shouldRevalidateRootData({
        currentPathname: "/g/river-check/games/game-1",
        defaultShouldRevalidate: true,
        nextPathname: "/g/river-check/games/game-1",
      }),
    ).toBe(false);
  });

  it("POST後はプロフィールや認証状態を再取得する", () => {
    expect(
      shouldRevalidateRootData({
        currentPathname: "/g/river-check/profile",
        defaultShouldRevalidate: true,
        formMethod: "POST",
        nextPathname: "/g/river-check/profile",
      }),
    ).toBe(true);
  });

  it("成功したリバイとUNDOでは共通データの再取得を省く", () => {
    for (const intent of ["record-rebuy", "record-repayment", "undo-rebuy"]) {
      expect(shouldRevalidateRootData({
        actionResult: { ok: true, intent },
        currentPathname: "/g/river-check/games/game-1",
        defaultShouldRevalidate: true,
        formMethod: "POST",
        nextPathname: "/g/river-check/games/game-1",
      })).toBe(false);
    }
  });

  it("別グループへの移動は標準の再取得判定に従う", () => {
    expect(
      shouldRevalidateRootData({
        actionResult: { ok: true, intent: "record-rebuy" },
        currentPathname: "/g/river-check",
        defaultShouldRevalidate: true,
        nextPathname: "/g/another-group",
      }),
    ).toBe(true);
  });
});
