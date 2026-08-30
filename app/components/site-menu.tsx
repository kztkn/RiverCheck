import { Fragment, type ReactNode } from "react";
import { Form, Link, useRouteLoaderData } from "react-router";
import { PlayerAvatar } from "~/components/player-avatar";

type SiteMenuIcon =
  | "about"
  | "groups"
  | "logout"
  | "organizer"
  | "profile"
  | "stats";

export interface SiteMenuItem {
  icon: SiteMenuIcon;
  label: string;
  reloadDocument?: boolean;
  to: string;
}

export function GroupSiteHeader({
  groupCode,
  organizer = false,
  status,
}: {
  groupCode: string;
  organizer?: boolean;
  status?: ReactNode;
}) {
  const rootData = useRouteLoaderData("root") as
    | {
      authenticatedPlayerAvatarUrl: string | null;
      authenticatedPlayerName: string | null;
      authenticatedPlayerGroupPlayerId: string | null;
      isOrganizer: boolean;
    }
    | undefined;
  const authenticatedPlayerName = rootData?.authenticatedPlayerName ?? null;
  const authenticatedPlayerGroupPlayerId =
    rootData?.authenticatedPlayerGroupPlayerId ?? null;
  const authenticatedPlayerAvatarUrl =
    rootData?.authenticatedPlayerAvatarUrl ?? null;
  const isOrganizer = organizer || (rootData?.isOrganizer ?? false);
  const playerLabel = authenticatedPlayerName ?? "ゲスト";

  return (
    <header className="site-header">
      <Link className="brand" to={`/g/${groupCode}`}>
        <span className="brand-mark">RC</span>
        <span>RiverCheck</span>
      </Link>
      <div className="header-actions">
        {status}
        <span
          aria-label={
            isOrganizer
              ? `主催者ログイン中：${playerLabel}`
              : authenticatedPlayerName
                ? `ログイン中：${authenticatedPlayerName}`
                : "未認証：ゲスト"
          }
          className="header-player-identity"
          title={isOrganizer ? "主催者ログイン中" : undefined}
        >
          <PlayerAvatar
            avatarUrl={authenticatedPlayerAvatarUrl}
            className="header-player-avatar"
            displayName={authenticatedPlayerName ?? ""}
          />
          <span
            className={`header-player-name${authenticatedPlayerName ? "" : " is-guest"
              }${isOrganizer ? " is-organizer" : ""}`}
          >
            {playerLabel}
          </span>
        </span>
        <GroupSiteMenu
          groupCode={groupCode}
          hasPlayer={Boolean(authenticatedPlayerName)}
          groupPlayerId={authenticatedPlayerGroupPlayerId}
          organizer={isOrganizer}
        />
      </div>
    </header>
  );
}

export function GroupSiteMenu({
  groupCode,
  hasPlayer = false,
  groupPlayerId = null,
  organizer = false,
}: {
  groupCode: string;
  hasPlayer?: boolean;
  groupPlayerId?: string | null;
  organizer?: boolean;
}) {
  const basePath = `/g/${groupCode}`;
  const items: SiteMenuItem[] = [];
  if (hasPlayer || organizer) {
    items.push({
      icon: "groups",
      label: "グループを切り替える",
      to: `${basePath}/groups`,
    });
  }
  items.push(
    { icon: "stats", label: "ランキング", to: `${basePath}/stats` },
    {
      icon: "profile",
      label: hasPlayer && groupPlayerId
        ? "プロフィール"
        : "プレイヤーを選択",
      to: hasPlayer && groupPlayerId
        ? `${basePath}/stats/${groupPlayerId}`
        : `${basePath}/profile`,
    },
    { icon: "about", label: "このアプリについて", to: `${basePath}/about` },
    {
      icon: "organizer",
      label: "主催者画面へ",
      reloadDocument: true,
      to: `${basePath}/manage`,
    },
  );

  return (
    <SiteMenu
      items={items}
      organizerLogoutAction={
        organizer ? `${basePath}/organizer-logout` : undefined
      }
      accountLogoutAction={hasPlayer ? `${basePath}/logout` : undefined}
    />
  );
}

export function SiteMenu({
  items,
  organizerLogoutAction,
  accountLogoutAction,
}: {
  items: SiteMenuItem[];
  organizerLogoutAction?: string;
  accountLogoutAction?: string;
}) {
  return (
    <details className="site-menu">
      <summary
        aria-label="メニューを開く"
        className="site-menu-toggle"
        title="メニュー"
      >
        <span aria-hidden="true" className="site-menu-icon">
          <span />
          <span />
          <span />
        </span>
      </summary>
      <nav aria-label="サイトメニュー" className="site-menu-panel">
        <span className="site-menu-heading">MENU</span>
        {items.map((item) => (
          <Fragment key={`${item.to}-${item.label}`}>
            <Link
              className="site-menu-link"
              reloadDocument={item.reloadDocument}
              to={item.to}
            >
              <SiteMenuItemIcon name={item.icon} />
              <span>{item.label}</span>
            </Link>
            {item.icon === "profile" && accountLogoutAction ? (
              <Form
                action={accountLogoutAction}
                method="post"
                reloadDocument
              >
                <input name="intent" type="hidden" value="logout-player" />
                <button className="site-menu-link site-menu-account-logout" type="submit">
                  <SiteMenuItemIcon name="logout" />
                  <span>ログアウト</span>
                </button>
              </Form>
            ) : null}
          </Fragment>
        ))}
        {organizerLogoutAction ? (
          <>
            <span aria-hidden="true" className="site-menu-divider" />
            <Form
              action={organizerLogoutAction}
              method="post"
              reloadDocument
            >
              <input name="intent" type="hidden" value="logout" />
              <button className="site-menu-link site-menu-logout" type="submit">
                <SiteMenuItemIcon name="organizer" />
                <span>主催者モードを終了</span>
              </button>
            </Form>
          </>
        ) : null}
      </nav>
    </details>
  );
}

function SiteMenuItemIcon({ name }: { name: SiteMenuIcon }) {
  const paths: Record<SiteMenuIcon, ReactNode> = {
    about: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5" />
        <path d="M12 8h.01" />
      </>
    ),
    groups: (
      <>
        <rect height="6" rx="1.5" width="8" x="3" y="4" />
        <rect height="6" rx="1.5" width="8" x="13" y="4" />
        <rect height="6" rx="1.5" width="8" x="8" y="14" />
      </>
    ),
    logout: (
      <>
        <path d="M10 5H5v14h5" />
        <path d="M13 8l4 4-4 4" />
        <path d="M8 12h9" />
      </>
    ),
    organizer: (
      <>
        <path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6l-7-3Z" />
        <path d="m9.5 12 1.7 1.7 3.6-4" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5.5 20c.6-4 2.8-6 6.5-6s5.9 2 6.5 6" />
      </>
    ),
    stats: (
      <>
        <path d="M5 20v-6h3v6" />
        <path d="M10.5 20V9h3v11" />
        <path d="M16 20V4h3v16" />
      </>
    ),
  };
  return (
    <svg aria-hidden="true" className="site-menu-item-icon" viewBox="0 0 24 24">
      {paths[name]}
    </svg>
  );
}
