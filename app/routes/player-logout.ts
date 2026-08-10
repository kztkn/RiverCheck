import { redirect } from "react-router";
import { clearPlayerProfileCookie } from "@server/services/player-profile-session.server";
import type { Route } from "./+types/player-logout";

export function loader({ params }: Route.LoaderArgs) {
  return redirect("/g/" + params.groupCode);
}

export function action({ request, params }: Route.ActionArgs) {
  return redirect("/g/" + params.groupCode, {
    status: 303,
    headers: {
      "Set-Cookie": clearPlayerProfileCookie(request),
    },
  });
}
