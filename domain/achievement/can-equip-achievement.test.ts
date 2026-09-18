import { describe, expect, it } from "vitest";
import { canEquipAchievement } from "./can-equip-achievement";

describe("canEquipAchievement", () => {
  const ownUnlocked = ["achievement-owned"];

  it("allows an unlocked achievement", () => {
    expect(canEquipAchievement("achievement-owned", ownUnlocked)).toBe(true);
  });

  it("rejects a locked achievement", () => {
    expect(canEquipAchievement("achievement-locked", ownUnlocked)).toBe(false);
  });

  it("allows unequipping", () => {
    expect(canEquipAchievement(null, ownUnlocked)).toBe(true);
  });
});
