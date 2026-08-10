import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  adjustRebuyState: vi.fn(),
  applyRebuyAction: vi.fn(),
  getAuthenticatedPlayerProfile: vi.fn(),
  hashToken: vi.fn(),
  readParticipantToken: vi.fn(),
  undoRebuyAction: vi.fn(),
}));

vi.mock("@server/repositories/rebuy-repository.server", () => ({
  adjustRebuyState: mocked.adjustRebuyState,
  applyRebuyAction: mocked.applyRebuyAction,
  undoRebuyAction: mocked.undoRebuyAction,
}));
vi.mock("@server/services/player-profile-service.server", () => ({
  getAuthenticatedPlayerProfile: mocked.getAuthenticatedPlayerProfile,
}));
vi.mock("@server/services/participant-session.server", () => ({
  readParticipantToken: mocked.readParticipantToken,
}));
vi.mock("@server/services/token.server", () => ({ hashToken: mocked.hashToken }));

import {
  adjustOrganizerRebuyState,
  recordOrganizerRebuyAction,
  recordOwnRebuyAction,
} from "@server/services/rebuy-service.server";

const gameId = "11111111-1111-4111-8111-111111111111";
const groupId = "22222222-2222-4222-8222-222222222222";
const groupPlayerId = "33333333-3333-4333-8333-333333333333";
const participantId = "44444444-4444-4444-8444-444444444444";
const commandId = "55555555-5555-4555-8555-555555555555";

beforeEach(() => {
  vi.resetAllMocks();
  mocked.getAuthenticatedPlayerProfile.mockResolvedValue(null);
  mocked.readParticipantToken.mockReturnValue(null);
  mocked.hashToken.mockResolvedValue("hashed-token");
});

describe("rebuy service", () => {
  it("プロフィール認証済み本人のgroupPlayerIdだけを更新対象にする", async () => {
    mocked.getAuthenticatedPlayerProfile.mockResolvedValue({
      profile: { groupPlayerId },
    });
    mocked.applyRebuyAction.mockResolvedValue({
      ok: true,
      eventId: "66666666-6666-4666-8666-666666666666",
      state: { totalRebuyCount: 1, outstandingRebuyCount: 1 },
    });

    const result = await recordOwnRebuyAction(new Request("https://example.com"), {
      actionType: "rebuy",
      commandId,
      gameId,
      groupCode: "river-check",
      groupId,
    });

    expect(result.ok).toBe(true);
    expect(mocked.applyRebuyAction).toHaveBeenCalledWith({
      actorType: "participant",
      actionType: "rebuy",
      commandId,
      gameId,
      groupId,
      target: { kind: "group-player", value: groupPlayerId },
    });
  });

  it("本人プロフィールがなくても既存参加者Cookieを利用できる", async () => {
    mocked.readParticipantToken.mockReturnValue("participant-token");
    mocked.applyRebuyAction.mockResolvedValue({
      ok: true,
      eventId: null,
      state: { totalRebuyCount: 2, outstandingRebuyCount: 0 },
    });

    await recordOwnRebuyAction(new Request("https://example.com"), {
      actionType: "repayment",
      commandId,
      gameId,
      groupCode: "river-check",
      groupId,
    });

    expect(mocked.applyRebuyAction).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { kind: "participant-token", value: "hashed-token" },
      }),
    );
  });

  it("未認証ではrepositoryを呼ばずリバイできない", async () => {
    const result = await recordOwnRebuyAction(new Request("https://example.com"), {
      actionType: "rebuy",
      commandId,
      gameId,
      groupCode: "river-check",
      groupId,
    });

    expect(result).toEqual({
      ok: false,
      error: "参加者情報を確認できません。画面を更新してください。",
    });
    expect(mocked.applyRebuyAction).not.toHaveBeenCalled();
  });

  it("主催者操作は指定参加者IDだけをrepositoryへ渡す", async () => {
    mocked.applyRebuyAction.mockResolvedValue({
      ok: true,
      eventId: null,
      state: { totalRebuyCount: 1, outstandingRebuyCount: 1 },
    });

    await recordOrganizerRebuyAction({
      actionType: "rebuy",
      commandId,
      gameId,
      groupId,
      participantId,
    });

    expect(mocked.applyRebuyAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: "organizer",
        target: { kind: "participant-id", value: participantId },
      }),
    );
  });

  it("主催者修正は負数をrepositoryへ渡さない", async () => {
    const result = await adjustOrganizerRebuyState({
      commandId,
      gameId,
      groupId,
      outstandingRebuyCount: -1,
      participantId,
      settlementRebuyCount: 0,
      totalRebuyCount: 1,
    });

    expect(result.ok).toBe(false);
    expect(mocked.adjustRebuyState).not.toHaveBeenCalled();
  });
});
