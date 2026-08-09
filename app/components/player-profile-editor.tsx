import { useEffect, useRef, useState, type FormEvent } from "react";
import { Form, Link, useSubmit } from "react-router";
import { PlayerAvatar } from "./player-avatar";
import { FavoriteHandPicker } from "./favorite-hand-picker";
import { compressPlayerAvatar } from "~/utils/compress-player-avatar";
import {
  PLAYER_PROFILE_MESSAGE_MAX_LENGTH,
} from "@domain/player-profile/validate-player-profile";

export function PlayerProfileEditor({
  avatarUrl,
  error,
  errors,
  isSubmitting,
  profile,
  modalCloseHref,
  values,
}: {
  avatarUrl: string | null;
  error: string | null;
  errors: { favoriteCard1?: string; profileMessage?: string };
  isSubmitting: boolean;
  profile: {
    displayName: string;
    favoriteCard1: string | null;
    favoriteCard2: string | null;
    profileMessage: string | null;
  };
  modalCloseHref?: string;
  values: {
    favoriteCard1: string;
    favoriteCard2: string;
    profileMessage: string;
  } | null;
}) {
  const submit = useSubmit();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [favoriteCard1, setFavoriteCard1] = useState(
    values?.favoriteCard1 ?? profile.favoriteCard1 ?? "",
  );
  const [favoriteCard2, setFavoriteCard2] = useState(
    values?.favoriteCard2 ?? profile.favoriteCard2 ?? "",
  );

  useEffect(() => {
    if (!selectedAvatar) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedAvatar);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedAvatar]);

  async function handleAvatar(file: File | undefined) {
    if (!file) return;
    setAvatarError(null);
    setIsProcessing(true);
    try {
      const compressed = await compressPlayerAvatar(file);
      setSelectedAvatar(compressed);
      setRemoveAvatar(false);
    } catch (caught) {
      setSelectedAvatar(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setAvatarError(
        caught instanceof Error ? caught.message : "画像を処理できませんでした。",
      );
    } finally {
      setIsProcessing(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isProcessing) return;
    const formData = new FormData(event.currentTarget);
    formData.delete("avatar");
    if (selectedAvatar) formData.set("avatar", selectedAvatar);
    void submit(formData, { encType: "multipart/form-data", method: "post" });
  }

  const visibleAvatarUrl = selectedAvatar
    ? previewUrl
    : removeAvatar
      ? null
      : avatarUrl;
  const displayName = profile.displayName;

  return (
    <Form
      className="profile-editor"
      encType="multipart/form-data"
      method="post"
      noValidate
      onSubmit={handleSubmit}
    >
      <input name="removeAvatar" type="hidden" value={removeAvatar ? "yes" : "no"} />
      <input name="intent" type="hidden" value="save-profile" />
      <input name="favoriteCard1" type="hidden" value={favoriteCard1} />
      <input name="favoriteCard2" type="hidden" value={favoriteCard2} />

      {modalCloseHref ? (
        <header className="profile-editor-modal-bar">
          <Link
            aria-label="プロフィール編集を閉じる"
            className="profile-editor-modal-close"
            to={modalCloseHref}
          >
            <span aria-hidden="true">×</span>
          </Link>
          <h2>プロフィールを編集</h2>
          <button
            className="profile-editor-modal-save"
            disabled={isSubmitting || isProcessing || Boolean(avatarError)}
            type="submit"
          >
            {isProcessing ? "処理中" : isSubmitting ? "保存中" : "保存"}
          </button>
        </header>
      ) : null}

      <section className="profile-avatar-field" aria-labelledby="profile-avatar-heading">
        <div className="profile-avatar-preview">
          <PlayerAvatar
            avatarUrl={visibleAvatarUrl}
            className="player-avatar-large"
            displayName={displayName}
          />
          <div>
            <h2 id="profile-avatar-heading">アイコン</h2>
            <p>正方形に切り抜き、WebP優先（非対応時はJPEG）で圧縮します。</p>
          </div>
        </div>
        <div className="profile-avatar-actions">
          <label className="button button-secondary profile-avatar-picker">
            <span>{isProcessing ? "画像を処理中…" : "画像を選択"}</span>
            <input
              accept="image/jpeg,image/png,image/webp"
              disabled={isProcessing || isSubmitting}
              name="avatar"
              onChange={(event) => void handleAvatar(event.target.files?.[0])}
              ref={fileInputRef}
              type="file"
            />
          </label>
          {selectedAvatar ? (
            <button
              className="text-button"
              onClick={() => {
                setSelectedAvatar(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              type="button"
            >
              選択を取り消す
            </button>
          ) : avatarUrl ? (
            <button
              className="text-button danger-text"
              onClick={() => setRemoveAvatar((current) => !current)}
              type="button"
            >
              {removeAvatar ? "削除を取り消す" : "アイコンを削除"}
            </button>
          ) : null}
        </div>
        {avatarError ? <p className="field-error">{avatarError}</p> : null}
      </section>

      <label className="field" htmlFor="profileMessage">
        <span className="field-label">一言メッセージ</span>
        <textarea
          aria-invalid={Boolean(errors.profileMessage)}
          defaultValue={values?.profileMessage ?? profile.profileMessage ?? ""}
          id="profileMessage"
          maxLength={PLAYER_PROFILE_MESSAGE_MAX_LENGTH}
          name="profileMessage"
          placeholder="例：リバーまで諦めない"
          rows={3}
        />
        <span className="field-hint">最大{PLAYER_PROFILE_MESSAGE_MAX_LENGTH}文字</span>
        {errors.profileMessage ? (
          <span className="field-error">{errors.profileMessage}</span>
        ) : null}
      </label>

      <FavoriteHandPicker
        card1={favoriteCard1}
        card2={favoriteCard2}
        disabled={isSubmitting || isProcessing}
        error={errors.favoriteCard1}
        onChange={(card1, card2) => {
          setFavoriteCard1(card1);
          setFavoriteCard2(card2);
        }}
      />

      {error ? <p className="error-notice" role="alert">{error}</p> : null}
      {!modalCloseHref ? (
        <div className="profile-editor-actions">
          <button
            className="button button-primary"
            disabled={isSubmitting || isProcessing || Boolean(avatarError)}
            type="submit"
          >
            {isProcessing ? "画像を処理中…" : isSubmitting ? "保存中…" : "保存"}
          </button>
        </div>
      ) : null}
    </Form>
  );
}
