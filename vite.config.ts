import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

const isTypeGeneration = process.argv.includes("typegen");

export default defineConfig({
  build: {
    license: {
      fileName: "oss-licenses.md",
    },
    rolldownOptions: {
      output: {
        postBanner: "/* Bundled OSS licenses: /oss-licenses.md */",
      },
    },
  },
  plugins: [
    ...(isTypeGeneration
      ? []
      : [cloudflare({ viteEnvironment: { name: "ssr" } })]),
    reactRouter(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
});
