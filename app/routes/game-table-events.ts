import type { Route } from "./+types/game-table-events";
import {
  cancelRecordedTableEvent,
  getTableEventPanel,
  recordTableEvent,
} from "@server/services/table-event-service.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const panel = await getTableEventPanel(request, params.groupCode, params.gameId);
  return Response.json(panel, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = readString(formData, "intent");

  if (intent === "cancel") {
    const eventId = readString(formData, "eventId");
    if (!isUuid(eventId)) {
      return Response.json({ ok: false, error: "テーブルイベントを確認できません。" }, { status: 400 });
    }
    const result = await cancelRecordedTableEvent(
      request,
      params.groupCode,
      params.gameId,
      eventId,
    );
    return Response.json(result, { status: result.ok ? 200 : 400 });
  }

  const commandId = readString(formData, "commandId");
  if (!isUuid(commandId)) {
    return Response.json({ ok: false, error: "記録IDを確認できません。" }, { status: 400 });
  }

  if (intent === "seven-deuce") {
    const subjectGroupPlayerId = readString(formData, "subjectGroupPlayerId");
    if (!isUuid(subjectGroupPlayerId)) {
      return Response.json({ ok: false, error: "達成者を選んでください。" }, { status: 400 });
    }
    const result = await recordTableEvent(request, params.groupCode, params.gameId, {
      type: "seven_deuce",
      commandId,
      subjectGroupPlayerId,
    });
    return Response.json(result, { status: result.ok ? 200 : 400 });
  }

  if (intent === "bomb-pot") {
    const result = await recordTableEvent(request, params.groupCode, params.gameId, {
      type: "bomb_pot",
      commandId,
    });
    return Response.json(result, { status: result.ok ? 200 : 400 });
  }

  if (intent === "all-in") {
    const participantIds = formData
      .getAll("participantIds")
      .filter((value): value is string => typeof value === "string" && isUuid(value));
    const winnerIds = formData
      .getAll("winnerIds")
      .filter((value): value is string => typeof value === "string" && isUuid(value));
    const result = await recordTableEvent(request, params.groupCode, params.gameId, {
      type: "all_in",
      commandId,
      participantIds,
      winnerIds,
    });
    return Response.json(result, { status: result.ok ? 200 : 400 });
  }

  return Response.json({ ok: false, error: "Unknown action" }, { status: 400 });
}

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
