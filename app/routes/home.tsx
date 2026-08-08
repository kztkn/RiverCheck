import { redirect } from "react-router";
import type { Route } from "./+types/home";

export function loader(_: Route.LoaderArgs) {
  return redirect("/g/river-check");
}

export default function Home() {
  return null;
}
