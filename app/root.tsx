import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import type { Route } from "./+types/root";
import { getAuthenticatedPlayerProfile } from "@server/services/player-profile-service.server";
import "./styles/app.css";
import "./styles/highlight.css";
import "./styles/history.css";
import "./styles/qr.css";
import "./styles/profile.css";
import "./styles/stats.css";

export async function loader({ request }: Route.LoaderArgs) {
  const pathname = new URL(request.url).pathname;
  const groupCodeMatch = /^\/g\/([^/]+)/u.exec(pathname);
  if (!groupCodeMatch?.[1]) return { authenticatedPlayerName: null };

  let groupCode: string;
  try {
    groupCode = decodeURIComponent(groupCodeMatch[1]);
  } catch {
    return { authenticatedPlayerName: null };
  }
  const overview = await getAuthenticatedPlayerProfile(request, groupCode);
  return {
    authenticatedPlayerName: overview?.profile?.displayName ?? null,
  };
}

export const meta: Route.MetaFunction = () => [
  { title: "RiverCheck | ポーカー会の結果・精算管理" },
  {
    name: "description",
    content: "ポーカー会の開催、結果入力、順位計算、会費精算をスマホで管理。",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <footer className="site-footer global-site-footer">
          <span>RIVER CHECK</span>
          <a href="/oss-licenses.md">OSSライセンス</a>
        </footer>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const message =
    status === 404
      ? "ページが見つかりません"
      : "画面を表示できませんでした";

  return (
    <main className="error-page">
      <p className="eyebrow">RIVER CHECK</p>
      <h1>{status}</h1>
      <p>{message}</p>
      <a className="button button-primary" href="/">
        トップへ戻る
      </a>
    </main>
  );
}
