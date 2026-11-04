import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  findGame: vi.fn(), manager: vi.fn(), record: vi.fn(), cancel: vi.fn(),
}));
vi.mock("@server/repositories/game-repository.server", () => ({ findGameForGroup: mocked.findGame }));
vi.mock("@server/repositories/group-repository.server", () => ({ findGroupByPublicCode: vi.fn(async () => ({ id: "group" })) }));
vi.mock("@server/services/game-authorization-service.server", () => ({ getGameManagementActor: mocked.manager }));
vi.mock("@server/services/player-profile-service.server", () => ({ getAuthenticatedPlayerProfile: vi.fn(async () => null) }));
vi.mock("@server/services/participant-session.server", () => ({ readParticipantToken: vi.fn(() => null) }));
vi.mock("@server/repositories/participant-repository.server", () => ({
  findParticipantByGroupPlayerId: vi.fn(), findParticipantByTokenHash: vi.fn(),
  listCurrentGameParticipants: vi.fn(async () => []),
}));
vi.mock("@server/repositories/table-event-repository.server", () => ({
  createStandUpLoserTableEvent: mocked.record, cancelTableEvent: mocked.cancel,
  createSevenDeuceTableEvent: vi.fn(), createBombPotTableEvent: vi.fn(), createAllInTableEvent: vi.fn(),
  listOpenGameTableEvents: vi.fn(async () => [{ id: "existing", type: "stand_up_loser" }]),
}));
import { cancelRecordedTableEvent, getTableEventPanel, recordTableEvent } from "@server/services/table-event-service.server";

const request = new Request("https://example.test/g/test/games/game/table-events");
const command = { type: "stand_up_loser" as const, commandId: "command", subjectGroupPlayerId: "player" };
describe("STAND UPの開催設定と記録権限", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.findGame.mockResolvedValue({ status: "open", standUpRuleEnabled: true });
    mocked.manager.mockResolvedValue({ type: "admin" });
    mocked.record.mockResolvedValue("event");
    mocked.cancel.mockResolvedValue(true);
  });
  it("ONなら管理者が記録できる", async () => {
    expect(await recordTableEvent(request, "test", "game", command)).toEqual({ ok: true, eventId: "event" });
    expect(mocked.record).toHaveBeenCalledWith(expect.objectContaining({ groupId: "group", gameId: "game" }));
  });
  it("OFFなら直接POSTでも拒否し、過去の記録と取消は維持する", async () => {
    mocked.findGame.mockResolvedValue({ status: "open", standUpRuleEnabled: false });
    expect(await recordTableEvent(request, "test", "game", command)).toEqual({ ok: false, error: "この開催ではSTAND UPはOFFです。" });
    expect(mocked.record).not.toHaveBeenCalled();
    const panel = await getTableEventPanel(request, "test", "game");
    expect(panel.rules.standUp).toBe(false);
    expect(panel.recentEvents).toContainEqual(expect.objectContaining({ id: "existing", canCancel: true }));
    expect(await cancelRecordedTableEvent(request, "test", "game", "existing")).toEqual({ ok: true });
  });
  it("ONでも記録権限のない閲覧者は拒否する", async () => {
    mocked.manager.mockResolvedValue(null);
    expect(await recordTableEvent(request, "test", "game", command)).toMatchObject({ ok: false });
    expect(mocked.record).not.toHaveBeenCalled();
  });
  it("確定後はONでも記録できない", async () => {
    mocked.findGame.mockResolvedValue({ status: "finalized", standUpRuleEnabled: true });
    expect(await recordTableEvent(request, "test", "game", command)).toMatchObject({ ok: false });
    expect(mocked.record).not.toHaveBeenCalled();
    expect((await getTableEventPanel(request, "test", "game")).rules.standUp).toBe(false);
  });
});
