import { GroupSiteHeader } from "~/components/site-menu";
import { Form, Link, redirect, useNavigation } from "react-router";
import {
  claimPlayerProfile,
  getProfileClaimOverview,
} from "@server/services/player-profile-service.server";
import { createPlayerProfileCookie } from "@server/services/player-profile-session.server";
import type { Route } from "./+types/player-profile-claim";

export async function loader({ params }: Route.LoaderArgs) {
  const overview = await getProfileClaimOverview(
    params.groupCode,
    params.claimToken,
  );
  if (!overview) throw new Response("Group not found", { status: 404 });
  return overview;
}

export async function action({ request, params }: Route.ActionArgs) {
  const result = await claimPlayerProfile(params.groupCode, params.claimToken);
  if (!result.ok) return result;
  return redirect(`/g/${params.groupCode}/profile`, {
    status: 303,
    headers: {
      "Set-Cookie": createPlayerProfileCookie(request, result.sessionToken),
    },
  });
}

export default function PlayerProfileClaim({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const claim = loaderData.claim;

  return (
    <main className="page-shell auth-page profile-claim-page">
      <GroupSiteHeader groupCode={loaderData.group.publicCode} />
      <section className="participant-panel auth-panel profile-claim-card">
        <div>
          <p className="eyebrow">PLAYER ACCESS</p>
          <h1>{claim ? `${claim.displayName}さんの本人用リンク` : "リンクを確認できません"}</h1>
          <p className="muted-copy">
            {claim
              ? "この端末をあなたのプロフィールに紐付けます。名前・アイコン・一言を自分で編集できるようになります。"
              : "このリンクは使用済み・期限切れ、または新しいリンクが発行されています。"}
          </p>
        </div>
        {actionData?.ok === false ? (
          <p className="error-notice" role="alert">{actionData.error}</p>
        ) : null}
        {claim ? (
          <>
            <p className="profile-claim-expiry">
              有効期限：{formatExpiry(claim.expiresAt)}
            </p>
            <Form method="post">
              <button className="button button-primary" disabled={isSubmitting} type="submit">
                {isSubmitting ? "紐付け中…" : "この端末を本人として登録"}
              </button>
            </Form>
          </>
        ) : (
          <Link className="button button-secondary" to={`/g/${loaderData.group.publicCode}`}>
            グループトップへ戻る
          </Link>
        )}
      </section>
    </main>
  );
}

function formatExpiry(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

export function headers() {
  return {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  };
}
