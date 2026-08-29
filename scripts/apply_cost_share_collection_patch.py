from __future__ import annotations

from pathlib import Path


COMPONENT = '''import { useEffect, useState } from "react";
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
  const normalized = pathname.replace(/\\/$/u, "");
  return /^\\/g\\/[^/]+\\/games\\/[^/]+$/u.test(normalized)
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
'''

ROUTE = '''import { findGroupByPublicCode } from "@server/repositories/group-repository.server";
import { updateGameCostShareReceipt } from "@server/services/game-cost-share-receipt-service.server";
import { requireOrganizer } from "@server/services/organizer-auth.server";
import type { Route } from "./+types/game-cost-share-receipts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export async function loader() {
  return new Response(null, {
    status: 405,
    headers: { Allow: "POST", "Cache-Control": "no-store" },
  });
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireOrganizer(request, params.groupCode);
  const group = await findGroupByPublicCode(params.groupCode);
  if (!group) {
    return Response.json(
      { ok: false, error: "グループが見つかりません。" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const formData = await request.formData();
  const groupPlayerId = readString(formData, "groupPlayerId");
  const receivedValue = readString(formData, "received");
  if (
    !UUID_PATTERN.test(groupPlayerId) ||
    (receivedValue !== "yes" && receivedValue !== "no")
  ) {
    return Response.json(
      { ok: false, error: "入力内容を確認してください。" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const received = receivedValue === "yes";
  const result = await updateGameCostShareReceipt(
    group.id,
    params.gameId,
    groupPlayerId,
    received,
  );
  return Response.json(
    {
      ...result,
      intent: "update-cost-share-receipt" as const,
      groupPlayerId,
      received,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
'''

ROUTE_TEST = '''import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  findGroupByPublicCode: vi.fn(),
  requireOrganizer: vi.fn(),
  updateGameCostShareReceipt: vi.fn(),
}));

vi.mock("@server/repositories/group-repository.server", () => ({
  findGroupByPublicCode: mocked.findGroupByPublicCode,
}));
vi.mock("@server/services/organizer-auth.server", () => ({
  requireOrganizer: mocked.requireOrganizer,
}));
vi.mock("@server/services/game-cost-share-receipt-service.server", () => ({
  updateGameCostShareReceipt: mocked.updateGameCostShareReceipt,
}));

import { action } from "./game-cost-share-receipts";

const groupPlayerId = "33333333-3333-4333-8333-333333333333";
const gameId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.resetAllMocks();
  mocked.findGroupByPublicCode.mockResolvedValue({
    id: "11111111-1111-4111-8111-111111111111",
    publicCode: "river-check",
  });
  mocked.updateGameCostShareReceipt.mockResolvedValue({ ok: true });
});

describe("game cost share receipts resource route", () => {
  it("主催者の受取状態を1人単位でJSON保存する", async () => {
    const response = await action(
      actionArgs({ groupPlayerId, received: "yes" }),
    );

    expect(mocked.requireOrganizer).toHaveBeenCalledWith(
      expect.any(Request),
      "river-check",
    );
    expect(mocked.updateGameCostShareReceipt).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      gameId,
      groupPlayerId,
      true,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      intent: "update-cost-share-receipt",
      groupPlayerId,
      received: true,
    });
  });

  it("不正な対象IDはDB更新前に拒否する", async () => {
    const response = await action(
      actionArgs({ groupPlayerId: "not-a-uuid", received: "yes" }),
    );

    expect(response.status).toBe(400);
    expect(mocked.updateGameCostShareReceipt).not.toHaveBeenCalled();
  });
});

function actionArgs(values: Record<string, string>) {
  return {
    params: { gameId, groupCode: "river-check" },
    request: new Request(
      `https://example.com/g/river-check/games/${gameId}/cost-share-receipts`,
      {
        body: new URLSearchParams(values),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        method: "POST",
      },
    ),
  } as Parameters<typeof action>[0];
}
'''

UI_TEST = '''import { describe, expect, it } from "vitest";
import {
  applyGameCostShareReceiptReceivedAt,
  buildGameCostShareReceiptPath,
} from "~/components/organizer-cost-share-collection";

const receipts = [
  {
    costShare: 1_500,
    displayName: "Alice",
    groupPlayerId: "player-1",
    receivedAt: null,
  },
  {
    costShare: 1_500,
    displayName: "Bob",
    groupPlayerId: "player-2",
    receivedAt: null,
  },
];

describe("organizer cost share collection optimistic UI", () => {
  it("開催詳細から会費保存用resource routeを組み立てる", () => {
    expect(
      buildGameCostShareReceiptPath("/g/river-check/games/game-1"),
    ).toBe("/g/river-check/games/game-1/cost-share-receipts");
    expect(buildGameCostShareReceiptPath("/g/river-check")).toBeNull();
  });

  it("対象者だけを即時に受取済みへ更新できる", () => {
    const next = applyGameCostShareReceiptReceivedAt(
      receipts,
      "player-1",
      "2026-08-29T01:00:00.000Z",
    );

    expect(next[0]?.receivedAt).toBe("2026-08-29T01:00:00.000Z");
    expect(next[1]?.receivedAt).toBeNull();
  });
});
'''

root = Path(".")
(root / "app/components/organizer-cost-share-collection.tsx").write_text(COMPONENT, encoding="utf-8")
(root / "app/routes/game-cost-share-receipts.ts").write_text(ROUTE, encoding="utf-8")
(root / "app/routes/game-cost-share-receipts.test.ts").write_text(ROUTE_TEST, encoding="utf-8")
(root / "app/routes/organizer-cost-share-collection-ui.test.ts").write_text(UI_TEST, encoding="utf-8")

routes_path = root / "app/routes.ts"
routes = routes_path.read_text(encoding="utf-8")
needle = '  route("g/:groupCode/games/:gameId/timeline", "routes/game-timeline.ts"),\n'
addition = needle + '  route(\n    "g/:groupCode/games/:gameId/cost-share-receipts",\n    "routes/game-cost-share-receipts.ts",\n  ),\n'
if "cost-share-receipts" not in routes:
    routes = routes.replace(needle, addition)
routes_path.write_text(routes, encoding="utf-8")

rate_path = root / "domain/rate-limiting/classify-rate-limited-request.ts"
rate = rate_path.read_text(encoding="utf-8")
rate = rate.replace(
    'String.raw`^${GROUP_PATH}/(?:players|settings|games/(?:new|[^/]+/admin))/?$`,',
    'String.raw`^${GROUP_PATH}/(?:players|settings|games/(?:new|[^/]+/(?:admin|cost-share-receipts)))/?$`,',
)
rate_path.write_text(rate, encoding="utf-8")

rate_test_path = root / "domain/rate-limiting/classify-rate-limited-request.test.ts"
rate_test = rate_test_path.read_text(encoding="utf-8")
marker = '''    expect(\n      classifyRateLimitedRequest(\n        "POST",\n        "/g/river-check/games/1b233730-eecd-449a-b28b-c93b0a395815/admin",\n      ),\n    ).toBe("admin-write");\n'''
extra = marker + '''    expect(\n      classifyRateLimitedRequest(\n        "POST",\n        "/g/river-check/games/1b233730-eecd-449a-b28b-c93b0a395815/cost-share-receipts",\n      ),\n    ).toBe("admin-write");\n'''
if "cost-share-receipts" not in rate_test:
    rate_test = rate_test.replace(marker, extra)
rate_test_path.write_text(rate_test, encoding="utf-8")

requirements_path = root / "docs/requirements.md"
requirements = requirements_path.read_text(encoding="utf-8")
req_needle = '- 会費負担額が1円以上の参加者を回収対象とし、主催者が参加者ごとに「未回収」と「受取済み」を切り替える。0円の参加者は対象外として表示する\n'
req_extra = req_needle + '- 受取状態の切り替えはタップ直後に画面へ反映し、参加者ごとに独立して保存する。1人の保存中も他の参加者を連続して操作でき、保存失敗時は対象者だけ直前状態へ戻してエラーを表示する\n'
if "1人の保存中も他の参加者を連続して操作" not in requirements:
    requirements = requirements.replace(req_needle, req_extra)
requirements_path.write_text(requirements, encoding="utf-8")

architecture_path = root / "docs/architecture.md"
architecture = architecture_path.read_text(encoding="utf-8")
arch_marker = '## Worker入口のRate Limiting\n'
arch_text = '''## 会費回収の即時更新\n\n確定結果画面の会費回収トグルは、表示上の受取状態と集計人数をタップ直後にOptimistic UIで更新する。保存は参加者ごとに独立したリクエストとして`/g/:groupCode/games/:gameId/cost-share-receipts`へPOSTし、同じ参加者の保存中だけ再操作を止める。他参加者の操作は並列に続けられる。resource routeは既存の会費回収serviceを呼び、結果画面のloader全体を再実行しない。保存失敗時は対象参加者の表示だけを直前状態へ戻す。JavaScript無効時は従来どおり開催詳細actionへ通常form送信できる。\n\n'''
if "## 会費回収の即時更新" not in architecture:
    architecture = architecture.replace(arch_marker, arch_text + arch_marker)
architecture_path.write_text(architecture, encoding="utf-8")

print("Cost share collection optimistic patch applied")
