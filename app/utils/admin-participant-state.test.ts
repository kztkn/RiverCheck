import { describe, expect, it } from "vitest";
import {
  getAdminParticipantInputState,
  summarizeAdminParticipantStates,
} from "./admin-participant-state";

describe("admin participant state", () => {
  it("treats an unsubmitted result as a normal pending state", () => {
    expect(getAdminParticipantInputState({
      remainingChips: null,
      outstandingRebuyCount: 2,
      settlementRebuyCount: null,
    })).toBe("pending");
  });

  it("keeps a partially submitted result pending", () => {
    expect(getAdminParticipantInputState({
      remainingChips: 20_000,
      outstandingRebuyCount: 0,
      settlementRebuyCount: null,
    })).toBe("pending");
  });

  it("treats a submitted and matching rebuy count as complete", () => {
    expect(getAdminParticipantInputState({
      remainingChips: 20_000,
      outstandingRebuyCount: 0,
      settlementRebuyCount: 0,
    })).toBe("complete");
  });

  it("treats a submitted but mismatched rebuy count as warning", () => {
    expect(getAdminParticipantInputState({
      remainingChips: 20_000,
      outstandingRebuyCount: 1,
      settlementRebuyCount: 0,
    })).toBe("warning");
  });

  it("summarizes each state", () => {
    expect(summarizeAdminParticipantStates([
      { remainingChips: null, outstandingRebuyCount: 0, settlementRebuyCount: null },
      { remainingChips: null, outstandingRebuyCount: 1, settlementRebuyCount: null },
      { remainingChips: 20_000, outstandingRebuyCount: 0, settlementRebuyCount: 0 },
      { remainingChips: 10_000, outstandingRebuyCount: 1, settlementRebuyCount: 0 },
    ])).toEqual({ pending: 2, complete: 1, warning: 1 });
  });

});
