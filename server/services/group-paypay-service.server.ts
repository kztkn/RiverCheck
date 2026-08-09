import { validatePayPayRecipientLink } from "@domain/payment/paypay-link";
import { saveGroupPayPayRecipientLinkRecord } from "@server/repositories/group-paypay-repository.server";

export async function saveGroupPayPayRecipientLink(
  groupId: string,
  rawLink: string,
): Promise<
  | { ok: true }
  | { ok: false; error: string; value: string }
> {
  const validated = validatePayPayRecipientLink(rawLink);
  if (!validated.ok) {
    return { ok: false, error: validated.error, value: rawLink };
  }
  try {
    const saved = await saveGroupPayPayRecipientLinkRecord(
      groupId,
      validated.value,
    );
    return saved
      ? { ok: true }
      : {
          ok: false,
          error: "PayPay受取リンクを保存できませんでした。画面を更新してください。",
          value: rawLink,
        };
  } catch (error) {
    console.error("Failed to save group PayPay recipient link", error);
    return {
      ok: false,
      error: "PayPay受取リンクを保存できませんでした。時間をおいて再度お試しください。",
      value: rawLink,
    };
  }
}
