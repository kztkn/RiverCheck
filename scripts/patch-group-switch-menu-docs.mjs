import { readFile, writeFile } from "node:fs/promises";

const path = "docs/requirements.md";
const source = await readFile(path, "utf8");
const before = "- 現在のグループ名は各グループ画面の共通ヘッダー、グループ切替一覧、開催リンクからのグループ招待画面へ表示する\n- 主催者はグループ設定からグループ名を変更できる。名称変更では`groups.name`だけを更新し、共有済みURLを壊さないため`public_code`は変更しない";
const after = "- 現在のグループ名は各グループ画面の共通ヘッダー、グループ切替一覧、開催リンクからのグループ招待画面へ表示する\n- 一般プレイヤーのハンバーガーメニューでは、有効な所属グループが2件以上の場合だけ「グループを切り替える」をプロフィールの直下へ表示する。1グループだけのプレイヤーには表示しない。主催者は新規グループ作成の入口を失わないよう、1グループ時も同位置に「グループを管理」を表示する\n- 主催者はグループ設定からグループ名を変更できる。名称変更では`groups.name`だけを更新し、共有済みURLを壊さないため`public_code`は変更しない";
if (!source.includes(before)) throw new Error("Expected requirements text not found");
await writeFile(path, source.replace(before, after));
