import { describe, expect, it } from "vitest";
import {
  PLAYER_AVATAR_MAX_BYTES,
  validatePlayerAvatarBytes,
  validatePlayerProfile,
} from "./validate-player-profile";

describe("validatePlayerProfile", () => {
  it("名前と一言を整形する", () => {
    expect(
      validatePlayerProfile({
        displayName: "  PKサンダー  ",
        profileMessage: "  リバーまで諦めない  ",
      }),
    ).toEqual({
      ok: true,
      values: {
        displayName: "PKサンダー",
        profileMessage: "リバーまで諦めない",
      },
    });
  });

  it("空の一言はnullにする", () => {
    const result = validatePlayerProfile({
      displayName: "kazuto",
      profileMessage: "  ",
    });
    expect(result).toMatchObject({
      ok: true,
      values: { profileMessage: null },
    });
  });

  it("空の名前と長すぎる一言を拒否する", () => {
    const result = validatePlayerProfile({
      displayName: " ",
      profileMessage: "あ".repeat(161),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.displayName).toBeTruthy();
    expect(result.errors.profileMessage).toBeTruthy();
  });
});

describe("validatePlayerAvatarBytes", () => {
  it("正しいWebPを許可する", () => {
    const bytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(
      validatePlayerAvatarBytes({
        bytes,
        contentType: "image/webp",
        size: bytes.byteLength,
      }),
    ).toEqual({ ok: true, contentType: "image/webp" });
  });

  it("1MBを超えるファイルを拒否する", () => {
    expect(
      validatePlayerAvatarBytes({
        bytes: new Uint8Array(),
        contentType: "image/webp",
        size: PLAYER_AVATAR_MAX_BYTES + 1,
      }),
    ).toEqual({
      ok: false,
      error: "圧縮後のアイコンは1MB以内にしてください。",
    });
  });
});
