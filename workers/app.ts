import { createRequestHandler } from "react-router";
import {
  renderBrowserErrorPage,
  shouldRenderBrowserErrorPage,
} from "./browser-error-page";
import { enforceWriteRateLimit } from "./rate-limit";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env) {
    const limitedResponse = await enforceWriteRateLimit(request, env);
    const response = limitedResponse ?? await requestHandler(request);
    return shouldRenderBrowserErrorPage(request, response)
      ? renderBrowserErrorPage(request, response, requestHandler)
      : response;
  },
} satisfies ExportedHandler<Cloudflare.Env>;
