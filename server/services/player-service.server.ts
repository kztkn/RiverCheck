import { findGroupByPublicCode } from "@server/repositories/group-repository.server";
import { PLAYER_DISPLAY_NAME_MAX_LENGTH } from "@domain/player-profile/validate-player-profile";
import {
  attachExistingPlayerToGroup,
  deactivateGroupPlayer,
  insertPlayerForGroup,
  listGroupPlayers,
  listReusablePlayersForGroup,
  updatePlayerDisplayNameForGroup,
} from "@server/repositories/player-repository.server";
import type { GroupSummary } from "@shared-types/group";
import type {
  GroupPlayerSummary,
  ReusablePlayerSummary,
} from "@shared-types/player";

export interface PlayerManagement {
  group: GroupSummary;
  players: GroupPlayerSummary[];
  reusablePlayers: ReusablePlayerSummary[];
}

export interface AddPlayerFormValues {
  displayName: string;
}

type AddPlayerErrors = Partial<Record<keyof AddPlayerFormValues, string>>;

export type AddPlayerResult =
  | { ok: true; groupPlayerId: string }
  | {
      ok: false;
      errors: AddPlayerErrors;
      values: AddPlayerFormValues;
    };

export type AddExistingPlayerResult =
  | { ok: true; groupPlayerId: string }
  | { ok: false; error: string };

export type RenamePlayerResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      value: string;
    };

export type RemovePlayerFromGroupResult =
  | { ok: true }
  | { ok: false; error: string };

export async function getPlayerManagement(
  publicCode: string,
): Promise<PlayerManagement | null> {
  const group = await findGroupByPublicCode(publicCode);
  if (!group) return null;

  const [players, reusablePlayers] = await Promise.all([
    listGroupPlayers(group.id),
    listReusablePlayersForGroup(group.id),
  ]);
  return {
    group,
    players,
    reusablePlayers,
  };
}

export function readAddPlayerForm(formData: FormData): AddPlayerFormValues {
  return {
    displayName: readString(formData, "displayName"),
  };
}

export async function addPlayerForGroup(
  publicCode: string,
  values: AddPlayerFormValues,
): Promise<AddPlayerResult> {
  const displayName = values.displayName.trim();
  const errors: AddPlayerErrors = {};

  if (!displayName) {
    errors.displayName = "表示名を入力してください。";
  } else if (
    Array.from(displayName).length > PLAYER_DISPLAY_NAME_MAX_LENGTH
  ) {
    errors.displayName = `表示名は${PLAYER_DISPLAY_NAME_MAX_LENGTH}文字以内で入力してください。`;
  }

  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      errors,
      values: { displayName: values.displayName },
    };
  }

  const group = await findGroupByPublicCode(publicCode);
  if (!group) {
    return {
      ok: false,
      errors: { displayName: "グループが見つかりません。" },
      values: { displayName: values.displayName },
    };
  }

  const groupPlayerId = await insertPlayerForGroup(group.id, displayName);
  return { ok: true, groupPlayerId };
}

export async function addExistingPlayerForGroup(
  publicCode: string,
  playerId: string,
): Promise<AddExistingPlayerResult> {
  const group = await findGroupByPublicCode(publicCode);
  if (!group) return { ok: false, error: "グループが見つかりません。" };

  const groupPlayerId = await attachExistingPlayerToGroup(group.id, playerId);
  return groupPlayerId
    ? { ok: true, groupPlayerId }
    : {
        ok: false,
        error: "このプロフィールはすでに追加済みか、確認できませんでした。",
      };
}

export async function renamePlayerForGroup(
  publicCode: string,
  groupPlayerId: string,
  rawDisplayName: string,
): Promise<RenamePlayerResult> {
  const displayName = rawDisplayName.trim();
  if (!displayName) {
    return {
      ok: false,
      error: "表示名を入力してください。",
      value: rawDisplayName,
    };
  }
  if (Array.from(displayName).length > PLAYER_DISPLAY_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `表示名は${PLAYER_DISPLAY_NAME_MAX_LENGTH}文字以内で入力してください。`,
      value: rawDisplayName,
    };
  }

  const group = await findGroupByPublicCode(publicCode);
  if (!group) {
    return {
      ok: false,
      error: "グループが見つかりません。",
      value: rawDisplayName,
    };
  }
  const updated = await updatePlayerDisplayNameForGroup(
    group.id,
    groupPlayerId,
    displayName,
  );
  return updated
    ? { ok: true }
    : {
        ok: false,
        error: "メンバーを確認できません。画面を更新してください。",
        value: rawDisplayName,
      };
}

export async function removePlayerFromGroup(
  publicCode: string,
  groupPlayerId: string,
): Promise<RemovePlayerFromGroupResult> {
  const group = await findGroupByPublicCode(publicCode);
  if (!group) return { ok: false, error: "グループが見つかりません。" };

  const removed = await deactivateGroupPlayer(group.id, groupPlayerId);
  return removed
    ? { ok: true }
    : {
        ok: false,
        error: "メンバーを確認できません。画面を更新してください。",
      };
}

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
