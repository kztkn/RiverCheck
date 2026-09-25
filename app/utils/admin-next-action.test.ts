import { describe, expect, it } from "vitest";
import { getAdminNextAction } from "./admin-next-action";

describe("admin next action", () => {
  const readyBase = {
    participantCount: 8,
    submittedCount: 8,
    warningCount: 0,
    invalidRebuyCount: 0,
    settlementParticipantCount: 8,
    chipDifference: 0,
  };

  it("guides the organizer to share the participant link before two players join", () => {
    expect(getAdminNextAction({
      ...readyBase,
      participantCount: 1,
      submittedCount: 0,
      settlementParticipantCount: 8,
      chipDifference: null,
    })).toMatchObject({
      tone: "neutral",
      title: "参加者を集める",
      href: "#admin-share",
    });
  });

  it("prioritizes incomplete result entry", () => {
    expect(getAdminNextAction({
      ...readyBase,
      submittedCount: 6,
      warningCount: 1,
      chipDifference: 200,
    })).toMatchObject({
      tone: "attention",
      title: "未入力の2人を確認",
      href: "#admin-participants",
    });
  });

  it("prioritizes invalid rebuy counts after everyone submitted", () => {
    expect(getAdminNextAction({
      ...readyBase,
      invalidRebuyCount: 1,
    })).toMatchObject({
      title: "リバイ回数を確認",
      href: "#admin-participants",
    });
  });

  it("guides to rebuy mismatches before settlement checks", () => {
    expect(getAdminNextAction({
      ...readyBase,
      warningCount: 2,
      chipDifference: 100,
    })).toMatchObject({
      title: "リバイ記録を確認",
      href: "#admin-participants",
    });
  });

  it("guides to settlement when the settlement participant count differs", () => {
    expect(getAdminNextAction({
      ...readyBase,
      settlementParticipantCount: 7,
    })).toMatchObject({
      title: "負担人数を確認",
      href: "#admin-settlement",
    });
  });

  it("guides to settlement when chips do not balance", () => {
    expect(getAdminNextAction({
      ...readyBase,
      chipDifference: -400,
    })).toMatchObject({
      title: "チップ差分を確認",
      href: "#admin-settlement",
    });
  });

  it("shows the ready state only when all blocking checks are clear", () => {
    expect(getAdminNextAction(readyBase)).toEqual({
      tone: "ready",
      title: "結果を確定できます",
      description: "8 / 8人の入力が揃い、リバイ記録とチップ合計も一致しています。",
      href: "#admin-settlement",
      actionLabel: "結果確定へ",
    });
  });
});
