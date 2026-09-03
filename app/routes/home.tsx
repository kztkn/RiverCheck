import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { InviteRequiredPage } from "~/components/invite-required-page";
import { getHomeEntryGroups } from "@server/services/home-entry-service.server";
import { readLastVisitedGroup } from "~/utils/last-visited-group";
import type { Route } from "./+types/home";

export async function loader({ request }: Route.LoaderArgs) {
  return getHomeEntryGroups(request);
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    const rememberedCode = readLastVisitedGroup(window.localStorage);
    const rememberedGroup = rememberedCode
      ? loaderData.groups.find((group) => group.publicCode === rememberedCode)
      : null;
    const destination = rememberedGroup ??
      (loaderData.groups.length === 1 ? loaderData.groups[0] : null);

    if (destination) {
      void navigate(`/g/${encodeURIComponent(destination.publicCode)}`, {
        replace: true,
      });
      return;
    }

    setResolved(true);
  }, [loaderData.groups, navigate]);

  if (!resolved) {
    return (
      <main className="page-shell entry-resolver-page" aria-live="polite">
        <section className="entry-resolver-loading" role="status" aria-label="読み込み中">
          <span className="entry-resolver-spinner" aria-hidden="true" />
        </section>
      </main>
    );
  }

  if (loaderData.groups.length === 0) {
    return <InviteRequiredPage />;
  }

  return (
    <main className="page-shell entry-resolver-page">
      <section className="entry-resolver-choice">
        <p className="eyebrow">RIVERCHECK</p>
        <h1>グループを選択</h1>
        <p>参加するテーブルを選んでください。</p>
        <div className="entry-resolver-groups">
          {loaderData.groups.map((group) => (
            <Link
              className="entry-resolver-group"
              key={group.id}
              to={`/g/${encodeURIComponent(group.publicCode)}`}
            >
              <span>
                <strong>{group.name}</strong>
                <small>/g/{group.publicCode}</small>
              </span>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
