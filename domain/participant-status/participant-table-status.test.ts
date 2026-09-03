import { describe, expect, it } from "vitest";
import {
  PARTICIPANT_TABLE_STATUS_MAX_LENGTH,
  normalizeParticipantTableStatus,
} from "./participant-table-status";

describe("participant table status", () => {
  it("前後の空白を除いて保存する", () => {
    expect(normalizeParticipantTableStatus("  今日は堅め  ")).toEqual({
      ok: true,
      value: "今日は堅め",
    });
  });

  it("空文字は未設定として扱う", () => {
    expect(normalizeParticipantTableStatus("   ")).toEqual({
      ok: true,
      value: null,
    });
  });

  it("最大文字数を超える入力を拒否する", () => {
    expect(
      normalizeParticipantTableStatus(
        "あ".repeat(PARTICIPANT_TABLE_STATUS_MAX_LENGTH + 1),
      ),
    ).toEqual({
      ok: false,
      error: `ひとことは${PARTICIPANT_TABLE_STATUS_MAX_LENGTH}文字以内で入力してください。`,
    });
  });

  it("改行を含む入力を拒否する", () => {
    expect(normalizeParticipantTableStatus("今日は\nブラフ多め")).toEqual({
      ok: false,
      error: "ひとことは1行で入力してください。",
    });
  });
});
