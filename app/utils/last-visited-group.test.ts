import { describe, expect, it } from "vitest";
import {
  DEFAULT_GROUP_CODE,
  LAST_VISITED_GROUP_STORAGE_KEY,
  isValidGroupCode,
  readLastVisitedGroup,
  rememberLastVisitedGroup,
} from "~/utils/last-visited-group";

describe("last visited group", () => {
  it("有効なグループコードだけを保存・復元する", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    rememberLastVisitedGroup(storage, "boardgame");

    expect(values.get(LAST_VISITED_GROUP_STORAGE_KEY)).toBe("boardgame");
    expect(readLastVisitedGroup(storage)).toBe("boardgame");
  });

  it("壊れた値は無視して既定グループへフォールバックできる", () => {
    const storage = {
      getItem: () => "../../admin",
    };

    expect(readLastVisitedGroup(storage)).toBeNull();
    expect(readLastVisitedGroup(storage) ?? DEFAULT_GROUP_CODE).toBe("river-check");
    expect(isValidGroupCode("boardgame-2026")).toBe(true);
    expect(isValidGroupCode("BoardGame")).toBe(false);
  });

  it("storageが利用できない場合も操作を失敗させない", () => {
    const readStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
    };
    const writeStorage = {
      setItem: () => {
        throw new Error("blocked");
      },
    };

    expect(readLastVisitedGroup(readStorage)).toBeNull();
    expect(() => rememberLastVisitedGroup(writeStorage, "boardgame")).not.toThrow();
  });
});
