import { useEffect, useState } from "react";
import { IconX } from "@tabler/icons-react";
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
  collapsible = false,
  error,
  intent = "save-paypay-link",
  intro,
  isSubmitting,
  link,
  registeredAt,
  recipientName,
  value,
}: {
  actionUrl: string;
  cancelUrl: string;
  collapsible?: boolean;
  error: string | null;
  intent?: string;
  intro?: string;
  isSubmitting: boolean;
  link: string | null;
  registeredAt: string | null;
  recipientName?: string | null;
  value: string | null;
}) {
  const submittedValue = value ?? link ?? "";
  const [linkValue, setLinkValue] = useState(submittedValue);
  const active = isPayPayLinkActive({ link, registeredAt });
  const expiresAt = registeredAt
    ? getPayPayLinkExpiresAt(registeredAt)
    : null;

  useEffect(() => {
    setLinkValue(submittedValue);
  }, [submittedValue]);

  const summary =
    registeredAt && !active
      ? "期限切れ"
      : link
        ? `有効${recipientName ? `・${recipientName}` : ""}`
        : "未設定";

  const editorBody = (
    <>
      {!collapsible ? (
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
      ) : null}
      <p className="paypay-link-intro">
        {intro ?? "グループの新規開催へ初期値としてコピーします。"}
        登録から{PAYPAY_LINK_VALIDITY_DAYS}日間だけ表示されます。
      </p>
      {link ? (
        <p className="paypay-link-recipient">
          現在の送金先：<strong>{recipientName ?? "受取人未設定"}</strong>
        </p>
      ) : null}

      <Form
        action={actionUrl}
        className="paypay-link-form"
        method="post"
        noValidate
        reloadDocument
      >
        <input name="intent" type="hidden" value={intent} />
        <label className="field">
          <span className="field-label">PayPay受取リンク</span>
          <span className="paypay-link-input-wrap">
            <input
              aria-invalid={error ? true : undefined}
              autoCapitalize="none"
              autoCorrect="off"
              inputMode="url"
              maxLength={PAYPAY_LINK_MAX_LENGTH}
              name="payPayRecipientLink"
              onChange={(event) => setLinkValue(event.currentTarget.value)}
              placeholder="https://..."
              spellCheck={false}
              type="url"
              value={linkValue}
            />
            {linkValue ? (
              <button
                aria-label="PayPay受取リンクをクリア"
                className="paypay-link-clear"
                onClick={() => setLinkValue("")}
                type="button"
              >
                <IconX aria-hidden="true" />
              </button>
            ) : null}
          </span>
          <span className="field-hint">
            ×は入力欄を空にするだけです。空欄のまま保存するとリンクを削除します。
            同じリンクの再保存では期限を延長しません。
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
    </>
  );

  if (!collapsible) {
    return <section className="paypay-link-editor">{editorBody}</section>;
  }

  return (
    <details
      className="paypay-link-editor paypay-link-disclosure"
      open={error ? true : undefined}
    >
      <summary className="paypay-link-disclosure-summary">
        <span>
          <strong>PayPay受取リンク</strong>
          <small>{summary}</small>
        </span>
        <span aria-hidden="true" className="disclosure-chevron">›</span>
      </summary>
      <div className="paypay-link-disclosure-body">{editorBody}</div>
    </details>
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}
