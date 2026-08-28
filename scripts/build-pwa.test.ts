import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildPwa,
  collectBuildVersion,
  collectPrecacheEntries,
} from "./build-pwa.mjs";

const serviceWorkerTemplatePath = resolve(
  process.cwd(),
  "pwa/service-worker.template.js",
);

const temporaryDirectories: string[] = [];
const requiredFiles = [
  "favicon.svg",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-192.png",
  "icons/icon-maskable-512.png",
  "manifest.webmanifest",
  "offline.html",
];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("PWA build", () => {
  it("ビルド成果物の変更をService Workerのversionへ反映する", async () => {
    const clientDir = await createClientBuild();
    const first = await collectBuildVersion(clientDir);
    await writeFile(resolve(clientDir, "assets/app.js"), "version two");
    const second = await collectBuildVersion(clientDir);

    expect(first).not.toBe(second);
  });

  it("公開用PWAファイルだけを事前キャッシュし、動的データを含めない", async () => {
    const clientDir = await createClientBuild();
    const templatePath = resolve(clientDir, "service-worker.template.js");
    const outputPath = resolve(clientDir, "sw.js");
    await writeFile(
      templatePath,
      `const version = "__BUILD_VERSION__";
const entries = __PRECACHE_MANIFEST__;
`,
    );
    await writeFile(resolve(clientDir, "private.data"), "private route data");

    const result = await buildPwa({ clientDir, outputPath, templatePath });
    const source = await readFile(outputPath, "utf8");
    const entries = await collectPrecacheEntries(clientDir);

    expect(result.entries).toEqual(entries);
    expect(source).toContain('"/offline.html"');
    expect(source).not.toContain("private.data");
    expect(source).not.toContain("__BUILD_VERSION__");
    expect(source).not.toContain("__PRECACHE_MANIFEST__");
  });

  it("Push通知を表示し、クリック先を同一originへ制限する", async () => {
    const template = await readFile(serviceWorkerTemplatePath, "utf8");

    expect(template).toContain('self.addEventListener("push"');
    expect(template).toContain('self.addEventListener("notificationclick"');
    expect(template).toContain("showNotification");
    expect(template).toContain("url.origin === self.location.origin");
  });
});

async function createClientBuild() {
  const clientDir = await mkdtemp(resolve(tmpdir(), "rivercheck-pwa-"));
  temporaryDirectories.push(clientDir);
  await mkdir(resolve(clientDir, "assets"));
  await mkdir(resolve(clientDir, "icons"));
  await Promise.all([
    writeFile(resolve(clientDir, "assets/app.js"), "version one"),
    writeFile(resolve(clientDir, "assets/app.css"), "body {}"),
    ...requiredFiles.map((file) =>
      writeFile(resolve(clientDir, file), `fixture:${file}`),
    ),
  ]);
  return clientDir;
}
