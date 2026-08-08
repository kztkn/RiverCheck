import { useEffect, useRef, useState, type FormEvent } from "react";
import { Form, useSubmit } from "react-router";
import { compressGamePhoto } from "~/utils/compress-game-photo";
import {
  GAME_PHOTO_MAX_BYTES,
  HIGHLIGHT_TEXT_MAX_LENGTH,
} from "@domain/highlight/validate-game-highlight";
import type { GameHighlight } from "@shared-types/highlight";

export function GameHighlightEditor({
  error,
  highlight,
  isSubmitting,
  photoUrl,
}: {
  error: string | null;
  highlight: GameHighlight | null;
  isSubmitting: boolean;
  photoUrl: string | null;
}) {
  const submit = useSubmit();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedPhoto) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(selectedPhoto);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedPhoto]);

  async function handlePhotoChange(file: File | undefined) {
    if (!file) return;
    setPhotoError(null);
    setIsProcessingPhoto(true);
    try {
      const compressed = await compressGamePhoto(file);
      setSelectedPhoto(compressed);
      setRemovePhoto(false);
    } catch (caught) {
      setSelectedPhoto(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setPhotoError(
        caught instanceof Error ? caught.message : "写真を処理できませんでした。",
      );
    } finally {
      setIsProcessingPhoto(false);
    }
  }

  function cancelSelectedPhoto() {
    setSelectedPhoto(null);
    setPhotoError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isProcessingPhoto) return;
    const formData = new FormData(event.currentTarget);
    formData.delete("photo");
    if (selectedPhoto) formData.set("photo", selectedPhoto);
    void submit(formData, { encType: "multipart/form-data", method: "post" });
  }

  const visiblePhotoUrl = selectedPhoto
    ? previewUrl
    : removePhoto
      ? null
      : photoUrl;

  return (
    <section className="game-highlight-editor" aria-labelledby="highlight-editor-heading">
      <div>
        <p className="eyebrow">EDIT TABLE STORY</p>
        <h2 id="highlight-editor-heading">ハイライトを編集</h2>
        <p>主催者だけが編集できます。保存後は参加者の結果画面にも表示されます。</p>
      </div>

      <Form
        encType="multipart/form-data"
        method="post"
        noValidate
        onSubmit={handleSubmit}
      >
        <input name="intent" type="hidden" value="save-highlight" />
        <input
          name="removePhoto"
          type="hidden"
          value={removePhoto ? "yes" : "no"}
        />

        <label className="field" htmlFor="highlightText">
          <span className="field-label">ハイライト文</span>
          <textarea
            defaultValue={highlight?.text ?? ""}
            id="highlightText"
            maxLength={HIGHLIGHT_TEXT_MAX_LENGTH}
            name="highlightText"
            placeholder="例：終盤のオールインを制して逆転優勝。初参加メンバーも最後まで健闘しました。"
            rows={6}
          />
          <span className="field-hint">最大{HIGHLIGHT_TEXT_MAX_LENGTH}文字・プレーンテキスト</span>
        </label>

        <div className="highlight-photo-field">
          <span className="field-label">開催写真</span>
          {visiblePhotoUrl ? (
            <div className="highlight-photo-preview">
              <img alt="開催写真のプレビュー" src={visiblePhotoUrl} />
            </div>
          ) : (
            <div className="highlight-photo-empty">写真は未登録です</div>
          )}

          <label className="highlight-file-picker">
            <span>{isProcessingPhoto ? "写真を圧縮中…" : "写真を選択"}</span>
            <input
              accept="image/jpeg,image/png,image/webp"
              disabled={isProcessingPhoto || isSubmitting}
              name="photo"
              onChange={(event) => void handlePhotoChange(event.target.files?.[0])}
              ref={fileInputRef}
              type="file"
            />
          </label>

          {selectedPhoto ? (
            <div className="highlight-photo-selection">
              <span>
                WebP・{formatBytes(selectedPhoto.size)}へ圧縮しました
              </span>
              <button onClick={cancelSelectedPhoto} type="button">
                選択を取り消す
              </button>
            </div>
          ) : photoUrl ? (
            <button
              className="highlight-photo-delete"
              onClick={() => setRemovePhoto((current) => !current)}
              type="button"
            >
              {removePhoto ? "写真を外す操作を取り消す" : "この開催から写真を外す"}
            </button>
          ) : null}

          <p className="field-hint">
            JPEG・PNG・WebP。長辺1,800px、WebPへ自動圧縮します。圧縮後上限
            {formatBytes(GAME_PHOTO_MAX_BYTES)}。
          </p>
          {photoError ? <p className="field-error">{photoError}</p> : null}
        </div>

        {error ? (
          <p className="error-notice highlight-save-error" role="alert">
            {error}
          </p>
        ) : null}

        <button
          className="button button-primary"
          disabled={isSubmitting || isProcessingPhoto || Boolean(photoError)}
          type="submit"
        >
          {isProcessingPhoto
            ? "写真を処理中…"
            : isSubmitting
              ? "保存中…"
              : "ハイライトを保存"}
        </button>
      </Form>
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toLocaleString("ja-JP", {
      maximumFractionDigits: 1,
    })}MB`;
  }
  return `${Math.ceil(bytes / 1024).toLocaleString("ja-JP")}KB`;
}
