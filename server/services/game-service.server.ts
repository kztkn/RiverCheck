import {
  deleteOpenGame,
  insertGame,
  updateOpenGameIdentity,
  updateOpenGameTitle,
} from "@server/repositories/game-repository.server";
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
import { notifyNewGameCreated } from "@server/services/push-notification-service.server";

import { validateCostSharePlan } from "@domain/cost-sharing/validate-cost-share-plan";

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
  costShares: string[];
  sevenDeuceRuleEnabled: boolean;
  bombPotRuleEnabled: boolean;
}

export interface GameIdentityFormValues {
  title: string;
  playedAt: string;
}

export type GameIdentityFormErrors = Partial<
  Record<keyof GameIdentityFormValues, string>
>;

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

export type OpenGameManagementResult =
  | { ok: true }
  | { ok: false; error: string };

export function readCreateGameForm(formData: FormData): CreateGameFormValues {
  return readGameSettingsForm(formData);
}

export function readGameIdentityForm(
  formData: FormData,
): GameIdentityFormValues {
  return {
    title: readString(formData, "title"),
    playedAt: readString(formData, "playedAt"),
  };
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
    costShares: readStrings(formData, "costShare"),
    sevenDeuceRuleEnabled:
      readString(formData, "sevenDeuceRuleEnabled") === "yes",
    bombPotRuleEnabled:
      readString(formData, "bombPotRuleEnabled") === "yes",
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
  try {
    await notifyNewGameCreated({
      gameId,
      groupId: group.id,
      groupName: group.name,
      groupPublicCode: group.publicCode,
      playedAt: validation.input.playedAt,
      title: validation.input.title,
    });
  } catch (error) {
    // Notifications are an enhancement. A delivery problem must never roll
    // back or hide a game that was created successfully.
    console.error("Failed to notify players about a new game", {
      errorType: error instanceof Error ? error.name : "unknown",
      gameId,
    });
  }
  return { ok: true, gameId };
}

export async function updateOpenGameIdentityForGroup(
  groupId: string,
  gameId: string,
  values: GameIdentityFormValues,
): Promise<
  | { ok: true }
  | { ok: false; errors: GameIdentityFormErrors; error: string }
> {
  const validation = validateGameIdentityForm(values);
  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors,
      error:
        validation.errors.title ??
        validation.errors.playedAt ??
        "開催設定を確認してください。",
    };
  }

  const updated = await updateOpenGameIdentity(
    groupId,
    gameId,
    validation.input,
  );
  return updated
    ? { ok: true }
    : {
        ok: false,
        errors: {},
        error: "開催設定を保存できませんでした。画面を更新してください。",
      };
}

export async function renameOpenGameForGroup(
  groupId: string,
  gameId: string,
  value: string,
): Promise<OpenGameManagementResult> {
  const title = value.trim();
  const titleError = validateGameTitle(title);
  if (titleError) return { ok: false, error: titleError };

  const updated = await updateOpenGameTitle(groupId, gameId, title);
  return updated
    ? { ok: true }
    : {
        ok: false,
        error: "開催名を変更できませんでした。画面を更新してください。",
      };
}

export async function removeOpenGameForGroup(
  groupId: string,
  gameId: string,
): Promise<OpenGameManagementResult> {
  const deleted = await deleteOpenGame(groupId, gameId);
  return deleted
    ? { ok: true }
    : {
        ok: false,
        error: "開催を削除できませんでした。確定済みでないか確認してください。",
      };
}

export function validateGameIdentityForm(values: GameIdentityFormValues):
  | { ok: true; input: { title: string; playedAt: string } }
  | { ok: false; errors: GameIdentityFormErrors } {
  const errors: GameIdentityFormErrors = {};
  const title = values.title.trim();

  const titleError = validateGameTitle(title);
  if (titleError) errors.title = titleError;

  const playedAt = parseTokyoDate(values.playedAt);
  if (!playedAt) {
    errors.playedAt = "有効な開催日を入力してください。";
  }

  if (Object.keys(errors).length > 0 || !playedAt) {
    return { ok: false, errors };
  }

  return { ok: true, input: { title, playedAt } };
}

export function validateGameSettingsForm(
  values: GameSettingsFormValues,
  minimumParticipantCount = MINIMUM_PARTICIPANT_COUNT,
):
  | { ok: true; input: CreateGameInput }
  | { ok: false; errors: GameSettingsFormErrors } {
  const errors: GameSettingsFormErrors = {};
  const title = values.title.trim();

  const titleError = validateGameTitle(title);
  if (titleError) errors.title = titleError;

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
  const previewParticipantCount = parsePositiveInteger(
    values.previewParticipantCount,
    "previewParticipantCount",
    errors,
  );
  if (
    previewParticipantCount !== null &&
    previewParticipantCount < minimumParticipantCount
  ) {
    errors.previewParticipantCount =
      minimumParticipantCount === MINIMUM_PARTICIPANT_COUNT
        ? "精算は4人以上で試算してください。"
        : `現在の参加人数（${minimumParticipantCount}人）以上で試算してください。`;
  }

  let firstPlaceCost: number | null = null;
  let secondPlaceCost: number | null = null;
  let thirdPlaceCost: number | null = null;
  let costShares: number[] | null = null;

  if (values.costShares.length > 0) {
    const parsedShares = parseCostShares(values.costShares, errors);
    if (
      parsedShares &&
      venueCost !== null &&
      previewParticipantCount !== null &&
      !errors.previewParticipantCount
    ) {
      const planError = getCostSharePlanError(
        venueCost,
        previewParticipantCount,
        parsedShares,
      );
      if (planError) {
        errors.costShares = planError;
      } else {
        costShares = parsedShares;
        firstPlaceCost = parsedShares[0] ?? null;
        secondPlaceCost = parsedShares[1] ?? null;
        thirdPlaceCost = parsedShares[2] ?? null;
      }
    }
  } else {
    firstPlaceCost = parseNonNegativeInteger(
      values.firstPlaceCost,
      "firstPlaceCost",
      errors,
    );
    secondPlaceCost = parseNonNegativeInteger(
      values.secondPlaceCost,
      "secondPlaceCost",
      errors,
    );
    thirdPlaceCost = parseNonNegativeInteger(
      values.thirdPlaceCost,
      "thirdPlaceCost",
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
        costShares = calculateCostShares({
          venueCost,
          participantCount: previewParticipantCount,
          firstPlaceCost,
          secondPlaceCost,
          thirdPlaceCost,
        }).shares;
      } catch {
        errors.venueCost =
          "この人数では精算総額が不足します。会費か上位の負担額を調整してください。";
      }
    }
  }

  if (Object.keys(errors).length > 0 || !playedAt || !costShares) {
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
      costShares,
      sevenDeuceRuleEnabled: values.sevenDeuceRuleEnabled,
      bombPotRuleEnabled: values.bombPotRuleEnabled,
    },
  };
}

function validateGameTitle(title: string): string | null {
  if (!title) return "開催名を入力してください。";
  if (countGameTitleCharacters(title) > GAME_TITLE_MAX_LENGTH) {
    return `開催名は${GAME_TITLE_MAX_LENGTH}文字以内で入力してください。`;
  }
  return null;
}

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function readStrings(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .filter((value): value is string => typeof value === "string");
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

function parseCostShares(
  values: string[],
  errors: GameSettingsFormErrors,
): number[] | null {
  const parsed = values.map((value) => {
    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) return null;
    const amount = Number(normalized);
    return Number.isSafeInteger(amount) ? amount : null;
  });
  if (parsed.some((value) => value === null)) {
    errors.costShares = "各順位の負担額を0以上の整数で入力してください。";
    return null;
  }
  return parsed as number[];
}

function getCostSharePlanError(
  venueCost: number,
  participantCount: number,
  shares: number[],
): string | null {
  if (shares.length !== participantCount) {
    return `負担額は${participantCount}人分入力してください。`;
  }
  const unroundedIndex = shares.findIndex(
    (share) => share % COST_ROUNDING_UNIT !== 0,
  );
  if (unroundedIndex >= 0) {
    return `${unroundedIndex + 1}位の負担額を100円単位で入力してください。`;
  }
  const reversedIndex = shares.findIndex(
    (share, index) => index > 0 && share < shares[index - 1]!,
  );
  if (reversedIndex >= 0) {
    return `${reversedIndex + 1}位は${reversedIndex}位以上の負担額にしてください。`;
  }
  const settlementTotal =
    Math.ceil(venueCost / COST_ROUNDING_UNIT) * COST_ROUNDING_UNIT;
  const allocatedTotal = shares.reduce((total, share) => total + share, 0);
  if (
    !Number.isSafeInteger(settlementTotal) ||
    !Number.isSafeInteger(allocatedTotal)
  ) {
    return "会費または負担額が大きすぎます。";
  }
  const difference = settlementTotal - allocatedTotal;
  if (difference > 0) {
    return `負担額合計が精算総額より${difference.toLocaleString("ja-JP")}円不足しています。`;
  }
  if (difference < 0) {
    return `負担額合計が精算総額より${Math.abs(difference).toLocaleString("ja-JP")}円多いです。`;
  }
  try {
    validateCostSharePlan({ venueCost, participantCount, shares });
    return null;
  } catch {
    return "順位別の負担額を確認してください。";
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
