import { AppErrorPage } from "~/components/error-page";
import type { Route } from "./+types/error";

export function loader({ request }: Route.LoaderArgs) {
  const requestedStatus = Number(
    new URL(request.url).searchParams.get("status"),
  );
  return {
    status:
      Number.isInteger(requestedStatus) &&
        requestedStatus >= 400 &&
        requestedStatus <= 599
        ? requestedStatus
        : 500,
  };
}

export default function ErrorRoute({ loaderData }: Route.ComponentProps) {
  return <AppErrorPage status={loaderData.status} />;
}
