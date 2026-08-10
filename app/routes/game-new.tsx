import { GroupSiteHeader } from "~/components/site-menu";
import { Form, Link, redirect, useNavigation } from "react-router";
import {
  createGameForGroup,
  readCreateGameForm,
} from "@server/services/game-service.server";
import { findGroupByPublicCode } from "@server/repositories/group-repository.server";
import { requireOrganizer } from "@server/services/organizer-auth.server";
import { GameSettingsFields } from "../components/game-settings-fields";
import type { Route } from "./+types/game-new";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireOrganizer(request, params.groupCode);
  const group = await findGroupByPublicCode(params.groupCode);
  if (!group) throw new Response("Group not found", { status: 404 });
  return {
    group: { name: group.name, publicCode: group.publicCode },
    defaultPlayedAt: todayInTokyo(),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireOrganizer(request, params.groupCode);
  const values = readCreateGameForm(await request.formData());
  const result = await createGameForGroup(params.groupCode, values);
  if (!result.ok) return { errors: result.errors, values: result.values };
  return redirect(`/g/${params.groupCode}/games/${result.gameId}/admin`);
}

const defaults = {
  title: "",
  initialChips: "20000",
  venueCost: "11330",
  firstPlaceCost: "0",
  secondPlaceCost: "500",
  thirdPlaceCost: "1000",
  previewParticipantCount: "8",
};

export default function NewGame({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const values = {
    ...defaults,
    playedAt: loaderData.defaultPlayedAt,
    ...actionData?.values,
  };
  const errors = actionData?.errors ?? {};

  return (
    <main className="page-shell form-page">
      <GroupSiteHeader groupCode={loaderData.group.publicCode} organizer />

      <section className="form-intro">
        <h1>NEW GAME</h1>
        <p>{loaderData.group.name} の開催条件を設定します。</p>
      </section>

      <Form className="game-form" method="post" noValidate>
        <GameSettingsFields errors={errors} values={values} />

        <div className="form-actions">
          <button
            className="button button-primary"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "作成中…" : "開催を作成"}
          </button>
          <Link
            className="button button-secondary"
            to={`/g/${loaderData.group.publicCode}/manage`}
          >
            キャンセル
          </Link>
        </div>
      </Form>
    </main>
  );
}

function todayInTokyo(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1_000)
    .toISOString()
    .slice(0, 10);
}
