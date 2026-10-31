import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PayPayLinkEditor } from "./paypay-link-editor";

function renderEditor(link: string | null, collapsible = false) {
  const router = createMemoryRouter([
    {
      path: "/",
      element: createElement(PayPayLinkEditor, {
        actionUrl: "/save",
        cancelUrl: "/back",
        collapsible,
        error: null,
        isSubmitting: false,
        link,
        registeredAt: link ? "2026-09-24T00:00:00.000Z" : null,
        value: null,
      }),
    },
  ]);
  return renderToStaticMarkup(createElement(RouterProvider, { router }));
}

describe("PayPayLinkEditor", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-25T00:00:00.000Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("登録済みリンクには送信しないクリアボタンを表示する", () => {
    const markup = renderEditor("https://pay.paypay.ne.jp/example");

    expect(markup).toContain('value="https://pay.paypay.ne.jp/example"');
    expect(markup).toContain('aria-label="PayPay受取リンクをクリア"');
    expect(markup).toContain('type="button"');
    expect(markup).toContain("×は入力欄を空にするだけです");
  });

  it("空欄ではクリアボタンを表示しない", () => {
    const markup = renderEditor(null);

    expect(markup).not.toContain('aria-label="PayPay受取リンクをクリア"');
  });

  it("開催管理では状態要約付きの折りたたみとして表示できる", () => {
    const markup = renderEditor("https://pay.paypay.ne.jp/example", true);

    expect(markup).toContain("<details");
    expect(markup).toContain("PayPay受取リンク");
    expect(markup).toContain("有効");
    expect(markup).toContain('class="disclosure-chevron"');
  });

  it("表示期限を過ぎたリンクは期限切れと表示する", () => {
    vi.setSystemTime(new Date("2026-10-09T00:00:00.000Z"));

    const markup = renderEditor("https://pay.paypay.ne.jp/example", true);

    expect(markup).toContain("期限切れ");
    expect(markup).not.toContain("<small>有効");
  });
});
