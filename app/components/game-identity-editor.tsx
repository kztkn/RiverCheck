import { Form, Link } from "react-router";
import { GAME_TITLE_MAX_LENGTH } from "@domain/game/game-title";

export function GameIdentityEditor({
  actionUrl,
  cancelUrl,
  error,
  errors,
  isSubmitting,
  values,
}: {
  actionUrl: string;
  cancelUrl: string;
  error: string | null;
  errors: { title?: string; playedAt?: string };
  isSubmitting: boolean;
  values: { title: string; playedAt: string };
}) {
  return (
    <section className="result-correction-panel game-identity-editor">
      <div className="section-heading">
        <div>
          <h2>GAME DETAILS</h2>
        </div>
      </div>
      <p className="correction-intro">
        開催名または開催日だけを変更できます。結果は変更されません。
      </p>

      <Form
        action={actionUrl}
        className="correction-form"
        method="post"
        noValidate
        reloadDocument
      >
        <input name="intent" type="hidden" value="save-game-identity" />
        <fieldset className="correction-game-details">
          <legend>GAME INFO</legend>
          <label className="field">
            <span className="field-label">開催名</span>
            <input
              aria-invalid={errors.title ? true : undefined}
              defaultValue={values.title}
              maxLength={GAME_TITLE_MAX_LENGTH}
              name="title"
              required
            />
            {errors.title ? <span className="field-error">{errors.title}</span> : null}
          </label>
          <label className="field">
            <span className="field-label">開催日</span>
            <input
              aria-invalid={errors.playedAt ? true : undefined}
              defaultValue={values.playedAt}
              name="playedAt"
              required
              type="date"
            />
            {errors.playedAt ? (
              <span className="field-error">{errors.playedAt}</span>
            ) : null}
          </label>
        </fieldset>

        {error ? (
          <p className="finalize-error" role="alert">
            <span aria-hidden="true">!</span>
            {error}
          </p>
        ) : null}

        <div className="correction-actions">
          <Link className="button button-secondary" reloadDocument to={cancelUrl}>
            Cancel
          </Link>
          <button className="button button-primary" disabled={isSubmitting} type="submit">
            {isSubmitting ? "保存中…" : "Save"}
          </button>
        </div>
      </Form>
    </section>
  );
}
