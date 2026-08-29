import { Form, useNavigation } from "react-router";
import { PlayerAvatar } from "~/components/player-avatar";

export interface ReusablePlayerChoice {
  playerId: string;
  displayName: string;
  avatarUrl: string | null;
  hasProfileAccess: boolean;
  groupNames: string[];
}

export function ReusablePlayerPicker({
  action,
  currentMemberCount,
  players,
}: {
  action: string;
  currentMemberCount: number;
  players: ReusablePlayerChoice[];
}) {
  const navigation = useNavigation();
  if (players.length === 0) return null;

  const pendingPlayerId =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "add-existing-player"
      ? navigation.formData.get("playerId")
      : null;

  return (
    <section className="member-reuse-section" aria-labelledby="reuse-members-heading">
      <div className="member-reuse-heading">
        <div>
          <p className="eyebrow">EXISTING PROFILES</p>
          <h2 id="reuse-members-heading">他のグループから追加</h2>
          <p>同じ人は新しく作らず、これまでのプロフィールをそのまま使えます。</p>
        </div>
        <span className="count-badge">{players.length}人</span>
      </div>

      <details className="member-reuse-disclosure" open={currentMemberCount === 0 || undefined}>
        <summary>
          <span>追加できるプロフィールを見る</span>
          <span aria-hidden="true">⌄</span>
        </summary>
        <ul className="member-reuse-list">
          {players.map((player) => (
            <li key={player.playerId}>
              <PlayerAvatar avatarUrl={player.avatarUrl} displayName={player.displayName} />
              <span className="member-reuse-copy">
                <strong>{player.displayName}</strong>
                <small>
                  {player.groupNames.length > 0
                    ? player.groupNames.join(" ・ ")
                    : "他のグループ"}
                  {player.hasProfileAccess ? " ・ 本人端末設定済み" : ""}
                </small>
              </span>
              <Form action={action} method="post" reloadDocument>
                <input name="intent" type="hidden" value="add-existing-player" />
                <input name="playerId" type="hidden" value={player.playerId} />
                <button
                  className="button button-secondary button-small"
                  disabled={pendingPlayerId === player.playerId}
                  type="submit"
                >
                  {pendingPlayerId === player.playerId ? "追加中…" : "追加"}
                </button>
              </Form>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
