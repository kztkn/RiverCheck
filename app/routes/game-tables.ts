import type { Route } from "./+types/game-tables";
import { changeTableManagement, getTableManagementPanel } from "@server/services/table-management-service.server";

const headers = { "Cache-Control": "private, no-store" };
export async function loader({ request, params }: Route.LoaderArgs) {
  return Response.json(await getTableManagementPanel(request, params.groupCode, params.gameId), { headers });
}
export async function action({ request, params }: Route.ActionArgs) {
  const result = await changeTableManagement(request, params.groupCode, params.gameId, await request.formData());
  return Response.json(result, { headers, status: result.ok ? 200 : 400 });
}
