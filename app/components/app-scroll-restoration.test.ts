import { describe, expect, it } from "vitest";
import {
  getAppScrollStorageKey,
  readAppScrollPosition,
  resolveAppScrollLocationKey,
  resolveAppScrollPosition,
  writeAppScrollPosition,
} from "./app-scroll-restoration";

function createStorage(initial?: Record<string, string>) {
  const values = new Map(Object.entries(initial ?? {}));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("app scroll restoration", () => {
  it("stores each history entry independently", () => {
    const storage = createStorage();
    writeAppScrollPosition(storage, "first", 321.4);
    writeAppScrollPosition(storage, "second", 87);

    expect(readAppScrollPosition(storage, "first")).toBe(321);
    expect(readAppScrollPosition(storage, "second")).toBe(87);
  });

  it("treats missing, invalid, and negative positions as the top", () => {
    const storage = createStorage({
      [getAppScrollStorageKey("invalid")]: "not-a-number",
      [getAppScrollStorageKey("negative")]: "-20",
    });

    expect(readAppScrollPosition(storage, "missing")).toBe(0);
    expect(readAppScrollPosition(storage, "invalid")).toBe(0);
    expect(readAppScrollPosition(storage, "negative")).toBe(0);
  });

  it("restores POP, preserves REPLACE, and resets PUSH navigation", () => {
    expect(
      resolveAppScrollPosition({
        currentPosition: 200,
        navigationType: "POP",
        storedPosition: 450,
      }),
    ).toBe(450);
    expect(
      resolveAppScrollPosition({
        currentPosition: 200,
        navigationType: "REPLACE",
        storedPosition: 450,
      }),
    ).toBe(200);
    expect(
      resolveAppScrollPosition({
        currentPosition: 200,
        navigationType: "PUSH",
        storedPosition: 450,
      }),
    ).toBe(0);
  });

  it("scopes the default initial history key to its URL", () => {
    expect(
      resolveAppScrollLocationKey({
        hash: "",
        key: "default",
        pathname: "/g/alpha",
        search: "?tab=games",
      }),
    ).toBe("initial:/g/alpha?tab=games");
    expect(
      resolveAppScrollLocationKey({
        hash: "",
        key: "history-entry",
        pathname: "/g/alpha",
        search: "",
      }),
    ).toBe("history-entry");
  });
});
