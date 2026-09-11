import { findGroupByPublicCode } from "@server/repositories/group-repository.server";
import { listGroupPlayers, joinPlayerToGroup } from "@server/repositories/player-repository.server";
import { buildPlayerAvatarUrl } from "@domain/player-profile/build-player-avatar-url";
import {
  getAuthenticatedPlayerIdentity,
  getAuthenticatedPlayerProfile,
  selectPlayerProfile,
} from "./player-profile-service.server";
import { addPlayerForGroup } from "./player-service.server";

export async function getGroupEntry(request: Request, groupCode: string) {
  const overview = await getAuthenticatedPlayerProfile(request, groupCode);
  if (!overview) return null;
  const identity = overview.profile ? null : await getAuthenticatedPlayerIdentity(request);
  const players = overview.profile || identity ? [] : await listGroupPlayers(overview.group.id);
  return {
    group: { name: overview.group.name, publicCode: overview.group.publicCode },
    profile: overview.profile ? { displayName: overview.profile.displayName } : null,
    identity: identity ? { displayName: identity.displayName } : null,
    players: players.filter((player) => player.isActive).map((player) => ({
      id: player.id,
      displayName: player.displayName,
      avatarUrl: buildPlayerAvatarUrl({
        groupCode,
        groupPlayerId: player.id,
        avatarUpdatedAt: player.avatarUpdatedAt,
      }),
    })),
  };
}

type GroupEntryResult =
  | { ok: true; sessionToken?: string }
  | { ok: false; error: string };

export async function enterGroup(
  request: Request,
  groupCode: string,
  input: { intent: string; groupPlayerId: string; displayName: string },
): Promise<GroupEntryResult> {
  const group = await findGroupByPublicCode(groupCode);
  if (!group) return { ok: false, error: "グループが見つかりません。" };
  const identity = await getAuthenticatedPlayerIdentity(request);

  // An authenticated device keeps its identity; never accept another player ID
  // or create a duplicate profile from a stale or tampered registration form.
  if (identity) {
    if (input.intent !== "join-self") {
      return { ok: false, error: "ログイン状態が変わりました。画面を更新してください。" };
    }
    const membership = await joinPlayerToGroup(group.id, identity.playerId);
    return membership
      ? { ok: true }
      : { ok: false, error: "このプロフィールでは参加できません。主催者に確認してください。" };
  }

  if (input.intent === "select-existing") {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(input.groupPlayerId)) {
      return { ok: false, error: "自分の名前を選んでください。" };
    }
    const selected = await selectPlayerProfile(groupCode, input.groupPlayerId);
    return selected.ok ? { ok: true, sessionToken: selected.sessionToken } : selected;
  }

  if (input.intent === "create-player") {
    const added = await addPlayerForGroup(groupCode, { displayName: input.displayName });
    if (!added.ok) return { ok: false, error: added.errors.displayName ?? "登録できませんでした。" };
    const selected = await selectPlayerProfile(groupCode, added.groupPlayerId);
    return selected.ok ? { ok: true, sessionToken: selected.sessionToken } : selected;
  }

  return { ok: false, error: "画面を更新して、もう一度操作してください。" };
}
