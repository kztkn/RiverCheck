import { useEffect, useRef, useState, type FormEvent } from "react";
import { Form, useSubmit } from "react-router";
import { PlayerAvatar } from "./player-avatar";
import { compressPlayerAvatar } from "~/utils/compress-player-avatar";
import {
  PLAYER_AVATAR_MAX_BYTES,
  PLAYER_DISPLAY_NAME_MAX_LENGTH,
  PLAYER_PROFILE_MESSAGE_MAX_LENGTH,
} from "@domain/player-profile/validate-player-profile";

export function PlayerProfileEditor({
  avatarUrl,
  error,
  errors,
  isSubmitting,
  profile,
  values,
}: {
  avatarUrl: string | null;
  error: string | null;
  errors: { displayName?: string; profileMessage?: string };
  isSubmitting: boolean;
  profile: {
    displayName: string;
    profileMessage: string | null;
  };
  values: { displayName: string; profileMessage: string } | null;
}) {
  const submit = useSubmit();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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
  const displayName = values?.displayName ?? profile.displayName;

  return (
    <Form
      className="profile-editor"
      encType="multipart/form-data"
      method="post"
      noValidate
      onSubmit={handleSubmit}
    >
      <input name="removeAvatar" type="hidden" value={removeAvatar ? "yes" : "no"} />

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
        <p className="field-hint">
          JPEG・PNG・WebP。512×512px、圧縮後上限
          {Math.round(PLAYER_AVATAR_MAX_BYTES / 1024 / 1024)}MB。
        </p>
        {avatarError ? <p className="field-error">{avatarError}</p> : null}
      </section>

      <label className="field" htmlFor="profileDisplayName">
        <span className="field-label">ユーザーネーム</span>
        <input
          aria-invalid={Boolean(errors.displayName)}
          defaultValue={displayName}
          id="profileDisplayName"
          maxLength={PLAYER_DISPLAY_NAME_MAX_LENGTH}
          name="displayName"
          required
        />
        {errors.displayName ? (
          <span className="field-error">{errors.displayName}</span>
        ) : null}
      </label>

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

      {error ? <p className="error-notice" role="alert">{error}</p> : null}
      <button
        className="button button-primary"
        disabled={isSubmitting || isProcessing || Boolean(avatarError)}
        type="submit"
      >
        {isProcessing ? "画像を処理中…" : isSubmitting ? "保存中…" : "プロフィールを保存"}
      </button>
    </Form>
  );
}
