import { useEffect, useRef, useState } from "react";
import { Form, useNavigation } from "react-router";
import { formatOrdinal } from "@domain/ranking/format-ordinal";
import { formatNetBb } from "@domain/score/bb-score";
import type { GameHighlight } from "@shared-types/highlight";
import type { GameResultSummary } from "@shared-types/result";
import type { PublishedGameStoryPost } from "@shared-types/game-story";
import { PlayerAvatar } from "./player-avatar";

export interface GameStoryPostView extends PublishedGameStoryPost {
  avatarUrl: string | null;
  photoUrl: string | null;
}

export function GameStories({
  highlight,
  highlightPhotoUrl,
  initialChips,
  isOrganizer,
  posts,
  results,
}: {
  highlight: GameHighlight | null;
  highlightPhotoUrl: string | null;
  initialChips: number;
  isOrganizer: boolean;
  posts: GameStoryPostView[];
  results: GameResultSummary[];
}) {
  if (!highlight?.text && !highlightPhotoUrl && posts.length === 0) return null;
  const resultByPlayer = new Map(
    results.map((result) => [result.groupPlayerId, result]),
  );
  const entries: StoryEntry[] = [
    ...(highlight?.text || highlightPhotoUrl
      ? [{
          avatarUrl: null,
          body: highlight?.text ?? null,
          createdAt:
            highlight?.updatedAt ?? highlight?.photo?.uploadedAt ?? "",
          displayName: "主催者",
          groupPlayerId: null,
          id: "organizer-story",
          participantPostId: null,
          photoUrl: highlightPhotoUrl,
        }]
      : []),
    ...posts.map((post) => ({
      avatarUrl: post.avatarUrl,
      body: post.body,
      createdAt: post.createdAt,
      displayName: post.displayName,
      groupPlayerId: post.groupPlayerId,
      id: post.id,
      participantPostId: post.id,
      photoUrl: post.photoUrl,
    })),
  ].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
  );

  return (
    <section className="game-stories-panel" aria-labelledby="game-stories-heading">
      <header className="game-stories-heading">
        <p className="form-brand-label">TABLE STORIES</p>
        <h2 id="game-stories-heading">みんなで残す、今日のテーブル</h2>
      </header>

      {entries.length > 0 ? (
        <div className="game-story-grid">
          {entries.map((entry) => {
            const result = entry.groupPlayerId
              ? resultByPlayer.get(entry.groupPlayerId)
              : null;
            return (
              <article className="game-story-card" key={entry.id}>
                {entry.photoUrl ? (
                  <figure>
                    <img
                      alt={`${entry.displayName}の投稿写真`}
                      decoding="async"
                      loading="lazy"
                      src={entry.photoUrl}
                    />
                  </figure>
                ) : null}
                <div className="game-story-card-body">
                  <header>
                    <PlayerAvatar
                      avatarUrl={entry.avatarUrl}
                      displayName={entry.displayName}
                    />
                    <div>
                      <strong>{entry.displayName}</strong>
                      {result ? (
                        <small>
                          {formatOrdinal(result.rank)} ・ {formatNetBb({
                            initialChips,
                            score: result.score,
                          })}
                        </small>
                      ) : entry.createdAt ? (
                        <small>{formatStoryTimestamp(entry.createdAt)}</small>
                      ) : null}
                    </div>
                    {isOrganizer && entry.participantPostId ? (
                      <StoryDeleteControl
                        displayName={entry.displayName}
                        postId={entry.participantPostId}
                      />
                    ) : null}
                  </header>
                  {entry.body ? <p>{entry.body}</p> : null}
                  {result && entry.createdAt ? (
                    <time dateTime={entry.createdAt}>
                      {formatStoryTimestamp(entry.createdAt)}
                    </time>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

interface StoryEntry {
  avatarUrl: string | null;
  body: string | null;
  createdAt: string;
  displayName: string;
  groupPlayerId: string | null;
  id: string;
  participantPostId: string | null;
  photoUrl: string | null;
}

function formatStoryTimestamp(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

function StoryDeleteControl({
  displayName,
  postId,
}: {
  displayName: string;
  postId: string;
}) {
  const navigation = useNavigation();
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isDeleting =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "delete-story-post" &&
    navigation.formData?.get("postId") === postId;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <>
      <button
        aria-label={`${displayName}さんの投稿を削除`}
        className="game-story-delete-trigger"
        onClick={() => setIsOpen(true)}
        ref={triggerRef}
        type="button"
      >
        …
      </button>
      <dialog
        aria-labelledby={`story-delete-title-${postId}`}
        className="app-dialog"
        onCancel={() => setIsOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setIsOpen(false);
        }}
        onClose={() => {
          setIsOpen(false);
          triggerRef.current?.focus();
        }}
        ref={dialogRef}
      >
        <div className="dialog-card">
          <span aria-hidden="true" className="dialog-danger-icon">!</span>
          <div>
            <p className="eyebrow">DELETE STORY</p>
            <h2 id={`story-delete-title-${postId}`}>投稿を削除しますか？</h2>
            <p>
              {displayName}さんの文章と写真がTABLE STORIESから削除されます。
            </p>
          </div>
          <div className="dialog-actions">
            <button
              autoFocus
              className="button button-secondary"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              キャンセル
            </button>
            <Form method="post" reloadDocument>
              <input name="intent" type="hidden" value="delete-story-post" />
              <input name="postId" type="hidden" value={postId} />
              <button
                className="button button-danger"
                disabled={isDeleting}
                type="submit"
              >
                {isDeleting ? "削除中…" : "投稿を削除"}
              </button>
            </Form>
          </div>
        </div>
      </dialog>
    </>
  );
}
