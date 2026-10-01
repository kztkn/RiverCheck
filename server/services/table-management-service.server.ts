import { findGameForGroup } from "@server/repositories/game-repository.server";
import { findGroupByPublicCode } from "@server/repositories/group-repository.server";
import { readTableManagement, startTableManagement, moveTableParticipant } from "@server/repositories/table-management-repository.server";
import { getGameManagementActor, requireGameManager } from "@server/services/game-authorization-service.server";
import type { TableManagementPanel, TablePosition } from "@shared-types/table-management";

export async function getTableManagementPanel(request: Request, groupCode: string, gameId: string): Promise<TableManagementPanel> {
  const { group, game } = await requireContext(groupCode, gameId);
  const [actor, panel] = await Promise.all([
    getGameManagementActor(request, game), readTableManagement(group.id, gameId),
  ]);
  if (!panel) throw new Response("Not found", { status: 404 });
  return { ...panel, canManage: actor !== null && game.status === "open",
    participants: panel.startedAt || actor ? panel.participants : [] };
}

export async function changeTableManagement(request: Request, groupCode: string, gameId: string, form: FormData) {
  const { group, game } = await requireContext(groupCode, gameId);
  const actor = await requireGameManager(request, game);
  if (game.status !== "open") return failure("開催中だけ卓を変更できます。");
  const intent = form.get("intent");
  if (intent === "start") {
    const mainIds = form.getAll("mainIds");
    const subIds = form.getAll("subIds");
    if (!mainIds.every(isUuid) || !subIds.every(isUuid)) return failure("参加者を確認してください。");
    const ok = await startTableManagement({ groupId: group.id, gameId, mainIds, subIds });
    return ok ? { ok: true as const } : failure("開始できませんでした。参加者が変わった可能性があります。更新してください。");
  }
  if (intent === "move") {
    const groupPlayerId = form.get("groupPlayerId");
    const commandId = form.get("commandId");
    const fromTable = form.get("fromTable");
    const toTable = form.get("toTable");
    const since = form.get("expectedSubEnteredAt");
    if (!isUuid(groupPlayerId) || !isUuid(commandId) || !isTable(fromTable) || !isTable(toTable) || fromTable === toTable ||
      (fromTable === "SUB" && (typeof since !== "string" || !Number.isFinite(Date.parse(since)))) ||
      (fromTable === "MAIN" && since !== "")) return failure("移動する参加者と卓を確認してください。");
    const ok = await moveTableParticipant({ groupId: group.id, gameId, groupPlayerId, commandId,
      fromTable, toTable, expectedSubEnteredAt: since ? String(since) : null, actorPlayerId: actor.playerId });
    return ok ? { ok: true as const } : failure("卓の状態が変わっています。更新してもう一度お試しください。");
  }
  return failure("操作を確認してください。");
}

function failure(error: string) { return { ok: false as const, error }; }
function isTable(value: unknown): value is TablePosition { return value === "MAIN" || value === "SUB"; }
function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value);
}
async function requireContext(groupCode: string, gameId: string) {
  const group = await findGroupByPublicCode(groupCode);
  if (!group) throw new Response("Not found", { status: 404 });
  const game = await findGameForGroup(group.id, gameId);
  if (!game) throw new Response("Not found", { status: 404 });
  return { group, game };
}
