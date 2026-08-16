import { Form, Link } from "react-router";
import {
  getPayPayLinkExpiresAt,
  isPayPayLinkActive,
  PAYPAY_LINK_MAX_LENGTH,
  PAYPAY_LINK_VALIDITY_DAYS,
} from "@domain/payment/paypay-link";

export function PayPayLinkEditor({
  actionUrl,
  cancelUrl,
  error,
  isSubmitting,
  link,
  registeredAt,
  value,
}: {
  actionUrl: string;
  cancelUrl: string;
  error: string | null;
  isSubmitting: boolean;
  link: string | null;
  registeredAt: string | null;
  value: string | null;
}) {
  const active = isPayPayLinkActive({ link, registeredAt });
  const expiresAt = registeredAt
    ? getPayPayLinkExpiresAt(registeredAt)
    : null;

  return (
    <section className="paypay-link-editor">
      <div className="paypay-link-heading">
        <div>
          <p className="eyebrow">PAYPAY</p>
          <h2>受取リンク</h2>
        </div>
        {registeredAt ? (
          <span className={`paypay-link-status ${active ? "is-active" : "is-expired"}`}>
            {active ? "有効" : "期限切れ"}
          </span>
        ) : null}
      </div>
      <p className="paypay-link-intro">
        グループ内すべての結果画面で使用します。登録から{PAYPAY_LINK_VALIDITY_DAYS}日間だけ表示されます。
      </p>

      <Form
        action={actionUrl}
        className="paypay-link-form"
        method="post"
        noValidate
        reloadDocument
      >
        <input name="intent" type="hidden" value="save-paypay-link" />
        <label className="field">
          <span className="field-label">PayPay受取リンク</span>
          <input
            aria-invalid={error ? true : undefined}
            autoCapitalize="none"
            autoCorrect="off"
            defaultValue={value ?? link ?? ""}
            inputMode="url"
            maxLength={PAYPAY_LINK_MAX_LENGTH}
            name="payPayRecipientLink"
            placeholder="https://..."
            spellCheck={false}
            type="url"
          />
          <span className="field-hint">
            空欄で保存するとリンクを削除します。同じリンクの再保存では期限を延長しません。
          </span>
        </label>

        {registeredAt && expiresAt ? (
          <dl className="paypay-link-dates">
            <div>
              <dt>登録</dt>
              <dd>{formatDateTime(registeredAt)}</dd>
            </div>
            <div>
              <dt>表示期限</dt>
              <dd>{formatDateTime(expiresAt)}</dd>
            </div>
          </dl>
        ) : null}

        {error ? <p className="error-notice" role="alert">{error}</p> : null}

        <div className="paypay-link-actions">
          <Link className="button button-secondary" reloadDocument to={cancelUrl}>
            戻る
          </Link>
          <button className="button button-primary" disabled={isSubmitting} type="submit">
            {isSubmitting ? "保存中…" : "保存"}
          </button>
        </div>
      </Form>
    </section>
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}
