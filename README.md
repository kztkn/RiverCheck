# RiverCheck

ポーカー会の開催、結果、順位、チップ総量、会費精算をスマートフォンから管理する Web アプリです。

React Router v8 + Cloudflare Workers + PostgreSQLで、開催作成、共有URLからの自己参加、結果入力、チップ総量検算、順位・会費精算、結果確定、個人戦績、開催ハイライト、本人プロフィールまでのMVP主要フローを実装しています。開催写真とプレイヤーアイコンは非公開のCloudflare R2へ保存し、Worker経由で配信します。

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

`db:migrate` と `db:seed` は安全のためローカルDocker PostgreSQLを既定の接続先とする。`package.json` 内の固定ローカルURLを使うため、`.env` がNeon向けでも本番DBへ誤適用しない。

表示された Local URL を開きます。既定の参加者向けグループTOPは `/g/river-check`、主催者画面は `/g/river-check/manage` です。サンプル設定のローカル主催者PINは `246810` です。

`.env` の `DATABASE_URL` は `:production` 付きのmigration / seedだけが使用します。ローカルアプリは `wrangler.jsonc` の `localConnectionString` からDocker PostgreSQLへ接続します。

ローカルの開催写真・プレイヤーアイコンはWranglerがR2 bindingをローカルエミュレーションし、`.wrangler/state`へ保存します。ローカル確認だけならCloudflare上のR2 bucket作成や認証情報は不要です。

## 環境変数

| 変数             | 使用箇所                  | 内容                                          |
| ---------------- | ------------------------- | --------------------------------------------- |
| `DATABASE_URL`   | migration / seed / Worker | PostgreSQL 接続 URL                           |
| `MVP_GROUP_NAME` | seed                      | MVP グループ表示名                            |
| `MVP_GROUP_CODE` | seed                      | 公開 URL 用コード。小文字・数字・ハイフンのみ |
| `ORGANIZER_PIN` | Worker                    | 主催者画面へ入るPINまたは合言葉               |
| `ORGANIZER_SESSION_SECRET` | Worker       | 主催者Cookie署名用の32文字以上のランダム値    |

`.env` は CLI の migration / seed、`.dev.vars` はローカル Worker が読みます。秘密値を Git へ追加しないでください。

## 主なコマンド

```bash
npm run dev          # ローカル開発サーバー
npm run test         # domain unit test
npm run typecheck    # Worker 型生成、route 型生成、TypeScript 検査
npm run build        # Cloudflare Workers 向け production build
npm run db:migrate              # ローカルDocker DBへmigration
npm run db:seed                 # ローカルDocker DBへseed
npm run db:migrate:production   # .envの本番DBへmigration
npm run db:seed:production      # .envの本番DBへseed
```

## Cloudflare / PostgreSQL

本番では `DATABASE_URL` secret による直接接続、または `HYPERDRIVE` binding を利用できます。アプリは Hyperdrive がある場合にその connection string を優先します。Hyperdrive IDはbinding設定として `wrangler.jsonc` へ保存でき、Neonの接続URLとパスワードはCloudflare側から外へ出しません。

主催者画面を公開する前に、Cloudflare WorkerのSecretへ `ORGANIZER_PIN` と `ORGANIZER_SESSION_SECRET` を設定してください。後者は `openssl rand -hex 32` 等で生成した推測困難な値を使います。認証成功後は署名付きHttpOnly Cookieを180日保持し、同じ端末での再入力を省略します。

### 画像用R2（開催写真・プレイヤーアイコン）

本番デプロイ前に、Cloudflareアカウントで非公開bucketを1つ作成します。

```bash
npx wrangler r2 bucket create rivercheck-game-photos
```

`wrangler.jsonc` の `GAME_PHOTOS` bindingはこのbucket名へ設定済みです。名称は互換用ですが、開催写真とプレイヤーアイコンの両方を保存します。R2の公開アクセス（`r2.dev`、Custom Domain）は有効にしません。現在DBで参照されているobjectだけをWorkerの専用routeから返します。

本番DBへmigrationを適用してからデプロイします。

```bash
npm run db:migrate:production
npm run deploy
```

写真・アイコンの置換や参照解除ではDB参照だけを更新し、旧R2 objectは自動削除しません。参照されなくなったobjectは必要に応じてR2側で運用削除します。

### Rate Limiting

Workers Rate Limiting bindingを使用し、同一IPからのPOSTを次の単位で制限します。

- 主催者PIN入力: 5回/60秒
- 主催者の変更操作: 30回/60秒
- 参加者の参加・入力・プロフィール操作: 60回/60秒

上限超過時はWorker入口で `429 Too Many Requests` を返し、React RouterやPostgreSQLへ処理を渡しません。bindingは `wrangler.jsonc` で構成され、別途namespace作成コマンドは不要です。ローカルでは `CF-Connecting-IP` がないため、すべて `local` キーとして計数されます。

### プレイヤープロフィール

`players` にユーザーネーム、一言、アイコンメタデータを1件だけ保持し、グループごとには分けません。新しい名前で参加した端末は自動的に本人プロフィールへ紐付きます。事前登録済みメンバーは、主催者がメンバー管理から発行する7日間有効・1回限りの本人用リンクを本人へ個別共有します。本人確認後はランダムtokenのSHA-256ハッシュだけをDBへ保存し、平文tokenはHttpOnly Cookieへ1年間保持します。

アイコンはブラウザで512px正方形へ縮小し、WebPを優先します。WebP canvas変換に対応しないSafari等ではJPEGへ自動フォールバックします。Worker側でもJPEG・PNG・WebPのcontent type、シグネチャ、1MB上限を検証します。

デプロイ前および git push 前には `npm run build` を成功させてください。

## ドキュメント

- [要件](docs/requirements.md)
- [アーキテクチャ](docs/architecture.md)
- [業務ルール](docs/domain-rules.md)
- [今後の TODO](docs/TODO.md)
