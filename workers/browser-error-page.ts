type RequestHandler = (request: Request) => Response | Promise<Response>;

export function shouldRenderBrowserErrorPage(
  request: Request,
  response: Response,
): boolean {
  if (response.status < 400) return false;
  const pathname = new URL(request.url).pathname;
  if (pathname === "/error" || pathname.endsWith(".data")) return false;
  if (!request.headers.get("Accept")?.includes("text/html")) return false;

  const contentType = response.headers.get("Content-Type") ?? "";
  return !contentType.includes("text/html");
}

export async function renderBrowserErrorPage(
  request: Request,
  originalResponse: Response,
  requestHandler: RequestHandler,
): Promise<Response> {
  const status = normalizeErrorStatus(originalResponse.status);
  const errorUrl = new URL("/error", request.url);
  errorUrl.searchParams.set("status", String(status));

  try {
    const errorRequest = new Request(errorUrl, {
      headers: { Accept: "text/html" },
      method: "GET",
    });
    const errorDocument = await requestHandler(errorRequest);
    const headers = new Headers(errorDocument.headers);
    headers.set("Cache-Control", "no-store");
    copyHeader(originalResponse.headers, headers, "Retry-After");

    return new Response(errorDocument.body, { headers, status });
  } catch (error) {
    console.error("Failed to render browser error page", error);
    return staticErrorPage(status);
  }
}

function normalizeErrorStatus(status: number): number {
  return status >= 400 && status <= 599 ? status : 500;
}

function copyHeader(source: Headers, destination: Headers, name: string): void {
  const value = source.get(name);
  if (value) destination.set(name, value);
}

function staticErrorPage(status: number): Response {
  const html =
    '<!doctype html><html lang="ja"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<title>" +
    status +
    ' | RiverCheck</title></head><body style="margin:0;background:#08130f;' +
    'color:#f7f3e8;font-family:system-ui,sans-serif"><main style="min-height:' +
    '100vh;display:grid;place-content:center;padding:32px"><p style="color:' +
    '#39de8d;font-weight:800;letter-spacing:.14em">RIVER CHECK</p><h1 style="' +
    'font-size:clamp(5rem,24vw,12rem);line-height:.85;margin:16px 0">' +
    status +
    '</h1><p style="color:#9db0a6;max-width:32rem">画面を表示できませんでした。' +
    '時間をおいて、トップからもう一度お試しください。</p><a href="/" style="' +
    'display:inline-block;width:fit-content;margin-top:16px;padding:12px 18px;' +
    'border-radius:10px;background:#39de8d;color:#08130f;font-weight:800;' +
    'text-decoration:none">トップへ戻る</a></main></body></html>';
  return new Response(html, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
