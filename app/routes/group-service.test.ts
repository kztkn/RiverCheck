import { describe, expect, it } from "vitest";
import { validateGroupIdentity } from "@domain/group/validate-group";

describe("validateGroupIdentity", () => {
  it("グループ名をtrimしURL用コードを小文字へ正規化する", () => {
    expect(
      validateGroupIdentity({
        name: "  ボドゲ会  ",
        publicCode: "BoardGame-2026",
      }),
    ).toEqual({
      ok: true,
      values: {
        name: "ボドゲ会",
        publicCode: "boardgame-2026",
      },
    });
  });

  it("URL用コードに使用できない文字を拒否する", () => {
    const result = validateGroupIdentity({
      name: "ボドゲ会",
      publicCode: "ボドゲ会",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.publicCode).toContain("半角英小文字");
    }
  });
});
