import { useEffect, useRef, useState } from "react";
import { Form, useNavigation } from "react-router";
import { PLAYER_DISPLAY_NAME_MAX_LENGTH } from "@domain/player-profile/validate-player-profile";

export function NewPlayerRegistration({
  intent,
  buttonLabel,
  defaultValue = "",
  error,
  reloadDocument = true,
  noValidate = false,
}: {
  intent: "join-new" | "create-player";
  buttonLabel: string;
  defaultValue?: string;
  error?: string | null;
  reloadDocument?: boolean;
  noValidate?: boolean;
}) {
  const navigation = useNavigation();
  const submittingRef = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const busy = submitting || navigation.state !== "idle";

  useEffect(() => {
    if (navigation.state !== "idle") return;
    submittingRef.current = false;
    setSubmitting(false);
  }, [navigation.state]);

  useEffect(() => {
    function restoreOnBackNavigation(event: PageTransitionEvent) {
      if (!event.persisted) return;
      submittingRef.current = false;
      setSubmitting(false);
      if (buttonRef.current) {
        buttonRef.current.disabled = false;
        buttonRef.current.textContent = buttonLabel;
      }
    }
    window.addEventListener("pageshow", restoreOnBackNavigation);
    return () => window.removeEventListener("pageshow", restoreOnBackNavigation);
  }, [buttonLabel]);

  return (
    <section className="player-selection-create new-player-registration">
      <div>
        <h2>はじめて参加する方</h2>
        <p className="muted-copy">名前を入力して参加できます。</p>
      </div>
      {error ? <p className="error-notice" role="alert">{error}</p> : null}
      <Form
        className="new-player-form"
        method="post"
        noValidate={noValidate}
        onSubmit={(event) => {
          if (submittingRef.current) {
            event.preventDefault();
            return;
          }
          submittingRef.current = true;
          setSubmitting(true);
          // A native POST may navigate before React gets a chance to paint.
          if (buttonRef.current) {
            buttonRef.current.textContent = "登録中…";
            buttonRef.current.disabled = true;
          }
        }}
        reloadDocument={reloadDocument}
      >
        <input name="intent" type="hidden" value={intent} />
        <label className="field">
          <span className="field-label">表示名</span>
          <input
            defaultValue={defaultValue}
            maxLength={PLAYER_DISPLAY_NAME_MAX_LENGTH}
            name="displayName"
            placeholder="例：プレイヤー"
            required
          />
          <span className="field-hint">最大{PLAYER_DISPLAY_NAME_MAX_LENGTH}文字</span>
        </label>
        <button
          className="button button-primary"
          disabled={busy}
          ref={buttonRef}
          type="submit"
        >
          {busy ? "登録中…" : buttonLabel}
        </button>
      </Form>
    </section>
  );
}
