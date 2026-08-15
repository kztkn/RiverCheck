import { describe, expect, it, vi } from "vitest";
import { createCommandId } from "./create-command-id";

describe("createCommandId", () => {
  it("randomUUIDが利用できる環境ではその値を使う", () => {
    const randomUUID = vi.fn(() => "11111111-1111-4111-8111-111111111111");

    expect(createCommandId({ randomUUID })).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it("randomUUIDがないスマホ環境でもgetRandomValuesからUUIDを作る", () => {
    const getRandomValues = vi.fn((values: Uint8Array) => {
      values.fill(0);
      return values;
    });

    expect(createCommandId({ getRandomValues })).toBe(
      "00000000-0000-4000-8000-000000000000",
    );
    expect(getRandomValues).toHaveBeenCalledOnce();
  });

  it("Web Cryptoがない環境でもUUID形式を維持する", () => {
    expect(createCommandId({}, () => 0)).toBe(
      "00000000-0000-4000-8000-000000000000",
    );
  });
});
