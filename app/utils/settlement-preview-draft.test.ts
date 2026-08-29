import { describe, expect, it } from "vitest";
import {
  buildSettlementPreviewDraftStorageKey,
  hasSameSettlementPreviewValues,
  parseSettlementPreviewDraft,
  type SettlementPreviewDraft,
} from "./settlement-preview-draft";

const draft: SettlementPreviewDraft = {
  version: 1,
  venueCost: "12000",
  participantCount: "6",
  shareValues: ["0", "1000", "1500", "3000", "3000", "3500"],
  recommendationMode: "standard",
  adjustmentMode: "top-three",
};

describe("settlement preview draft", () => {
  it("開催ごとに安定したlocalStorage keyを作る", () => {
    expect(
      buildSettlementPreviewDraftStorageKey(
        "river-check",
        "22222222-2222-4222-8222-222222222222",
      ),
    ).toBe(
      "rivercheck:settlement-preview:v1:river-check:22222222-2222-4222-8222-222222222222",
    );
  });

  it("正しい下書きを復元する", () => {
    expect(parseSettlementPreviewDraft(JSON.stringify(draft))).toEqual(draft);
  });

  it("壊れた下書きは無視する", () => {
    expect(parseSettlementPreviewDraft("not-json")).toBeNull();
    expect(
      parseSettlementPreviewDraft(
        JSON.stringify({ ...draft, recommendationMode: "unknown" }),
      ),
    ).toBeNull();
  });

  it("正式設定と同じ金額・人数・配分なら下書き扱いにしない", () => {
    expect(
      hasSameSettlementPreviewValues(draft, {
        ...draft,
        recommendationMode: "gentle",
        adjustmentMode: "individual",
      }),
    ).toBe(true);
    expect(
      hasSameSettlementPreviewValues(draft, {
        ...draft,
        shareValues: [...draft.shareValues.slice(0, -1), "3600"],
      }),
    ).toBe(false);
  });
});
