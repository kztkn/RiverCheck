import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  getGroupSettings: vi.fn(),
  requireOrganizer: vi.fn(),
  saveGroupPayPayRecipientLink: vi.fn(),
}));

vi.mock("@server/services/group-service.server", () => ({
  getGroupSettings: mocked.getGroupSettings,
}));
vi.mock("@server/services/group-paypay-service.server", () => ({
  saveGroupPayPayRecipientLink: mocked.saveGroupPayPayRecipientLink,
}));
vi.mock("@server/services/organizer-auth.server", () => ({
  requireOrganizer: mocked.requireOrganizer,
}));
vi.mock("~/components/site-menu", () => ({
  GroupSiteHeader: vi.fn(() => null),
}));
vi.mock("~/components/paypay-link-editor", () => ({
  PayPayLinkEditor: vi.fn(() => null),
}));

import { action } from "./group-settings";

const group = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "River Check",
  payPayLinkRegisteredAt: null,
  payPayRecipientLink: null,
  publicCode: "river-check",
};

describe("group settings action", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocked.getGroupSettings.mockResolvedValue(group);
  });

  it("主催者認証後にPayPay受取リンクを保存して設定画面へ戻る", async () => {
    mocked.saveGroupPayPayRecipientLink.mockResolvedValue({ ok: true });

    const result = await action(
      actionArgs({
        intent: "save-paypay-link",
        payPayRecipientLink: "https://pay.paypay.ne.jp/example",
      }),
    );

    expect(mocked.requireOrganizer).toHaveBeenCalledWith(
      expect.any(Request),
      "river-check",
    );
    expect(mocked.saveGroupPayPayRecipientLink).toHaveBeenCalledWith(
      group.id,
      "https://pay.paypay.ne.jp/example",
    );
    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(
      "/g/river-check/settings?notice=paypay-saved",
    );
  });

  it("検証エラーを設定画面へ返す", async () => {
    mocked.saveGroupPayPayRecipientLink.mockResolvedValue({
      ok: false,
      error: "リンクが無効です。",
      value: "invalid",
    });

    const result = await action(
      actionArgs({
        intent: "save-paypay-link",
        payPayRecipientLink: "invalid",
      }),
    );

    expect(result).toEqual({
      ok: false,
      error: "リンクが無効です。",
      value: "invalid",
      intent: "save-paypay-link",
    });
  });

  it("主催者未認証では保存処理へ進まない", async () => {
    mocked.requireOrganizer.mockRejectedValue(
      new Response("Organizer authentication required", { status: 302 }),
    );

    await expect(
      action(
        actionArgs({
          intent: "save-paypay-link",
          payPayRecipientLink: "",
        }),
      ),
    ).rejects.toBeInstanceOf(Response);
    expect(mocked.getGroupSettings).not.toHaveBeenCalled();
    expect(mocked.saveGroupPayPayRecipientLink).not.toHaveBeenCalled();
  });
});

function actionArgs(values: Record<string, string>) {
  return {
    params: { groupCode: "river-check" },
    request: new Request(
      "https://example.com/g/river-check/settings",
      {
        body: new URLSearchParams(values),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        method: "POST",
      },
    ),
  } as Parameters<typeof action>[0];
}
