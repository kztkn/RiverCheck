import { insertGame } from "@server/repositories/game-repository.server";
import {
  countGameTitleCharacters,
  GAME_TITLE_MAX_LENGTH,
} from "@domain/game/game-title";
import { findGroupByPublicCode } from "@server/repositories/group-repository.server";
import type { CreateGameInput } from "@shared-types/game";
import {
  calculateCostShares,
  COST_ROUNDING_UNIT,
  MINIMUM_PARTICIPANT_COUNT,
} from "@domain/cost-sharing/calculate-cost-shares";

const JST_OFFSET_MILLISECONDS = 9 * 60 * 60 * 1_000;
const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface GameSettingsFormValues {
  title: string;
  playedAt: string;
  initialChips: string;
  venueCost: string;
  firstPlaceCost: string;
  secondPlaceCost: string;
  thirdPlaceCost: string;
  previewParticipantCount: string;
}

export type CreateGameFormValues = GameSettingsFormValues;

export type GameSettingsFormErrors = Partial<
  Record<keyof GameSettingsFormValues, string>
>;
type CreateGameFormErrors = GameSettingsFormErrors;

export type CreateGameResult =
  | { ok: true; gameId: string }
  | {
      ok: false;
      errors: CreateGameFormErrors;
      values: CreateGameFormValues;
    };

export function readCreateGameForm(formData: FormData): CreateGameFormValues {
  return readGameSettingsForm(formData);
}

export function readGameSettingsForm(
  formData: FormData,
): GameSettingsFormValues {
  return {
    title: readString(formData, "title"),
    playedAt: readString(formData, "playedAt"),
    initialChips: readString(formData, "initialChips"),
    venueCost: readString(formData, "venueCost"),
    firstPlaceCost: readString(formData, "firstPlaceCost"),
    secondPlaceCost: readString(formData, "secondPlaceCost"),
    thirdPlaceCost: readString(formData, "thirdPlaceCost"),
    previewParticipantCount: readString(formData, "previewParticipantCount"),
  };
}

export async function createGameForGroup(
  publicCode: string,
  values: CreateGameFormValues,
): Promise<CreateGameResult> {
  const validation = validateGameSettingsForm(values);
  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors,
      values,
    };
  }

  const group = await findGroupByPublicCode(publicCode);
  if (!group) {
    return {
      ok: false,
      errors: { title: "グループが見つかりません。" },
      values,
    };
  }

  const gameId = await insertGame(group.id, validation.input);
  return { ok: true, gameId };
}

export function validateGameSettingsForm(
  values: GameSettingsFormValues,
  minimumParticipantCount = MINIMUM_PARTICIPANT_COUNT,
):
  | { ok: true; input: CreateGameInput }
  | { ok: false; errors: GameSettingsFormErrors } {
  const errors: GameSettingsFormErrors = {};
  const title = values.title.trim();

  if (!title) {
    errors.title = "開催名を入力してください。";
  } else if (countGameTitleCharacters(title) > GAME_TITLE_MAX_LENGTH) {
    errors.title = `開催名は${GAME_TITLE_MAX_LENGTH}文字以内で入力してください。`;
  }

  const playedAt = parseTokyoDate(values.playedAt);
  if (!playedAt) {
    errors.playedAt = "有効な開催日を入力してください。";
  }

  const initialChips = parsePositiveInteger(
    values.initialChips,
    "initialChips",
    errors,
  );
  const venueCost = parseNonNegativeInteger(
    values.venueCost,
    "venueCost",
    errors,
  );
  const firstPlaceCost = parseNonNegativeInteger(
    values.firstPlaceCost,
    "firstPlaceCost",
    errors,
  );
  const secondPlaceCost = parseNonNegativeInteger(
    values.secondPlaceCost,
    "secondPlaceCost",
    errors,
  );
  const thirdPlaceCost = parseNonNegativeInteger(
    values.thirdPlaceCost,
    "thirdPlaceCost",
    errors,
  );
  const previewParticipantCount = parsePositiveInteger(
    values.previewParticipantCount,
    "previewParticipantCount",
    errors,
  );

  validateRoundedCost(firstPlaceCost, "firstPlaceCost", errors);
  validateRoundedCost(secondPlaceCost, "secondPlaceCost", errors);
  validateRoundedCost(thirdPlaceCost, "thirdPlaceCost", errors);

  if (
    firstPlaceCost !== null &&
    secondPlaceCost !== null &&
    firstPlaceCost > secondPlaceCost
  ) {
    errors.secondPlaceCost = "2位は1位以上の負担額にしてください。";
  }
  if (
    secondPlaceCost !== null &&
    thirdPlaceCost !== null &&
    secondPlaceCost > thirdPlaceCost
  ) {
    errors.thirdPlaceCost = "3位は2位以上の負担額にしてください。";
  }

  if (
    previewParticipantCount !== null &&
    previewParticipantCount < minimumParticipantCount
  ) {
    errors.previewParticipantCount =
      minimumParticipantCount === MINIMUM_PARTICIPANT_COUNT
        ? "精算は4人以上で試算してください。"
        : `現在の参加人数（${minimumParticipantCount}人）以上で試算してください。`;
  }

  if (
    venueCost !== null &&
    firstPlaceCost !== null &&
    secondPlaceCost !== null &&
    thirdPlaceCost !== null &&
    previewParticipantCount !== null &&
    !errors.firstPlaceCost &&
    !errors.secondPlaceCost &&
    !errors.thirdPlaceCost &&
    !errors.previewParticipantCount
  ) {
    try {
      calculateCostShares({
        venueCost,
        participantCount: previewParticipantCount,
        firstPlaceCost,
        secondPlaceCost,
        thirdPlaceCost,
      });
    } catch {
      const settlementTotal =
        Math.ceil(venueCost / COST_ROUNDING_UNIT) * COST_ROUNDING_UNIT;
      if (!Number.isSafeInteger(settlementTotal)) {
        errors.venueCost = "会費が大きすぎます。";
      } else {
        errors.venueCost =
          "この人数では精算総額が不足します。会費か上位の負担額を調整してください。";
      }
    }
  }

  if (Object.keys(errors).length > 0 || !playedAt) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    input: {
      title,
      playedAt,
      initialChips: initialChips!,
      rebuyChips: initialChips!,
      previewParticipantCount: previewParticipantCount!,
      venueCost: venueCost!,
      firstPlaceCost: firstPlaceCost!,
      secondPlaceCost: secondPlaceCost!,
      thirdPlaceCost: thirdPlaceCost!,
    },
  };
}

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function parseNonNegativeInteger(
  value: string,
  field: keyof GameSettingsFormErrors,
  errors: GameSettingsFormErrors,
): number | null {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    errors[field] = "0以上の整数で入力してください。";
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed)) {
    errors[field] = "安全に扱える整数の範囲で入力してください。";
    return null;
  }

  return parsed;
}

function parsePositiveInteger(
  value: string,
  field: keyof GameSettingsFormErrors,
  errors: GameSettingsFormErrors,
): number | null {
  const parsed = parseNonNegativeInteger(value, field, errors);
  if (parsed === 0) {
    errors[field] = "1以上の整数で入力してください。";
    return null;
  }
  return parsed;
}

function validateRoundedCost(
  value: number | null,
  field: keyof GameSettingsFormErrors,
  errors: GameSettingsFormErrors,
): void {
  if (value !== null && value % COST_ROUNDING_UNIT !== 0) {
    errors[field] = "100円単位で入力してください。";
  }
}

function parseTokyoDate(value: string): string | null {
  const match = LOCAL_DATE_PATTERN.exec(value.trim());
  if (!match) return null;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (year < 1_000 || month < 1 || month > 12) {
    return null;
  }

  const utcMilliseconds =
    Date.UTC(year, month - 1, day) - JST_OFFSET_MILLISECONDS;
  const tokyoTime = new Date(utcMilliseconds + JST_OFFSET_MILLISECONDS);

  if (
    tokyoTime.getUTCFullYear() !== year ||
    tokyoTime.getUTCMonth() !== month - 1 ||
    tokyoTime.getUTCDate() !== day
  ) {
    return null;
  }

  return new Date(utcMilliseconds).toISOString();
}
