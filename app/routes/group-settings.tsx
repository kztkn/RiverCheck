import { redirect, useNavigation } from "react-router";
import { GroupSiteHeader } from "~/components/site-menu";
import { PayPayLinkEditor } from "~/components/paypay-link-editor";
import { AppToast } from "~/components/app-toast";
import { getGroupSettings } from "@server/services/group-service.server";
import { saveGroupPayPayRecipientLink } from "@server/services/group-paypay-service.server";
import { requireOrganizer } from "@server/services/organizer-auth.server";
import type { Route } from "./+types/group-settings";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireOrganizer(request, params.groupCode);
  const group = await getGroupSettings(params.groupCode);
  if (!group) throw new Response("Group not found", { status: 404 });
  return {
    group,
    notice: new URL(request.url).searchParams.get("notice"),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireOrganizer(request, params.groupCode);
  const group = await getGroupSettings(params.groupCode);
  if (!group) throw new Response("Group not found", { status: 404 });

  const formData = await request.formData();
  if (readString(formData, "intent") !== "save-paypay-link") {
    throw new Response("Unknown action", { status: 400 });
  }

  const result = await saveGroupPayPayRecipientLink(
    group.id,
    readString(formData, "payPayRecipientLink"),
  );
  return result.ok
    ? redirect(
        `/g/${params.groupCode}/settings?notice=paypay-saved`,
        { status: 303 },
      )
    : { ...result, intent: "save-paypay-link" as const };
}

export default function GroupSettings({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const settingsUrl = `/g/${loaderData.group.publicCode}/settings`;
  const payPayAction =
    actionData?.ok === false && actionData.intent === "save-paypay-link"
      ? actionData
      : null;
  const isPayPaySubmitting =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "save-paypay-link";

  return (
    <main className="page-shell form-page">
      <GroupSiteHeader
        groupCode={loaderData.group.publicCode}
        organizer
      />

      <section className="form-intro settings-intro">
        <p className="eyebrow">GROUP SETTINGS</p>
        <h1>グループ設定</h1>
        <p>
          {loaderData.group.name} 全体で共通して使用する設定を管理します。
        </p>
      </section>

      <AppToast
        message={loaderData.notice === "paypay-saved" ? "PayPay受取リンクを保存しました。" : null}
        searchParam="notice"
      />

      <PayPayLinkEditor
        actionUrl={settingsUrl}
        cancelUrl={`/g/${loaderData.group.publicCode}/manage`}
        error={payPayAction?.error ?? null}
        isSubmitting={isPayPaySubmitting}
        link={loaderData.group.payPayRecipientLink}
        registeredAt={loaderData.group.payPayLinkRegisteredAt}
        value={payPayAction?.value ?? null}
      />
    </main>
  );
}

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
