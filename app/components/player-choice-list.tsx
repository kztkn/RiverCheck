import { Form } from "react-router";
import { PlayerAvatar } from "~/components/player-avatar";

type PlayerChoice = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

export function PlayerChoiceList({
  actionLabel,
  intent,
  isSubmitting,
  players,
  reloadDocument = false,
}: {
  actionLabel: string;
  intent: string;
  isSubmitting: boolean;
  players: PlayerChoice[];
  reloadDocument?: boolean;
}) {
  return (
    <div className="player-choice-list">
      {players.map((player) => (
        <Form
          className="player-choice-form"
          key={player.id}
          method="post"
          reloadDocument={reloadDocument}
        >
          <input name="intent" type="hidden" value={intent} />
          <input name="groupPlayerId" type="hidden" value={player.id} />
          <button
            aria-label={`${player.displayName}として${actionLabel}`}
            className="player-choice-button"
            disabled={isSubmitting}
            type="submit"
          >
            <PlayerAvatar
              avatarUrl={player.avatarUrl}
              displayName={player.displayName}
            />
            <span>{player.displayName}</span>
            <small>{actionLabel}</small>
          </button>
        </Form>
      ))}
    </div>
  );
}
