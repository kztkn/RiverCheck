import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { PayPayLinkEditor } from "./paypay-link-editor";

function renderEditor(link: string | null) {
  const router = createMemoryRouter([
    {
      path: "/",
      element: createElement(PayPayLinkEditor, {
        actionUrl: "/save",
        cancelUrl: "/back",
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
});
