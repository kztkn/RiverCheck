import { findGroupByPublicCode } from "@server/repositories/group-repository.server";
import {
  insertPlayerForGroup,
  listGroupPlayers,
} from "@server/repositories/player-repository.server";
import type { GroupSummary } from "@shared-types/group";
import type { GroupPlayerSummary } from "@shared-types/player";

export interface PlayerManagement {
  group: GroupSummary;
  players: GroupPlayerSummary[];
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

export async function getPlayerManagement(
  publicCode: string,
): Promise<PlayerManagement | null> {
  const group = await findGroupByPublicCode(publicCode);
  if (!group) return null;

  return {
    group: {
      id: group.id,
      name: group.name,
      publicCode: group.publicCode,
    },
    players: await listGroupPlayers(group.id),
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
  } else if (Array.from(displayName).length > 40) {
    errors.displayName = "表示名は40文字以内で入力してください。";
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

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
