import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const approvedLicenses = new Set([
  "0BSD",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "MIT",
  "MIT AND ISC",
  "Unlicense",
]);

const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const dependencies = [];
const violations = [];

for (const [packagePath, lockPackage] of Object.entries(lock.packages ?? {})) {
  if (!packagePath.startsWith("node_modules/") || lockPackage.dev === true) {
    continue;
  }

  let packageJson;
  try {
    packageJson = JSON.parse(
      readFileSync(resolve(packagePath, "package.json"), "utf8"),
    );
  } catch {
    violations.push(`${packagePath}: package.jsonを確認できません`);
    continue;
  }

  const name = packageJson.name ?? packagePath;
  const version = packageJson.version ?? lockPackage.version ?? "unknown";
  const license = packageJson.license ?? lockPackage.license ?? "UNKNOWN";
  dependencies.push({ license, name, version });

  if (!approvedLicenses.has(license)) {
    violations.push(`${name}@${version}: ${license}`);
  }
}

if (violations.length > 0) {
  console.error("承認されていない本番依存ライセンスがあります:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error("依存追加を止め、利用条件を確認して許可リストを更新してください。");
  process.exit(1);
}

const licenseCounts = new Map();
for (const dependency of dependencies) {
  licenseCounts.set(
    dependency.license,
    (licenseCounts.get(dependency.license) ?? 0) + 1,
  );
}

const summary = [...licenseCounts.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([license, count]) => `${license}: ${count}`)
  .join(", ");

console.log(`OSSライセンス検査OK（本番依存${dependencies.length}件）`);
console.log(summary);
