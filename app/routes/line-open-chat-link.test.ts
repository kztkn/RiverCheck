import { describe, expect, it } from "vitest";
import { validateLineOpenChatLink } from "@domain/community/line-open-chat-link";

describe("validateLineOpenChatLink", () => {
  it("LINE OpenChatの招待URLを受け付ける", () => {
    expect(
      validateLineOpenChatLink(" https://line.me/ti/g2/exampleInvite "),
    ).toEqual({
      ok: true,
      value: "https://line.me/ti/g2/exampleInvite",
    });
  });

  it("空欄は導線を非表示にする設定として受け付ける", () => {
    expect(validateLineOpenChatLink("   ")).toEqual({
      ok: true,
      value: null,
    });
  });

  it("LINE OpenChat以外のURLを拒否する", () => {
    const result = validateLineOpenChatLink("https://example.com/openchat");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("LINEオープンチャット");
    }
  });
});
