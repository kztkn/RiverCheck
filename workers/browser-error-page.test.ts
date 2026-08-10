import { describe, expect, it } from "vitest";
import {
  renderBrowserErrorPage,
  shouldRenderBrowserErrorPage,
} from "./browser-error-page";

describe("browser error page", () => {
  it("ブラウザ遷移で返った素のエラーだけを共通画面の対象にする", () => {
    const documentRequest = new Request(
      "https://example.com/g/river-check/profile",
      {
        headers: { Accept: "text/html,application/xhtml+xml" },
        method: "POST",
      },
    );
    expect(
      shouldRenderBrowserErrorPage(
        documentRequest,
        new Response("Bad Request", { status: 400 }),
      ),
    ).toBe(true);
    expect(
      shouldRenderBrowserErrorPage(
        documentRequest,
        new Response("<h1>App error</h1>", {
          status: 400,
          headers: { "Content-Type": "text/html" },
        }),
      ),
    ).toBe(false);

    const dataRequest = new Request(
      "https://example.com/g/river-check/profile.data",
      { headers: { Accept: "text/html" } },
    );
    expect(
      shouldRenderBrowserErrorPage(
        dataRequest,
        new Response("Bad Request", { status: 400 }),
      ),
    ).toBe(false);
  });

  it("元のstatusを保ったまま安全なエラーrouteを表示する", async () => {
    const request = new Request(
      "https://example.com/g/river-check/profile",
      {
        headers: { Accept: "text/html" },
        method: "POST",
      },
    );
    const response = await renderBrowserErrorPage(
      request,
      new Response("Bad Request", { status: 400 }),
      (errorRequest) =>
        new Response(
          "<p>" +
            new URL(errorRequest.url).searchParams.get("status") +
            "</p>",
          { headers: { "Content-Type": "text/html; charset=utf-8" } },
        ),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.text()).resolves.toContain("<p>400</p>");
  });
});
