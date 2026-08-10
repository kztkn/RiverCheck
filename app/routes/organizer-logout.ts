import { redirect } from "react-router";
import { clearOrganizerSessionCookie } from "@server/services/organizer-auth.server";
import type { Route } from "./+types/organizer-logout";

export function loader({ params }: Route.LoaderArgs) {
  return redirect("/g/" + params.groupCode);
}

export function action({ request, params }: Route.ActionArgs) {
  return redirect("/g/" + params.groupCode, {
    status: 303,
    headers: {
      "Set-Cookie": clearOrganizerSessionCookie(request),
    },
  });
}
