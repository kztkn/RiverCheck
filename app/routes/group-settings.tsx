import { Form, redirect, useNavigation } from "react-router";
import { GroupSiteHeader } from "~/components/site-menu";
import { PayPayLinkEditor } from "~/components/paypay-link-editor";
import { AppToast } from "~/components/app-toast";
import {
  getGroupSettings,
  renameGroup,
} from "@server/services/group-service.server";
import { saveGroupLineOpenChatUrl } from "@server/services/group-community-service.server";
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
  const intent = readString(formData, "intent");

  if (intent === "rename-group") {
    const result = await renameGroup(group, readString(formData, "name"));
    return result.ok
      ? redirect(
          `/g/${params.groupCode}/settings?notice=group-name-saved`,
          { status: 303 },
        )
      : { ...result, intent: "rename-group" as const };
  }

  if (intent === "save-openchat-link") {
    const result = await saveGroupLineOpenChatUrl(
      group.id,
      readString(formData, "lineOpenChatUrl"),
    );
    return result.ok
      ? redirect(
          `/g/${params.groupCode}/settings?notice=openchat-saved`,
          { status: 303 },
        )
      : { ...result, intent: "save-openchat-link" as const };
  }

  if (intent === "save-paypay-link") {
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

  throw new Response("Unknown action", { status: 400 });
}

export default function GroupSettings({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const settingsUrl = `/g/${loaderData.group.publicCode}/settings`;
  const groupNameAction =
    actionData?.ok === false && actionData.intent === "rename-group"
      ? actionData
      : null;
  const openChatAction =
    actionData?.ok === false && actionData.intent === "save-openchat-link"
      ? actionData
      : null;
  const payPayAction =
    actionData?.ok === false && actionData.intent === "save-paypay-link"
      ? actionData
      : null;
  const isGroupNameSubmitting =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "rename-group";
  const isOpenChatSubmitting =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "save-openchat-link";
  const isPayPaySubmitting =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "save-paypay-link";
  const toastMessage =
    loaderData.notice === "group-name-saved"
      ? "グループ名を変更しました。"
      : loaderData.notice === "openchat-saved"
        ? "オープンチャットURLを保存しました。"
        : loaderData.notice === "paypay-saved"
          ? "PayPay受取リンクを保存しました。"
          : null;

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
        message={toastMessage}
        searchParam="notice"
      />

      <section className="group-name-settings" aria-labelledby="group-name-heading">
        <div className="group-name-settings-heading">
          <h2 id="group-name-heading">グループ名</h2>
          <p>
            ヘッダー、グループ切替一覧、開催リンクからの招待画面に表示されます。URL用コードは変更されません。
          </p>
        </div>
        <Form className="group-name-settings-form" method="post" noValidate>
          <input name="intent" type="hidden" value="rename-group" />
          <label className="field">
            <span className="field-label">表示名</span>
            <input
              aria-invalid={Boolean(groupNameAction?.error)}
              defaultValue={groupNameAction?.value ?? loaderData.group.name}
              maxLength={60}
              name="name"
              required
            />
            {groupNameAction?.error ? (
              <span className="field-error">{groupNameAction.error}</span>
            ) : (
              <span className="field-hint">最大60文字</span>
            )}
          </label>
          <button
            className="button button-secondary"
            disabled={isGroupNameSubmitting}
            type="submit"
          >
            {isGroupNameSubmitting ? "保存中…" : "名前を変更"}
          </button>
        </Form>
      </section>

      <section className="group-name-settings" aria-labelledby="openchat-heading">
        <div className="group-name-settings-heading">
          <h2 id="openchat-heading">LINEオープンチャット</h2>
          <p>
            URLを設定したグループだけ「このアプリについて」に参加導線を表示します。使わない場合は空欄にしてください。
          </p>
        </div>
        <Form className="group-name-settings-form" method="post" noValidate>
          <input name="intent" type="hidden" value="save-openchat-link" />
          <label className="field">
            <span className="field-label">招待URL</span>
            <input
              aria-invalid={Boolean(openChatAction?.error)}
              autoCapitalize="none"
              autoCorrect="off"
              defaultValue={
                openChatAction?.value ?? loaderData.group.lineOpenChatUrl ?? ""
              }
              inputMode="url"
              maxLength={500}
              name="lineOpenChatUrl"
              placeholder="https://line.me/ti/g2/..."
              spellCheck={false}
              type="url"
            />
            {openChatAction?.error ? (
              <span className="field-error">{openChatAction.error}</span>
            ) : (
              <span className="field-hint">
                空欄で保存すると、このグループではオープンチャット導線を表示しません。
              </span>
            )}
          </label>
          <button
            className="button button-secondary"
            disabled={isOpenChatSubmitting}
            type="submit"
          >
            {isOpenChatSubmitting ? "保存中…" : "OpenChat設定を保存"}
          </button>
        </Form>
      </section>

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
