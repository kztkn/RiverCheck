import { listGamesForGroup } from "@server/repositories/game-repository.server";
import {
  findGroupByPublicCode,
  insertGroup,
  listGroups,
  listGroupsForPlayer,
  updateGroupName,
} from "@server/repositories/group-repository.server";
import {
  validateGroupIdentity,
  type GroupIdentityErrors,
  type GroupIdentityValues,
} from "@domain/group/validate-group";
import type { GameListItem } from "@shared-types/game";
import type {
  GroupDirectoryItem,
  GroupSummary,
} from "@shared-types/group";

export interface GroupOverview {
  group: GroupSummary;
  games: GameListItem[];
}

export interface GroupDirectory {
  currentGroup: GroupSummary;
  groups: GroupDirectoryItem[];
}

export type CreateGroupFormValues = GroupIdentityValues;
type CreateGroupErrors = GroupIdentityErrors;

export type CreateGroupResult =
  | { ok: true; group: GroupSummary }
  | {
      ok: false;
      errors: CreateGroupErrors;
      values: CreateGroupFormValues;
    };

export type RenameGroupResult =
  | { ok: true; name: string }
  | { ok: false; error: string; value: string };

export async function getGroupOverview(
  publicCode: string,
): Promise<GroupOverview | null> {
  const group = await findGroupByPublicCode(publicCode);
  if (!group) return null;

  const games = await listGamesForGroup(group.id);
  return {
    group,
    games,
  };
}

export async function getGroupSettings(
  publicCode: string,
): Promise<GroupSummary | null> {
  return findGroupByPublicCode(publicCode);
}

export async function getGroupDirectory(
  currentPublicCode: string,
  playerId: string | null,
  organizer: boolean,
): Promise<GroupDirectory | null> {
  const currentGroup = await findGroupByPublicCode(currentPublicCode);
  if (!currentGroup) return null;

  const groups = organizer
    ? await listGroups()
    : playerId
      ? await listGroupsForPlayer(playerId)
      : [{
          id: currentGroup.id,
          name: currentGroup.name,
          publicCode: currentGroup.publicCode,
        }];

  if (!groups.some((group) => group.id === currentGroup.id)) {
    groups.unshift({
      id: currentGroup.id,
      name: currentGroup.name,
      publicCode: currentGroup.publicCode,
    });
  }

  return { currentGroup, groups };
}

export function readCreateGroupForm(formData: FormData): CreateGroupFormValues {
  return {
    name: readString(formData, "name"),
    publicCode: readString(formData, "publicCode"),
  };
}

export async function createGroup(
  values: CreateGroupFormValues,
  initialPlayerId: string | null,
): Promise<CreateGroupResult> {
  const validation = validateGroupIdentity(values);
  if (!validation.ok) return validation;

  if (await findGroupByPublicCode(validation.values.publicCode)) {
    return {
      ok: false,
      errors: { publicCode: "このURL用コードはすでに使われています。" },
      values: validation.values,
    };
  }

  try {
    const group = await insertGroup(
      validation.values.name,
      validation.values.publicCode,
      initialPlayerId,
    );
    return { ok: true, group };
  } catch (error) {
    console.error("Failed to create group", error);
    return {
      ok: false,
      errors: { publicCode: "グループを作成できませんでした。別のコードでお試しください。" },
      values: validation.values,
    };
  }
}

export async function renameGroup(
  group: GroupSummary,
  name: string,
): Promise<RenameGroupResult> {
  const validation = validateGroupIdentity({
    name,
    publicCode: group.publicCode,
  });
  if (!validation.ok) {
    return {
      ok: false,
      error: validation.errors.name ?? "グループ名を確認してください。",
      value: name,
    };
  }

  try {
    const saved = await updateGroupName(group.id, validation.values.name);
    return saved
      ? { ok: true, name: validation.values.name }
      : {
          ok: false,
          error: "グループ名を保存できませんでした。画面を更新してください。",
          value: validation.values.name,
        };
  } catch (error) {
    console.error("Failed to rename group", error);
    return {
      ok: false,
      error: "グループ名を保存できませんでした。時間をおいて再度お試しください。",
      value: validation.values.name,
    };
  }
}

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
