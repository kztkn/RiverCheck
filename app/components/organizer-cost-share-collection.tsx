import { useFetcher } from "react-router";
import type { GameCostShareReceipt } from "@shared-types/result";

type ReceiptActionData =
  | {
      ok: true;
      intent: "update-cost-share-receipt";
      groupPlayerId: string;
      received: boolean;
    }
  | {
      ok: false;
      intent: "update-cost-share-receipt";
      groupPlayerId: string;
      received: boolean;
      error: string;
    };

export function OrganizerCostShareCollection({
  receipts,
}: {
  receipts: GameCostShareReceipt[];
}) {
  const fetcher = useFetcher<ReceiptActionData>();
  const pendingGroupPlayerId = readPendingValue(
    fetcher.formData,
    "groupPlayerId",
  );
  const pendingReceived =
    readPendingValue(fetcher.formData, "received") === "yes";
  const visibleReceipts = receipts.map((receipt) =>
    receipt.groupPlayerId === pendingGroupPlayerId
      ? {
          ...receipt,
          receivedAt: pendingReceived ? new Date().toISOString() : null,
        }
      : receipt
  );
  const payableReceipts = visibleReceipts.filter(
    (receipt) => receipt.costShare > 0,
  );
  const receivedCount = payableReceipts.filter(
    (receipt) => receipt.receivedAt !== null,
  ).length;
  const unpaidCount = payableReceipts.length - receivedCount;
  const allReceived = payableReceipts.length > 0 && unpaidCount === 0;

  return (
    <details
      className={`cost-share-collection${allReceived ? " is-complete" : ""}`}
    >
      <summary>
        <span className="cost-share-collection-summary-copy">
          <small>ORGANIZER ONLY</small>
          <strong>会費の回収</strong>
          <span>
            {payableReceipts.length === 0
              ? "回収対象はありません"
              : allReceived
                ? "回収完了"
                : `未回収 ${unpaidCount}人`}
          </span>
        </span>
        <span className="cost-share-collection-count">
          {receivedCount} / {payableReceipts.length}人
        </span>
      </summary>

      <div className="cost-share-collection-body">
        <p>主催者だけに表示されます。受け取った会費をチェックしてください。</p>
        <div className="cost-share-collection-list">
          {visibleReceipts.map((receipt) => {
            const received = receipt.receivedAt !== null;
            const isPending =
              fetcher.state !== "idle" &&
              receipt.groupPlayerId === pendingGroupPlayerId;
            return (
              <div
                className="cost-share-collection-row"
                key={receipt.groupPlayerId}
              >
                <span>
                  <strong>{receipt.displayName}</strong>
                  <small>{receipt.costShare.toLocaleString("ja-JP")}円</small>
                </span>
                {receipt.costShare === 0 ? (
                  <span className="cost-share-collection-exempt">対象外</span>
                ) : (
                  <fetcher.Form method="post">
                    <input
                      name="intent"
                      type="hidden"
                      value="update-cost-share-receipt"
                    />
                    <input
                      name="groupPlayerId"
                      type="hidden"
                      value={receipt.groupPlayerId}
                    />
                    <input
                      name="received"
                      type="hidden"
                      value={received ? "no" : "yes"}
                    />
                    <button
                      aria-label={`${receipt.displayName}を${received ? "未回収" : "受取済み"}にする`}
                      aria-pressed={received}
                      className={received ? "is-received" : ""}
                      disabled={fetcher.state !== "idle"}
                      type="submit"
                    >
                      <span aria-hidden="true">{received ? "✓" : ""}</span>
                      {isPending ? "保存中…" : received ? "受取済み" : "未回収"}
                    </button>
                  </fetcher.Form>
                )}
              </div>
            );
          })}
        </div>
        {fetcher.data?.ok === false ? (
          <p className="error-notice" role="alert">{fetcher.data.error}</p>
        ) : null}
      </div>
    </details>
  );
}

function readPendingValue(formData: FormData | undefined, name: string) {
  const value = formData?.get(name);
  return typeof value === "string" ? value : null;
}
