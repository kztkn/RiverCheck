import { GroupSiteHeader } from "~/components/site-menu";
import { Form, redirect, useNavigation } from "react-router";
import { findGroupByPublicCode } from "@server/repositories/group-repository.server";
import {
  createOrganizerSessionCookie,
  isOrganizerAuthConfigured,
  isOrganizerAuthenticated,
  safeOrganizerReturnTo,
  verifyOrganizerPin,
} from "@server/services/organizer-auth.server";
import type { Route } from "./+types/organizer-login";

export async function loader({ request, params }: Route.LoaderArgs) {
  const group = await findGroupByPublicCode(params.groupCode);
  if (!group) throw new Response("Group not found", { status: 404 });

  const url = new URL(request.url);
  const returnTo = safeOrganizerReturnTo(
    url.searchParams.get("returnTo"),
    params.groupCode,
  );
  if (await isOrganizerAuthenticated(request)) return redirect(returnTo);

  return {
    configured: isOrganizerAuthConfigured(),
    group: { name: group.name, publicCode: group.publicCode },
    returnTo,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();

  const returnTo = safeOrganizerReturnTo(
    readString(formData, "returnTo"),
    params.groupCode,
  );
  if (!isOrganizerAuthConfigured()) {
    return {
      error:
        "主催者認証が未設定です。Cloudflare Secretを確認してください。",
      returnTo,
    };
  }

  const pin = readString(formData, "pin");
  if (!(await verifyOrganizerPin(pin))) {
    return { error: "主催者PINまたは合言葉が違います。", returnTo };
  }

  return redirect(returnTo, {
    headers: {
      "Set-Cookie": await createOrganizerSessionCookie(request),
    },
  });
}

export default function OrganizerLogin({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const returnTo = actionData?.returnTo ?? loaderData.returnTo;

  return (
    <main className="page-shell auth-page">
      <GroupSiteHeader groupCode={loaderData.group.publicCode} />

      <section className="participant-panel auth-panel">
        <div>
          <h1>ORGANIZER ACCESS</h1>
          <p className="muted-copy">
            {loaderData.group.name} の主催者PINまたは合言葉を入力してください。
            この端末では次回から入力を省略できます。
          </p>
        </div>

        {!loaderData.configured ? (
          <p className="error-notice" role="alert">
            主催者認証が未設定です。Cloudflareに
            ORGANIZER_PINとORGANIZER_SESSION_SECRETを設定してください。
          </p>
        ) : null}
        {actionData?.error ? (
          <p className="error-notice" role="alert">
            {actionData.error}
          </p>
        ) : null}

        <Form className="compact-form" method="post">
          <input name="intent" type="hidden" value="login" />
          <input name="returnTo" type="hidden" value={returnTo} />
          <label className="field">
            <span className="field-label">主催者PIN・合言葉</span>
            <input
              autoComplete="current-password"
              autoFocus
              disabled={!loaderData.configured}
              maxLength={100}
              name="pin"
              required
              type="password"
            />
          </label>
          <button
            className="button button-primary"
            disabled={!loaderData.configured || isSubmitting}
            type="submit"
          >
            {isSubmitting ? "確認中…" : "主催者画面へ"}
          </button>
        </Form>
      </section>
    </main>
  );
}

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
