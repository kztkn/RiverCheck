import type { ReactNode } from "react";
import { Link, useRouteLoaderData } from "react-router";

export interface SiteMenuItem {
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
    | { authenticatedPlayerName: string | null }
    | undefined;
  const authenticatedPlayerName = rootData?.authenticatedPlayerName ?? null;

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
            authenticatedPlayerName
              ? `ログイン中：${authenticatedPlayerName}`
              : "未認証：ゲスト"
          }
          className={`header-player-name${authenticatedPlayerName ? "" : " is-guest"}`}
          title={
            authenticatedPlayerName
              ? `ログイン中：${authenticatedPlayerName}`
              : "プロフィール未認証"
          }
        >
          {authenticatedPlayerName ?? "<ゲスト>"}
        </span>
        <GroupSiteMenu groupCode={groupCode} organizer={organizer} />
      </div>
    </header>
  );
}

export function GroupSiteMenu({
  groupCode,
  organizer = false,
}: {
  groupCode: string;
  organizer?: boolean;
}) {
  const basePath = `/g/${groupCode}`;
  return (
    <SiteMenu
      items={[
        { label: "ランキング", to: `${basePath}/stats` },
        { label: "プロフィール設定", to: `${basePath}/profile` },
        { label: "主催者画面", reloadDocument: true, to: `${basePath}/manage` },
        ...(organizer
          ? [{ label: "メンバー管理", to: `${basePath}/players` }]
          : []),
      ]}
      logoutAction={organizer ? `${basePath}/organizer-login` : undefined}
    />
  );
}

export function SiteMenu({
  items,
  logoutAction,
}: {
  items: SiteMenuItem[];
  logoutAction?: string;
}) {
  return (
    <details className="site-menu">
      <summary aria-label="メニューを開く" title="メニュー">
        <span aria-hidden="true" className="site-menu-icon">
          <span />
          <span />
          <span />
        </span>
      </summary>
      <nav aria-label="サイトメニュー" className="site-menu-panel">
        <span className="site-menu-heading">MENU</span>
        {items.map((item) => (
          <Link
            className="site-menu-link"
            key={`${item.to}-${item.label}`}
            reloadDocument={item.reloadDocument}
            to={item.to}
          >
            {item.label}
          </Link>
        ))}
        {logoutAction ? (
          <form action={logoutAction} method="post">
            <input name="intent" type="hidden" value="logout" />
            <button className="site-menu-link site-menu-logout" type="submit">
              ログアウト
            </button>
          </form>
        ) : null}
      </nav>
    </details>
  );
}
