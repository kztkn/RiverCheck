import { listGamesForGroup } from "@server/repositories/game-repository.server";
import {
  findGroupByPublicCode,
  insertGroup,
  listGroups,
  listGroupsForPlayer,
} from "@server/repositories/group-repository.server";
import type { GameListItem } from "@shared-types/game";
import type {
  GroupDirectoryItem,
  GroupSummary,
} from "@shared-types/group";

const GROUP_NAME_MAX_LENGTH = 60;
const GROUP_PUBLIC_CODE_MAX_LENGTH = 48;
const GROUP_PUBLIC_CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export interface GroupOverview {
  group: GroupSummary;
  games: GameListItem[];
}

export interface GroupDirectory {
  currentGroup: GroupSummary;
  groups: GroupDirectoryItem[];
}

export interface CreateGroupFormValues {
  name: string;
  publicCode: string;
}

type CreateGroupErrors = Partial<Record<keyof CreateGroupFormValues, string>>;

export type CreateGroupResult =
  | { ok: true; group: GroupSummary }
  | {
      ok: false;
      errors: CreateGroupErrors;
      values: CreateGroupFormValues;
    };

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

export function validateCreateGroupForm(
  values: CreateGroupFormValues,
): { ok: true; values: CreateGroupFormValues } | {
  ok: false;
  errors: CreateGroupErrors;
  values: CreateGroupFormValues;
} {
  const normalized = {
    name: values.name.trim(),
    publicCode: values.publicCode.trim().toLowerCase(),
  };
  const errors: CreateGroupErrors = {};

  if (!normalized.name) {
    errors.name = "グループ名を入力してください。";
  } else if (Array.from(normalized.name).length > GROUP_NAME_MAX_LENGTH) {
    errors.name = `グループ名は${GROUP_NAME_MAX_LENGTH}文字以内で入力してください。`;
  }

  if (!normalized.publicCode) {
    errors.publicCode = "URL用コードを入力してください。";
  } else if (normalized.publicCode.length > GROUP_PUBLIC_CODE_MAX_LENGTH) {
    errors.publicCode = `URL用コードは${GROUP_PUBLIC_CODE_MAX_LENGTH}文字以内で入力してください。`;
  } else if (!GROUP_PUBLIC_CODE_PATTERN.test(normalized.publicCode)) {
    errors.publicCode = "半角英小文字・数字・ハイフンで入力してください。";
  }

  return Object.keys(errors).length > 0
    ? { ok: false, errors, values: normalized }
    : { ok: true, values: normalized };
}

export async function createGroup(
  values: CreateGroupFormValues,
  initialPlayerId: string | null,
): Promise<CreateGroupResult> {
  const validation = validateCreateGroupForm(values);
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

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
