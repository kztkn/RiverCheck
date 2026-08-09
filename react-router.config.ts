import type { Config } from "@react-router/dev/config";

export default {
  ...(process.env.NODE_ENV === "development"
    ? { allowedActionOrigins: ["**"] }
    : {}),
  appDirectory: "app",
  ssr: true,
} satisfies Config;
