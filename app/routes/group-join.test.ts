import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  findGroupByPublicCode: vi.fn(),
  listGroupPlayers: vi.fn(),
  joinPlayerToGroup: vi.fn(),
  getAuthenticatedPlayerIdentity: vi.fn(),
  getAuthenticatedPlayerProfile: vi.fn(),
  selectPlayerProfile: vi.fn(),
  addPlayerForGroup: vi.fn(),
  createPlayerProfileCookie: vi.fn(() => "player_profile=session; HttpOnly; SameSite=Lax"),
}));
vi.mock("@server/repositories/group-repository.server", () => ({ findGroupByPublicCode: mocked.findGroupByPublicCode }));
vi.mock("@server/repositories/player-repository.server", () => ({ listGroupPlayers: mocked.listGroupPlayers, joinPlayerToGroup: mocked.joinPlayerToGroup }));
vi.mock("@server/services/player-profile-service.server", () => ({
  getAuthenticatedPlayerIdentity: mocked.getAuthenticatedPlayerIdentity,
  getAuthenticatedPlayerProfile: mocked.getAuthenticatedPlayerProfile,
  selectPlayerProfile: mocked.selectPlayerProfile,
}));
vi.mock("@server/services/player-service.server", () => ({ addPlayerForGroup: mocked.addPlayerForGroup }));
vi.mock("@server/services/player-profile-session.server", () => ({ createPlayerProfileCookie: mocked.createPlayerProfileCookie }));

import { action, loader } from "./group-join";

const group = { id: "group-1", publicCode: "friends", name: "Friends" };
const playerId = "11111111-1111-4111-8111-111111111111";
function args(fields?: Record<string, string>) {
  return {
    params: { groupCode: group.publicCode },
    request: new Request("https://example.com/g/friends/join", fields ? { method: "POST", body: new URLSearchParams(fields) } : undefined),
    context: {},
  } as Parameters<typeof action>[0];
}

describe("開催不要のグループ参加リンク", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.findGroupByPublicCode.mockResolvedValue(group);
    mocked.getAuthenticatedPlayerProfile.mockResolvedValue({ group, profile: null });
    mocked.getAuthenticatedPlayerIdentity.mockResolvedValue(null);
    mocked.listGroupPlayers.mockResolvedValue([]);
    mocked.selectPlayerProfile.mockResolvedValue({ ok: true, sessionToken: "session-token" });
    mocked.addPlayerForGroup.mockResolvedValue({ ok: true, groupPlayerId: playerId });
    mocked.joinPlayerToGroup.mockResolvedValue(playerId);
  });

  it("GETは有効メンバーの名前とアイコンだけを返し、所属・プロフィールを作らない", async () => {
    mocked.listGroupPlayers.mockResolvedValue([
      { id: playerId, displayName: "Alice", isActive: true, avatarUpdatedAt: null, profileMessage: "private", hasProfileAccess: true },
      { id: "removed", displayName: "Removed", isActive: false },
    ]);
    const result = await loader(args());
    expect(result.players).toEqual([{ id: playerId, displayName: "Alice", avatarUrl: null }]);
    expect(mocked.addPlayerForGroup).not.toHaveBeenCalled();
    expect(mocked.joinPlayerToGroup).not.toHaveBeenCalled();
    expect(mocked.selectPlayerProfile).not.toHaveBeenCalled();
  });

  it("新規登録後に本人Cookieを設定してグループへ進む", async () => {
    const result = await action(args({ intent: "create-player", displayName: "Alice" }));
    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/g/friends");
    expect(response.headers.get("Set-Cookie")).toContain("HttpOnly");
    expect(mocked.addPlayerForGroup).toHaveBeenCalledWith("friends", { displayName: "Alice" });
    expect(mocked.selectPlayerProfile).toHaveBeenCalledWith("friends", playerId);
  });

  it("登録エラーではCookieを発行せず入力した名前を残す", async () => {
    mocked.addPlayerForGroup.mockResolvedValue({ ok: false, errors: { displayName: "長すぎます。" } });
    expect(await action(args({ intent: "create-player", displayName: "too-long-name" }))).toEqual({ ok: false, error: "長すぎます。", displayName: "too-long-name" });
    expect(mocked.selectPlayerProfile).not.toHaveBeenCalled();
    expect(mocked.createPlayerProfileCookie).not.toHaveBeenCalled();
  });

  it("既存ユーザーの選択は対象グループに限定した本人認証を使う", async () => {
    const response = await action(args({ intent: "select-existing", groupPlayerId: playerId })) as Response;
    expect(response.headers.get("Location")).toBe("/g/friends");
    expect(mocked.selectPlayerProfile).toHaveBeenCalledWith("friends", playerId);
    expect(mocked.addPlayerForGroup).not.toHaveBeenCalled();
  });

  it("無効・他グループの本人選択が拒否されたらCookieを発行しない", async () => {
    mocked.selectPlayerProfile.mockResolvedValue({ ok: false, error: "確認できません。" });
    expect(await action(args({ intent: "select-existing", groupPlayerId: playerId }))).toMatchObject({ ok: false });
    expect(mocked.createPlayerProfileCookie).not.toHaveBeenCalled();
    mocked.selectPlayerProfile.mockClear();
    expect(await action(args({ intent: "select-existing", groupPlayerId: "invalid" }))).toMatchObject({ ok: false });
    expect(mocked.selectPlayerProfile).not.toHaveBeenCalled();
  });

  it("ログイン済み所属者にはグループへの入口を返し、他人の名前選択を出さない", async () => {
    mocked.getAuthenticatedPlayerProfile.mockResolvedValue({ group, profile: { displayName: "Alice" } });
    expect(await loader(args())).toMatchObject({ profile: { displayName: "Alice" }, players: [] });
    expect(mocked.listGroupPlayers).not.toHaveBeenCalled();
  });

  it("別グループでログイン済みなら送信値ではなく本人セッションのplayerを追加する", async () => {
    mocked.getAuthenticatedPlayerIdentity.mockResolvedValue({ playerId: "authenticated-player", displayName: "Alice" });
    expect(await loader(args())).toMatchObject({ identity: { displayName: "Alice" }, players: [] });
    expect(mocked.joinPlayerToGroup).not.toHaveBeenCalled();
    const response = await action(args({ intent: "join-self", groupPlayerId: "someone-else" })) as Response;
    expect(mocked.joinPlayerToGroup).toHaveBeenCalledWith("group-1", "authenticated-player");
    expect(response.headers.get("Set-Cookie")).toBeNull();
  });

  it("ログイン済み端末の名前変更・重複新規登録と、所属解除済みユーザーの再参加を拒否する", async () => {
    mocked.getAuthenticatedPlayerIdentity.mockResolvedValue({ playerId: "authenticated-player", displayName: "Alice" });
    for (const intent of ["create-player", "select-existing"]) {
      expect(await action(args({ intent, groupPlayerId: playerId, displayName: "Bob" }))).toMatchObject({ ok: false });
    }
    expect(mocked.addPlayerForGroup).not.toHaveBeenCalled();
    expect(mocked.selectPlayerProfile).not.toHaveBeenCalled();
    mocked.joinPlayerToGroup.mockResolvedValue(null);
    expect(await action(args({ intent: "join-self" }))).toMatchObject({ ok: false });
  });

  it("セッションが切れた本人参加や存在しないグループで登録しない", async () => {
    expect(await action(args({ intent: "join-self" }))).toMatchObject({ ok: false });
    expect(mocked.joinPlayerToGroup).not.toHaveBeenCalled();
    mocked.getAuthenticatedPlayerProfile.mockResolvedValue(null);
    await expect(loader(args())).rejects.toMatchObject({ status: 404 });
    mocked.findGroupByPublicCode.mockResolvedValue(null);
    expect(await action(args({ intent: "create-player", displayName: "Alice" }))).toMatchObject({ ok: false });
    expect(mocked.addPlayerForGroup).not.toHaveBeenCalled();
  });
});
