import { describe, expect, it } from "vitest";
import { validateAllInSelection } from "./validate-table-event";

describe("validateAllInSelection", () => {
  it("2人以上の参加者と参加者内の勝者を受け付ける", () => {
    expect(
      validateAllInSelection({
        participantIds: ["a", "b", "b"],
        winnerIds: ["a"],
      }),
    ).toEqual({
      ok: true,
      participantIds: ["a", "b"],
      winnerIds: ["a"],
    });
  });

  it("スプリットとして複数勝者を受け付ける", () => {
    expect(
      validateAllInSelection({
        participantIds: ["a", "b", "c"],
        winnerIds: ["a", "c"],
      }),
    ).toMatchObject({ ok: true, winnerIds: ["a", "c"] });
  });

  it("参加者が1人以下なら拒否する", () => {
    expect(
      validateAllInSelection({ participantIds: ["a"], winnerIds: ["a"] }),
    ).toMatchObject({ ok: false });
  });

  it("勝者が参加者に含まれない場合は拒否する", () => {
    expect(
      validateAllInSelection({
        participantIds: ["a", "b"],
        winnerIds: ["c"],
      }),
    ).toMatchObject({ ok: false });
  });
});
