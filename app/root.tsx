import { useEffect } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { AppErrorPage } from "~/components/error-page";
import { InviteRequiredPage } from "~/components/invite-required-page";
import { PwaUpdateNotice } from "~/components/pwa-update-notice";
import { TableEventRecorder } from "~/components/table-event-recorder";
import type { Route } from "./+types/root";
import { getAuthenticatedPlayerProfile } from "@server/services/player-profile-service.server";
import { hasMultipleActiveGroupsForPlayer } from "@server/repositories/group-repository.server";
import { isOrganizerAuthenticated } from "@server/services/organizer-auth.server";
import { extractGroupCode } from "@domain/routing/extract-group-code";
import {
  INVITE_REQUIRED_RESPONSE_TEXT,
  isPublicGroupEntryPath,
} from "@domain/routing/public-group-entry";
import { buildPlayerAvatarUrl } from "@domain/player-profile/build-player-avatar-url";
import { rememberLastVisitedGroup } from "~/utils/last-visited-group";
import "./styles/app.css";
import "./styles/groups.css";
import "./styles/highlight.css";
import "./styles/history.css";
import "./styles/qr.css";
import "./styles/profile.css";
import "./styles/participant-status.css";
import "./styles/stats.css";
import "./styles/timeline.css";
import "./styles/table-events.css";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const groupCode = extractGroupCode(url.pathname);
  if (!groupCode) {
    return {
      activeGroupCode: null,
      activeGroupName: null,
      authenticatedPlayerAvatarUrl: null,
      authenticatedPlayerGroupPlayerId: null,
      authenticatedPlayerName: null,
      hasMultipleGroups: false,
      isOrganizer: false,
    };
  }

  const [overview, isOrganizer] = await Promise.all([
    getAuthenticatedPlayerProfile(request, groupCode),
    isOrganizerAuthenticated(request),
  ]);
  const profile = overview?.profile ?? null;

  if (
    !profile &&
    !isOrganizer &&
    !isPublicGroupEntryPath(url.pathname, groupCode)
  ) {
    throw new Response(INVITE_REQUIRED_RESPONSE_TEXT, { status: 403 });
  }

  const hasMultipleGroups = profile
    ? await hasMultipleActiveGroupsForPlayer(profile.playerId)
    : false;
  return {
    activeGroupCode: overview?.group.publicCode ?? null,
    activeGroupName: overview?.group.name ?? null,
    authenticatedPlayerAvatarUrl: profile
      ? buildPlayerAvatarUrl({
          avatarUpdatedAt: profile.avatarUploadedAt,
          groupCode,
          groupPlayerId: profile.groupPlayerId,
        })
      : null,
    authenticatedPlayerGroupPlayerId: profile?.groupPlayerId ?? null,
    authenticatedPlayerName: profile?.displayName ?? null,
    hasMultipleGroups,
    isOrganizer,
  };
}

export const meta: Route.MetaFunction = () => [
  { title: "RiverCheck | ポーカー会の結果・精算管理" },
  {
    name: "description",
    content: "ポーカー会の開催、結果入力、順位計算、会費精算をスマホで管理。",
  },
  { name: "theme-color", content: "#08130f" },
  { name: "mobile-web-app-capable", content: "yes" },
  { name: "apple-mobile-web-app-capable", content: "yes" },
  { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
  { name: "apple-mobile-web-app-title", content: "RiverCheck" },
];

export const links: Route.LinksFunction = () => [
  { rel: "manifest", href: "/manifest.webmanifest" },
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
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
        <PwaUpdateNotice />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  useEffect(() => {
    if (!loaderData.activeGroupCode) return;
    rememberLastVisitedGroup(window.localStorage, loaderData.activeGroupCode);
  }, [loaderData.activeGroupCode]);

  return (
    <>
      <Outlet />
      <TableEventRecorder />
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (
    isRouteErrorResponse(error) &&
    error.status === 403 &&
    error.data === INVITE_REQUIRED_RESPONSE_TEXT
  ) {
    return <InviteRequiredPage title="このグループにはまだ参加していません" />;
  }
  const status = isRouteErrorResponse(error) ? error.status : 500;
  return <AppErrorPage status={status} />;
}
