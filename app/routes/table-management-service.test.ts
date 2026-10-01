import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findGame: vi.fn(), findGroup: vi.fn(), read: vi.fn(), start: vi.fn(), move: vi.fn(),
  admin: vi.fn(), identity: vi.fn(),
}));
vi.mock("@server/repositories/game-repository.server", () => ({ findGameForGroup: mocks.findGame }));
vi.mock("@server/repositories/group-repository.server", () => ({ findGroupByPublicCode: mocks.findGroup }));
vi.mock("@server/repositories/table-management-repository.server", () => ({
  readTableManagement: mocks.read, startTableManagement: mocks.start, moveTableParticipant: mocks.move,
}));
vi.mock("@server/services/organizer-auth.server", () => ({ isOrganizerAuthenticated: mocks.admin }));
vi.mock("@server/services/player-profile-service.server", () => ({ getAuthenticatedPlayerIdentity: mocks.identity }));
vi.mock("@server/repositories/game-authorization-repository.server", () => ({ hasGroupEventCreatorPermission: vi.fn() }));

import { changeTableManagement, getTableManagementPanel } from "@server/services/table-management-service.server";
const request = new Request("https://rivercheck.test/g/test/games/game/tables", { method: "POST" });
const id = "00000000-0000-4000-8000-000000000001";
function startForm() {
  const form = new FormData(); form.set("intent", "start");
  form.append("mainIds", id); form.append("subIds", "00000000-0000-4000-8000-000000000002");
  return form;
}

describe("卓管理の所有者認可", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.findGroup.mockResolvedValue({ id: "group" });
    mocks.findGame.mockResolvedValue({ id: "game", status: "open", createdByPlayerId: "owner" });
    mocks.admin.mockResolvedValue(false);
    mocks.identity.mockResolvedValue(null);
    mocks.read.mockResolvedValue({ startedAt: null, serverNow: "2026-10-01T12:00:00Z", participants: [{ groupPlayerId: id, table: "MAIN", subEnteredAt: null }], moves: [] });
    mocks.start.mockResolvedValue(true);
    mocks.move.mockResolvedValue(true);
  });
  it("一般参加者・他開催の作成者は開始も移動もできない", async () => {
    for (const identity of [null, { playerId: "another-owner" }]) {
      mocks.identity.mockResolvedValue(identity);
      for (const intent of ["start", "move"]) {
        const form = startForm(); form.set("intent", intent);
        await expect(changeTableManagement(request, "test", "game", form)).rejects.toMatchObject({ status: 403 });
      }
    }
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.move).not.toHaveBeenCalled();
  });
  it("ADMINとその開催所有者だけが開始できる", async () => {
    mocks.admin.mockResolvedValue(true);
    expect(await changeTableManagement(request, "test", "game", startForm())).toEqual({ ok: true });
    mocks.admin.mockResolvedValue(false);
    mocks.identity.mockResolvedValue({ playerId: "owner" });
    expect(await changeTableManagement(request, "test", "game", startForm())).toEqual({ ok: true });
    expect(mocks.start).toHaveBeenCalledTimes(2);
  });
  it("開始後は閲覧専用の卓情報を返し、OFF開催は一般参加者へ振り分け画面を出さない", async () => {
    expect(await getTableManagementPanel(request, "test", "game")).toMatchObject({ startedAt: null, canManage: false, participants: [] });
    const seats = [{ groupPlayerId: id, table: "SUB", subEnteredAt: "2026-10-01T11:00:00Z" }];
    mocks.read.mockResolvedValue({ startedAt: "2026-10-01T11:00:00Z", participants: seats, moves: [], serverNow: "2026-10-01T12:00:00Z" });
    expect(await getTableManagementPanel(request, "test", "game")).toMatchObject({ canManage: false, participants: seats });
  });
  it("確定後・不正な移動指示は管理者にも許可しない", async () => {
    mocks.admin.mockResolvedValue(true);
    mocks.findGame.mockResolvedValue({ status: "finalized", createdByPlayerId: "owner" });
    expect((await changeTableManagement(request, "test", "game", startForm())).ok).toBe(false);
    expect((await getTableManagementPanel(request, "test", "game")).canManage).toBe(false);
    mocks.findGame.mockResolvedValue({ status: "open", createdByPlayerId: "owner" });
    const form = new FormData(); form.set("intent", "move"); form.set("groupPlayerId", id);
    form.set("commandId", crypto.randomUUID()); form.set("fromTable", "SUB"); form.set("toTable", "MAIN");
    form.set("expectedSubEnteredAt", "invalid");
    expect((await changeTableManagement(request, "test", "game", form)).ok).toBe(false);
    form.set("expectedSubEnteredAt", "2026-10-01T11:00:00Z");
    expect(await changeTableManagement(request, "test", "game", form)).toEqual({ ok: true });
    expect(mocks.move).toHaveBeenCalledWith(expect.objectContaining({ actorPlayerId: null, expectedSubEnteredAt: "2026-10-01T11:00:00Z" }));
  });
});
