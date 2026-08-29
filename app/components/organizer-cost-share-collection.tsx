import { useEffect, useState } from "react";
import type { FormEvent } from "react";
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
      intent?: "update-cost-share-receipt";
      groupPlayerId?: string;
      received?: boolean;
      error: string;
    };

export function OrganizerCostShareCollection({
  receipts,
}: {
  receipts: GameCostShareReceipt[];
}) {
  const pathname = typeof window === "undefined" ? "" : window.location.pathname;
  const endpoint = buildGameCostShareReceiptPath(pathname);
  const [visibleReceipts, setVisibleReceipts] = useState(receipts);
  const [pendingGroupPlayerIds, setPendingGroupPlayerIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setVisibleReceipts(receipts);
    setPendingGroupPlayerIds(new Set());
    setError(null);
  }, [receipts]);

  const payableReceipts = visibleReceipts.filter(
    (receipt) => receipt.costShare > 0,
  );
  const receivedCount = payableReceipts.filter(
    (receipt) => receipt.receivedAt !== null,
  ).length;
  const unpaidCount = payableReceipts.length - receivedCount;
  const allReceived = payableReceipts.length > 0 && unpaidCount === 0;

  function submitReceiptUpdate(
    event: FormEvent<HTMLFormElement>,
    receipt: GameCostShareReceipt,
  ) {
    if (!endpoint) return;
    event.preventDefault();
    if (pendingGroupPlayerIds.has(receipt.groupPlayerId)) return;

    const previousReceivedAt = receipt.receivedAt;
    const received = previousReceivedAt === null;
    const optimisticReceivedAt = received ? new Date().toISOString() : null;

    setVisibleReceipts((current) =>
      applyGameCostShareReceiptReceivedAt(
        current,
        receipt.groupPlayerId,
        optimisticReceivedAt,
      ),
    );
    setPendingGroupPlayerIds((current) => {
      const next = new Set(current);
      next.add(receipt.groupPlayerId);
      return next;
    });
    setError(null);

    const formData = new FormData();
    formData.set("groupPlayerId", receipt.groupPlayerId);
    formData.set("received", received ? "yes" : "no");

    void fetch(endpoint, {
      method: "POST",
      body: formData,
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const data = await response.json() as ReceiptActionData;
        if (!response.ok || !data.ok) {
          throw new Error(
            data.ok
              ? "会費の回収状況を保存できませんでした。"
              : data.error,
          );
        }
      })
      .catch((saveError) => {
        console.error("Failed to save cost share receipt", saveError);
        setVisibleReceipts((current) =>
          applyGameCostShareReceiptReceivedAt(
            current,
            receipt.groupPlayerId,
            previousReceivedAt,
          ),
        );
        setError(
          saveError instanceof Error && saveError.message
            ? saveError.message
            : "会費の回収状況を保存できませんでした。時間をおいて再度お試しください。",
        );
      })
      .finally(() => {
        setPendingGroupPlayerIds((current) => {
          const next = new Set(current);
          next.delete(receipt.groupPlayerId);
          return next;
        });
      });
  }

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
            const isPending = pendingGroupPlayerIds.has(receipt.groupPlayerId);
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
                  <form
                    method="post"
                    onSubmit={(event) => submitReceiptUpdate(event, receipt)}
                  >
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
                      aria-busy={isPending}
                      aria-label={`${receipt.displayName}を${received ? "未回収" : "受取済み"}にする`}
                      aria-pressed={received}
                      className={received ? "is-received" : ""}
                      disabled={isPending}
                      type="submit"
                    >
                      <span aria-hidden="true">{received ? "✓" : ""}</span>
                      {received ? "受取済み" : "未回収"}
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
        {error ? (
          <p className="error-notice" role="alert">{error}</p>
        ) : null}
      </div>
    </details>
  );
}

export function buildGameCostShareReceiptPath(pathname: string): string | null {
  const normalized = pathname.replace(/\/$/u, "");
  return /^\/g\/[^/]+\/games\/[^/]+$/u.test(normalized)
    ? `${normalized}/cost-share-receipts`
    : null;
}

export function applyGameCostShareReceiptReceivedAt(
  receipts: GameCostShareReceipt[],
  groupPlayerId: string,
  receivedAt: string | null,
): GameCostShareReceipt[] {
  return receipts.map((receipt) =>
    receipt.groupPlayerId === groupPlayerId
      ? { ...receipt, receivedAt }
      : receipt,
  );
}
