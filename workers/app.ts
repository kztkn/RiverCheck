import { createRequestHandler } from "react-router";
import { enforceWriteRateLimit } from "./rate-limit";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env) {
    const limitedResponse = await enforceWriteRateLimit(request, env);
    return limitedResponse ?? requestHandler(request);
  },
} satisfies ExportedHandler<Cloudflare.Env>;
