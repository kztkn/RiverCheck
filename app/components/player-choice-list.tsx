import { Form } from "react-router";
import { useEffect, useRef, useState } from "react";
import { PlayerAvatar } from "~/components/player-avatar";

type PlayerChoice = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

export function buildPlayerJoinConfirmation(displayName: string) {
  return {
    description: `参加すると、この端末では${displayName}のプロフィールとしてログイン状態になります。`,
    title: `${displayName}として参加しますか？`,
  };
}

export function buildPlayerSwitchConfirmation(displayName: string) {
  return {
    description: `変更すると、この端末では次回から${displayName}として開きます。現在のプロフィールや戦績は削除されません。`,
    title: `この端末を${displayName}に変更しますか？`,
  };
}

export function PlayerChoiceList({
  actionLabel,
  confirmBeforeSubmit = false,
  confirmationKind = "join",
  intent,
  isSubmitting,
  players,
  reloadDocument = false,
}: {
  actionLabel: string;
  confirmBeforeSubmit?: boolean;
  confirmationKind?: "join" | "switch";
  intent: string;
  isSubmitting: boolean;
  players: PlayerChoice[];
  reloadDocument?: boolean;
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerChoice | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!confirmBeforeSubmit) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (selectedPlayer && !dialog.open) {
      dialog.showModal();
    } else if (!selectedPlayer && dialog.open) {
      dialog.close();
    }
  }, [confirmBeforeSubmit, selectedPlayer]);

  function closeDialog() {
    setSelectedPlayer(null);
  }

  function handleDialogClose() {
    setSelectedPlayer(null);
    triggerRef.current?.focus();
  }

  const confirmation = selectedPlayer
    ? confirmationKind === "switch"
      ? buildPlayerSwitchConfirmation(selectedPlayer.displayName)
      : buildPlayerJoinConfirmation(selectedPlayer.displayName)
    : null;

  return (
    <>
      <div className="player-choice-list">
        {players.map((player) =>
          confirmBeforeSubmit ? (
            <button
              aria-controls="player-choice-confirm-dialog"
              aria-expanded={selectedPlayer?.id === player.id}
              aria-haspopup="dialog"
              aria-label={`${player.displayName}として${actionLabel}`}
              className="player-choice-button"
              disabled={isSubmitting}
              key={player.id}
              onClick={(event) => {
                triggerRef.current = event.currentTarget;
                setSelectedPlayer(player);
              }}
              type="button"
            >
              <PlayerAvatar
                avatarUrl={player.avatarUrl}
                displayName={player.displayName}
              />
              <span>{player.displayName}</span>
              <small>{actionLabel}</small>
            </button>
          ) : (
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
          ),
        )}
      </div>

      {confirmBeforeSubmit ? (
        <dialog
          aria-describedby="player-choice-confirm-description"
          aria-labelledby="player-choice-confirm-title"
          className="app-dialog"
          id="player-choice-confirm-dialog"
          onCancel={closeDialog}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
          onClose={handleDialogClose}
          ref={dialogRef}
        >
          <div className="dialog-card">
            {selectedPlayer && confirmation ? (
              <>
                <div className="participant-identity">
                  <PlayerAvatar
                    avatarUrl={selectedPlayer.avatarUrl}
                    displayName={selectedPlayer.displayName}
                  />
                  <div>
                    <p className="eyebrow">
                      {confirmationKind === "switch" ? "DEVICE PLAYER" : "JOIN THE TABLE"}
                    </p>
                    <h2 id="player-choice-confirm-title">
                      {confirmation.title}
                    </h2>
                  </div>
                </div>
                <p id="player-choice-confirm-description">
                  {confirmation.description}
                </p>
                <div className="dialog-actions">
                  <button
                    autoFocus
                    className="button button-secondary"
                    onClick={closeDialog}
                    type="button"
                  >
                    キャンセル
                  </button>
                  <Form method="post" reloadDocument={reloadDocument}>
                    <input name="intent" type="hidden" value={intent} />
                    <input
                      name="groupPlayerId"
                      type="hidden"
                      value={selectedPlayer.id}
                    />
                    <button
                      className="button button-primary"
                      disabled={isSubmitting}
                      type="submit"
                    >
                      {isSubmitting
                        ? confirmationKind === "switch"
                          ? "変更中…"
                          : "参加中…"
                        : confirmationKind === "switch"
                          ? "変更する"
                          : "参加"}
                    </button>
                  </Form>
                </div>
              </>
            ) : null}
          </div>
        </dialog>
      ) : null}
    </>
  );
}
