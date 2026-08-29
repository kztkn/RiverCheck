import { findGroupByPublicCode } from "@server/repositories/group-repository.server";
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
