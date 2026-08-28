# RiverCheck

ポーカー会の開催、結果、順位、チップ総量、会費精算をスマートフォンから管理する Web アプリです。

React Router v8 + Cloudflare Workers + PostgreSQLで、開催作成、共有URLからの自己参加、結果入力、チップ総量検算、順位・会費精算、結果確定、主催者用の会費回収確認、ランキング、TABLE STORIES、本人プロフィールまでのMVP主要フローを実装しています。投稿写真とプレイヤーアイコンは非公開のCloudflare R2へ保存し、Worker経由で配信します。

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
| `WEB_PUSH_VAPID_PUBLIC_KEY` | Worker       | Web Push購読に使うVAPID公開鍵                  |
| `WEB_PUSH_VAPID_PRIVATE_JWK` | Worker      | Web Push署名に使うVAPID秘密JWK                 |
| `WEB_PUSH_VAPID_SUBJECT` | Worker          | `mailto:`またはHTTPSの運営者連絡先             |

`.env` は CLI の migration / seed、`.dev.vars` はローカル Worker が読みます。秘密値を Git へ追加しないでください。

## 主なコマンド

```bash
npm run dev          # ローカル開発サーバー
npm run test         # domain unit test
npm run typecheck    # Worker 型生成、route 型生成、TypeScript 検査
npm run build        # OSSライセンス検査 + Cloudflare Workers向けproduction build
npm run release:build # CI検証・build・本番migrationを順番に実行
npm run license:check # 本番依存のOSSライセンス許可リスト検査
npm run pwa:icons    # PWA用PNGアイコンを再生成
npm run pwa:build    # build/clientへService Workerを生成
npm run db:migrate              # ローカルDocker DBへmigration
npm run db:seed                 # ローカルDocker DBへseed
npm run db:migrate:production   # .envの本番DBへmigration
npm run db:seed:production      # .envの本番DBへseed
```

## PWA

production buildでは、Web App Manifest、通常・maskable・Apple用アイコン、オフライン案内とService Workerを`build/client`へ出力します。Service Workerはビルド済みJS/CSSの内容からversionを自動生成するため、通常の画面や機能追加でPWA設定を更新する必要はありません。

Service WorkerがCache Storageへ保存するのは、PWAの公開アセットと利用済みの`/assets/`配下だけです。HTML、React Routerの`.data`、参加状況、結果、プロフィール、POST responseは保存しません。オフライン時の参加・入力は行わず、接続案内を表示します。新しいversionは自動検出しますが、入力途中の強制再読込を避けるため、利用者が通知の「更新する」を押したときだけ切り替えます。

`npm run dev`では既存Service Workerとの混線を避けるため登録しません。PWA確認は`npm run build`後のpreviewまたは本番HTTPSで行い、ブラウザのApplication/Storage画面で過去のlocalhost用Service Workerがあれば解除してください。

### 開催通知

本人プロフィールの「開催通知」をONにすると、ブラウザが発行したWeb Push購読情報をplayerごとに1件保存します。別端末でONにした場合は最新端末へ置き換わります。新規開催の作成後、通知ONの有効メンバーへ開催名・開催日を通知し、通知タップで参加画面を開きます。iPhone・iPadはホーム画面へ追加したRiverCheckから設定してください。

初回だけVAPID鍵を生成します。出力される秘密JWKはGitやチャットへ貼らず、Cloudflare Secretへ直接設定してください。

```bash
npx @pushforge/builder vapid
npx wrangler secret put WEB_PUSH_VAPID_PUBLIC_KEY
npx wrangler secret put WEB_PUSH_VAPID_PRIVATE_JWK
npx wrangler secret put WEB_PUSH_VAPID_SUBJECT
```

`WEB_PUSH_VAPID_SUBJECT`には運営者の`mailto:`アドレス、またはRiverCheckのHTTPS URLを設定します。3項目のいずれかが未設定・不正な場合、プロフィールでは準備中と表示し、開催作成は通常どおり続行します。購読情報とendpointは秘密値に準じて扱い、ログへ出しません。

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

### main push時のmigration

Cloudflare Workers Buildsでは、次の設定にするとmainへのpushを契機に、検証、production build、本番migration、Worker deployの順で実行できます。

```text
Build command:  npm run release:build
Deploy command: npx wrangler deploy
Build secret:   DATABASE_URL=<本番PostgreSQLの直接接続URL>
```

Build secretはWorker runtimeのSecretとは別にCloudflare Buildsへ登録します。schema変更にはHyperdriveではなく、migration実行用の直接接続URLを使用します。`release:build`は`typecheck`、全テスト、`build`が成功した場合だけ`db:migrate:production`へ進みます。migration runnerは`schema_migrations`で適用済みファイルをスキップし、PostgreSQLのsession-level advisory lockで並行実行を直列化します。

この自動経路へ含めるmigrationは、旧Workerと新Workerのどちらからも利用できる追加的・後方互換な変更に限定します。カラム削除、rename、型の破壊的変更は自動migrationへ直接含めず、利用停止を先にデプロイしてから後続リリースで適用します。Cloudflare Buildsを設定するまでは、上記の手動コマンドを使用します。

写真・アイコンの置換や参照解除ではDB参照だけを更新し、旧R2 objectは自動削除しません。参照されなくなったobjectは必要に応じてR2側で運用削除します。

### Rate Limiting

Workers Rate Limiting bindingを使用し、同一IPからのPOSTを次の単位で制限します。

- 主催者PIN入力: 5回/60秒
- 主催者の変更操作: 30回/60秒
- 参加者の参加・入力・プロフィール操作: 60回/60秒

上限超過時はWorker入口で `429 Too Many Requests` を返し、React RouterやPostgreSQLへ処理を渡しません。bindingは `wrangler.jsonc` で構成され、別途namespace作成コマンドは不要です。ローカルでは `CF-Connecting-IP` がないため、すべて `local` キーとして計数されます。

### プレイヤープロフィール

`players` にユーザーネーム、一言、アイコンメタデータを1件だけ保持し、グループごとには分けません。新しい名前で参加した端末は自動的に本人プロフィールへ紐付きます。事前登録済みメンバーは、主催者がメンバー管理から発行する24時間有効・1回限りの本人用リンクを本人へ個別共有します。本人確認後はランダムtokenのSHA-256ハッシュだけをDBへ保存し、平文tokenはHttpOnly Cookieへ1年間保持します。

アイコンはブラウザで512px正方形へ縮小し、WebPを優先します。WebP canvas変換に対応しないSafari等ではJPEGへ自動フォールバックします。Worker側でもJPEG・PNG・WebPのcontent type、シグネチャ、1MB上限を検証します。

## OSSライセンス

本番ビルドの前に `npm run license:check` が実行され、`scripts/check-production-licenses.mjs` の許可リストにない本番依存、またはライセンス不明の依存がある場合はビルドを停止します。新しいライセンスを許可リストへ追加するときは、利用・配布条件を確認してから更新してください。

Viteの `build.license` により、実際に各bundleへ含まれた依存の名称、バージョン、著作権表示、ライセンス全文を次へ自動生成します。

- ブラウザ配信用: `build/client/oss-licenses.md`
- Worker配信用: `build/server/oss-licenses.md`

Cloudflareは `build/client` を静的assetとして配信するため、公開後は `/oss-licenses.md` でブラウザ向け一覧を閲覧できます。全画面共通フッターからも同じURLへリンクします。JavaScript以外の画像、フォント、投稿コンテンツの利用条件はこの自動生成の対象外なので、追加時に個別確認します。

デプロイ前および git push 前には `npm run build` を成功させてください。

## ドキュメント

- [要件](docs/requirements.md)
- [アーキテクチャ](docs/architecture.md)
- [業務ルール](docs/domain-rules.md)
- [今後の TODO](docs/TODO.md)
