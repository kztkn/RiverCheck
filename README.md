# RiverCheck

ポーカー会の開催、結果、順位、チップ総量、会場費精算をスマートフォンから管理する Web アプリです。

React Router v8 + Cloudflare Workers + PostgreSQLで、開催作成、共有URLからの自己参加、結果入力、チップ総量検算、順位・会場費精算、結果確定、LINE用コピーまでのMVP主要フローを実装しています。

## 必要な環境

- Node.js 22.22.0 以上
- npm
- Docker / Docker Compose（ローカル PostgreSQL を使う場合）

## ローカル起動

```bash
npm install
cp .env.example .env
cp .dev.vars.example .dev.vars
```

続いて PostgreSQL を起動し、schema と seed を適用します。

```bash
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

表示された Local URL を開きます。既定の参加者向けグループTOPは `/g/river-check`、主催者画面は `/g/river-check/manage` です。MVPでは身内利用を前提に、主催者画面の認証は設けていません。

ローカル PostgreSQL を使わず Neon 等へ接続する場合は、`.env` と `.dev.vars` の `DATABASE_URL` を同じ接続 URL に変更してください。

## 環境変数

| 変数             | 使用箇所                  | 内容                                          |
| ---------------- | ------------------------- | --------------------------------------------- |
| `DATABASE_URL`   | migration / seed / Worker | PostgreSQL 接続 URL                           |
| `MVP_GROUP_NAME` | seed                      | MVP グループ表示名                            |
| `MVP_GROUP_CODE` | seed                      | 公開 URL 用コード。小文字・数字・ハイフンのみ |

`.env` は CLI の migration / seed、`.dev.vars` はローカル Worker が読みます。秘密値を Git へ追加しないでください。

## 主なコマンド

```bash
npm run dev          # ローカル開発サーバー
npm run test         # domain unit test
npm run typecheck    # Worker 型生成、route 型生成、TypeScript 検査
npm run build        # Cloudflare Workers 向け production build
npm run db:migrate   # 未適用 migration を順番に適用
npm run db:seed      # MVP グループを作成または更新
```

## Cloudflare / PostgreSQL

本番では `DATABASE_URL` secret による直接接続、または `HYPERDRIVE` binding を利用できます。アプリは Hyperdrive がある場合にその connection string を優先します。`wrangler.jsonc` へ実際の binding ID や接続 URL を直接コミットせず、環境ごとの Cloudflare 設定で管理してください。

デプロイ前および git push 前には `npm run build` を成功させてください。

## ドキュメント

- [要件](docs/requirements.md)
- [アーキテクチャ](docs/architecture.md)
- [業務ルール](docs/domain-rules.md)
- [今後の TODO](docs/TODO.md)
