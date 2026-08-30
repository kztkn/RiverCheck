import { Form } from "react-router";

export function GroupInviteJoinPanel({
  displayName,
  groupName,
  isSubmitting,
}: {
  displayName: string;
  groupName: string;
  isSubmitting: boolean;
}) {
  return (
    <section className="participant-panel">
      <div className="section-heading compact-heading">
        <div>
          <p className="eyebrow">GROUP INVITE</p>
          <h2>{groupName}に参加</h2>
        </div>
      </div>
      <p className="muted-copy">
        RiverCheckで「{displayName}」として利用中です。このプロフィールのままグループへ参加し、今回の開催にも登録できます。
      </p>
      <Form method="post" reloadDocument>
        <input
          name="intent"
          type="hidden"
          value="join-current-profile-to-group"
        />
        <button
          className="button button-primary"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "参加中…" : displayName + "として参加"}
        </button>
      </Form>
      <p className="field-hint">
        名前やアイコンは共通のまま、戦績・ランキング・実績はこのグループで新しく始まります。
      </p>
    </section>
  );
}
