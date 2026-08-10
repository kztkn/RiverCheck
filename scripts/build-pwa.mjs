import { createHash } from "node:crypto";
import { access, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultClientDir = resolve(projectRoot, "build/client");
const defaultTemplatePath = resolve(
  projectRoot,
  "pwa/service-worker.template.js",
);
const defaultOutputPath = resolve(defaultClientDir, "sw.js");
/** @typedef {{ revision: string, url: string }} PrecacheEntry */

const precacheFiles = [
  "favicon.svg",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-192.png",
  "icons/icon-maskable-512.png",
  "manifest.webmanifest",
  "offline.html",
];

/**
 * @param {string} clientDir
 * @returns {Promise<string>}
 */
export async function collectBuildVersion(clientDir) {
  const assetDir = resolve(clientDir, "assets");
  const files = (await listFiles(assetDir))
    .filter((file) => /\.(?:css|js)$/u.test(file))
    .sort();
  if (files.length === 0) {
    throw new Error(`PWA build assets were not found in ${assetDir}`);
  }

  const hash = createHash("sha256");
  for (const file of files) {
    const path = resolve(assetDir, file);
    hash.update(`assets/${file}\0`);
    hash.update(await readFile(path));
  }
  return hash.digest("hex").slice(0, 16);
}

/**
 * @param {string} clientDir
 * @returns {Promise<PrecacheEntry[]>}
 */
export async function collectPrecacheEntries(clientDir) {
  return Promise.all(
    precacheFiles.map(async (file) => {
      const path = resolve(clientDir, file);
      await access(path);
      return {
        revision: createHash("sha256")
          .update(await readFile(path))
          .digest("hex")
          .slice(0, 16),
        url: `/${file}`,
      };
    }),
  );
}

/**
 * @param {string} template
 * @param {{ buildVersion: string, entries: PrecacheEntry[] }} options
 */
export function renderServiceWorker(template, { buildVersion, entries }) {
  if (!template.includes("__BUILD_VERSION__")) {
    throw new Error("Service Worker template is missing __BUILD_VERSION__");
  }
  if (!template.includes("__PRECACHE_MANIFEST__")) {
    throw new Error("Service Worker template is missing __PRECACHE_MANIFEST__");
  }
  return template
    .replace("__BUILD_VERSION__", buildVersion)
    .replace("__PRECACHE_MANIFEST__", JSON.stringify(entries, null, 2));
}

/**
 * @param {{ clientDir?: string, outputPath?: string, templatePath?: string }} [options]
 */
export async function buildPwa({
  clientDir = defaultClientDir,
  outputPath = defaultOutputPath,
  templatePath = defaultTemplatePath,
} = {}) {
  const [buildVersion, entries, template] = await Promise.all([
    collectBuildVersion(clientDir),
    collectPrecacheEntries(clientDir),
    readFile(templatePath, "utf8"),
  ]);
  const source = renderServiceWorker(template, { buildVersion, entries });
  await writeFile(outputPath, source);
  return { buildVersion, entries, outputPath };
}

/**
 * @param {string} directory
 * @returns {Promise<string[]>}
 */
async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      for (const child of await listFiles(path)) {
        files.push(
          `${entry.name}/${child}`.split(sep).join("/"),
        );
      }
    } else if (entry.isFile()) {
      files.push(entry.name);
    }
  }
  return files;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildPwa();
  console.log(
    `PWA Service Worker生成OK（version ${result.buildVersion}, precache ${result.entries.length}件）`,
  );
}
