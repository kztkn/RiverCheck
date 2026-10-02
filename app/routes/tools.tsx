import { GroupSiteHeader } from "~/components/site-menu";
import { ChipBlindTool } from "~/components/chip-blind-tool";
import { findGroupByPublicCode } from "@server/repositories/group-repository.server";
import type { Route } from "./+types/tools";

export async function loader({ params }: Route.LoaderArgs) {
  const group = await findGroupByPublicCode(params.groupCode);
  if (!group) throw new Response("Group not found", { status: 404 });
  return {
    group: {
      name: group.name,
      publicCode: group.publicCode,
    },
  };
}

export default function Tools({ loaderData }: Route.ComponentProps) {
  const { group } = loaderData;

  return (
    <main className="page-shell tools-page">
      <GroupSiteHeader groupCode={group.publicCode} />

      <section className="tools-intro">
        <p className="eyebrow">TOOLS</p>
        <h1>テーブルの準備道具</h1>
        <p>
          開催データとは切り離して、その場で試せる計算ツールです。
        </p>
      </section>

      <ChipBlindTool />
    </main>
  );
}
