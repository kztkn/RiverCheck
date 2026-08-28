import { useEffect, useRef, useState, type FormEvent } from "react";
import { IconEdit, IconPlus } from "@tabler/icons-react";
import { Form, useNavigation, useSubmit } from "react-router";
import { formatOrdinal } from "@domain/ranking/format-ordinal";
import { formatNetBb } from "@domain/score/bb-score";
import type { GameResultSummary } from "@shared-types/result";
import type {
  OwnGameStoryPost,
  PublishedGameStoryPost,
} from "@shared-types/game-story";
import { GAME_STORY_BODY_MAX_LENGTH } from "@domain/story/validate-game-story";
import { GAME_PHOTO_MAX_BYTES } from "@domain/highlight/validate-game-highlight";
import { compressGamePhoto } from "~/utils/compress-game-photo";
import { PlayerAvatar } from "./player-avatar";
import { GameTimeline } from "./game-timeline";

export interface GameStoryPostView extends PublishedGameStoryPost {
  avatarUrl: string | null;
  photoUrl: string | null;
}

export function GameStories({
  canPost,
  initialChips,
  isOrganizer,
  ownPhotoUrl,
  ownPost,
  posts,
  results,
}: {
  canPost: boolean;
  initialChips: number;
  isOrganizer: boolean;
  ownPhotoUrl: string | null;
  ownPost: OwnGameStoryPost | null;
  posts: GameStoryPostView[];
  results: GameResultSummary[];
}) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const showStories = posts.length > 0 || canPost;
  const resultByPlayer = new Map(
    results.map((result) => [result.groupPlayerId, result]),
  );
  const entries: StoryEntry[] = posts
    .map((post) => ({
      avatarUrl: post.avatarUrl,
      body: post.body,
      createdAt: post.createdAt,
      displayName: post.displayName,
      groupPlayerId: post.groupPlayerId,
      id: post.id,
      participantPostId: post.id,
      photoUrl: post.photoUrl,
    }))
    .sort(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) ||
        left.id.localeCompare(right.id),
    );

  return (
    <>
      <GameTimeline />
      {showStories ? (
        <section className="game-stories-panel" aria-labelledby="game-stories-heading">
          <header className="game-stories-heading">
            <div>
              <p className="form-brand-label">TABLE STORIES</p>
              <h2 id="game-stories-heading">みんなで残す、今日のテーブル</h2>
            </div>
            {canPost && !ownPost ? (
              <button
                aria-label="今日の記録を投稿"
                className="game-story-compose-trigger"
                onClick={() => setIsEditorOpen(true)}
                type="button"
              >
                <IconPlus aria-hidden="true" stroke={2} />
              </button>
            ) : null}
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
                        <div className="game-story-card-actions">
                          {ownPost?.id === entry.participantPostId ? (
                            <button
                              aria-label="自分の投稿を編集"
                              className="game-story-edit-trigger"
                              onClick={() => setIsEditorOpen(true)}
                              type="button"
                            >
                              <IconEdit aria-hidden="true" stroke={1.9} />
                            </button>
                          ) : null}
                          {isOrganizer && entry.participantPostId ? (
                            <StoryDeleteControl
                              displayName={entry.displayName}
                              postId={entry.participantPostId}
                            />
                          ) : null}
                        </div>
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
          {canPost && isEditorOpen ? (
            <StoryEditorDialog
              isOpen={isEditorOpen}
              onClose={() => setIsEditorOpen(false)}
              photoUrl={ownPhotoUrl}
              post={ownPost}
            />
          ) : null}
        </section>
      ) : null}
    </>
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

function StoryEditorDialog({
  isOpen,
  onClose,
  photoUrl,
  post,
}: {
  isOpen: boolean;
  onClose: () => void;
  photoUrl: string | null;
  post: OwnGameStoryPost | null;
}) {
  const navigation = useNavigation();
  const submit = useSubmit();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const isSaving =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "save-story-post";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!selectedPhoto) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(selectedPhoto);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedPhoto]);

  function resetDraft() {
    setSelectedPhoto(null);
    setRemovePhoto(false);
    setPhotoError(null);
    setIsConfirmingDelete(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function closeDialog() {
    resetDraft();
    onClose();
  }

  async function handleStoryPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoError(null);
    setIsProcessingPhoto(true);
    try {
      setSelectedPhoto(await compressGamePhoto(file));
      setRemovePhoto(false);
    } catch (error) {
      setSelectedPhoto(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setPhotoError(
        error instanceof Error ? error.message : "写真を処理できませんでした。",
      );
    } finally {
      setIsProcessingPhoto(false);
    }
  }

  function handleStorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isProcessingPhoto || photoError) return;
    const formData = new FormData(event.currentTarget);
    formData.delete("storyPhoto");
    if (selectedPhoto) formData.set("storyPhoto", selectedPhoto);
    void submit(formData, { encType: "multipart/form-data", method: "post" });
  }

  const visiblePhotoUrl = selectedPhoto
    ? previewUrl
    : removePhoto
      ? null
      : photoUrl;

  return (
    <dialog
      aria-labelledby="story-editor-title"
      className="app-dialog game-story-editor-dialog"
      onCancel={closeDialog}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
      onClose={() => {
        resetDraft();
        onClose();
      }}
      ref={dialogRef}
    >
      <div className="game-story-editor-card">
        <header>
          <div>
            <p className="form-brand-label">TABLE STORIES</p>
            <h2 id="story-editor-title">
              {post ? "自分の投稿を編集" : "今日の記録を投稿"}
            </h2>
          </div>
          <button
            aria-label="投稿画面を閉じる"
            className="dialog-close-button"
            onClick={closeDialog}
            type="button"
          >
            ×
          </button>
        </header>
        <Form
          encType="multipart/form-data"
          method="post"
          noValidate
          onSubmit={handleStorySubmit}
        >
          <input name="intent" type="hidden" value="save-story-post" />
          <input
            name="removeStoryPhoto"
            type="hidden"
            value={removePhoto ? "yes" : "no"}
          />
          <label className="field" htmlFor="storyEditorBody">
            <span className="field-label">ひとこと（任意）</span>
            <textarea
              autoFocus
              defaultValue={post?.body ?? ""}
              id="storyEditorBody"
              maxLength={GAME_STORY_BODY_MAX_LENGTH}
              name="storyBody"
              placeholder="印象に残ったハンドや、今日のひとこと"
              rows={4}
            />
            <span className="field-hint">
              最大{GAME_STORY_BODY_MAX_LENGTH}文字・保存後すぐに公開
            </span>
          </label>
          <div className="story-photo-field">
            <span className="field-label">写真（任意・1枚）</span>
            {visiblePhotoUrl ? (
              <div className="story-photo-preview">
                <img alt="投稿写真のプレビュー" src={visiblePhotoUrl} />
              </div>
            ) : (
              <div className="story-photo-empty">写真は未選択です</div>
            )}
            <label className="story-photo-picker">
              <span>{isProcessingPhoto ? "写真を圧縮中…" : "写真を選択"}</span>
              <input
                accept="image/jpeg,image/png,image/webp"
                disabled={isProcessingPhoto || isSaving}
                name="storyPhoto"
                onChange={(event) =>
                  void handleStoryPhoto(event.target.files?.[0])
                }
                ref={fileInputRef}
                type="file"
              />
            </label>
            {selectedPhoto ? (
              <button
                className="text-button"
                onClick={() => {
                  setSelectedPhoto(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                type="button"
              >
                選択を取り消す
              </button>
            ) : photoUrl ? (
              <button
                className="text-button danger-text"
                onClick={() => setRemovePhoto((current) => !current)}
                type="button"
              >
                {removePhoto ? "写真削除を取り消す" : "写真を削除"}
              </button>
            ) : null}
            <span className="field-hint">
              JPEG・PNG・WebP。自動圧縮後{formatBytes(GAME_PHOTO_MAX_BYTES)}以内
            </span>
            {photoError ? <span className="field-error">{photoError}</span> : null}
          </div>
          <div className="game-story-editor-actions">
            {post ? (
              <button
                className="text-button danger-text"
                onClick={() => setIsConfirmingDelete(true)}
                type="button"
              >
                投稿を削除
              </button>
            ) : (
              <span />
            )}
            <button
              className="button button-primary"
              disabled={isSaving || isProcessingPhoto || Boolean(photoError)}
              type="submit"
            >
              {isProcessingPhoto
                ? "写真を処理中…"
                : isSaving
                  ? "保存中…"
                  : "投稿を保存"}
            </button>
          </div>
        </Form>
        {isConfirmingDelete ? (
          <div className="game-story-delete-confirm" role="alertdialog">
            <p>文章と写真を削除しますか？</p>
            <div>
              <button
                className="button button-secondary"
                onClick={() => setIsConfirmingDelete(false)}
                type="button"
              >
                キャンセル
              </button>
              <Form method="post" reloadDocument>
                <input name="intent" type="hidden" value="save-story-post" />
                <input name="storyBody" type="hidden" value="" />
                <input name="removeStoryPhoto" type="hidden" value="yes" />
                <button className="button button-danger" type="submit">
                  削除する
                </button>
              </Form>
            </div>
          </div>
        ) : null}
      </div>
    </dialog>
  );
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toLocaleString("ja-JP", {
        maximumFractionDigits: 1,
      })}MB`
    : `${Math.ceil(bytes / 1024).toLocaleString("ja-JP")}KB`;
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
