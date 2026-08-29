export type SettlementDraftRecommendationMode =
  | "podium"
  | "standard"
  | "gentle"
  | "simple";

export type SettlementDraftAdjustmentMode = "top-three" | "individual";

export interface SettlementPreviewDraft {
  version: 1;
  venueCost: string;
  participantCount: string;
  shareValues: string[];
  recommendationMode: SettlementDraftRecommendationMode;
  adjustmentMode: SettlementDraftAdjustmentMode;
}

const recommendationModes = new Set<SettlementDraftRecommendationMode>([
  "podium",
  "standard",
  "gentle",
  "simple",
]);
const adjustmentModes = new Set<SettlementDraftAdjustmentMode>([
  "top-three",
  "individual",
]);

export function buildSettlementPreviewDraftStorageKey(
  groupCode: string,
  gameId: string,
): string {
  return `rivercheck:settlement-preview:v1:${groupCode}:${gameId}`;
}

export function parseSettlementPreviewDraft(
  raw: string | null,
): SettlementPreviewDraft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SettlementPreviewDraft> | null;
    if (!value || value.version !== 1) return null;
    if (typeof value.venueCost !== "string") return null;
    if (typeof value.participantCount !== "string") return null;
    if (
      !Array.isArray(value.shareValues) ||
      value.shareValues.length > 100 ||
      value.shareValues.some((share) => typeof share !== "string")
    ) {
      return null;
    }
    if (
      !recommendationModes.has(
        value.recommendationMode as SettlementDraftRecommendationMode,
      ) ||
      !adjustmentModes.has(
        value.adjustmentMode as SettlementDraftAdjustmentMode,
      )
    ) {
      return null;
    }
    return {
      version: 1,
      venueCost: value.venueCost,
      participantCount: value.participantCount,
      shareValues: [...value.shareValues],
      recommendationMode:
        value.recommendationMode as SettlementDraftRecommendationMode,
      adjustmentMode: value.adjustmentMode as SettlementDraftAdjustmentMode,
    };
  } catch {
    return null;
  }
}

export function hasSameSettlementPreviewValues(
  left: SettlementPreviewDraft,
  right: SettlementPreviewDraft,
): boolean {
  return (
    left.venueCost === right.venueCost &&
    left.participantCount === right.participantCount &&
    left.shareValues.length === right.shareValues.length &&
    left.shareValues.every((share, index) => share === right.shareValues[index])
  );
}
