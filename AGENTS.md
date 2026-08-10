# RiverCheck エージェントガイド

このファイルは、このリポジトリで作業する Codex などのエージェント向けの恒久的な指示です。一時的な作業状況やチャット固有の前提は記載せず、長期間有効な開発原則だけを管理します。

## プロジェクト概要

RiverCheck は、ポーカー会の開催、参加、結果、順位、チップ総量、会費精算、ランキング、開催ハイライト、本人プロフィールを管理するスマートフォン向け Web アプリです。

主な構成は React Router、TypeScript、Vite、Cloudflare Workers、PostgreSQL、Cloudflare Hyperdrive、Cloudflare R2 です。ローカルの PostgreSQL は Docker Compose、Worker と R2 は Cloudflare Vite plugin / Wrangler のローカルエミュレーションを使用します。

## 仕様と設計の正本

- プロダクト要件の正本は `docs/requirements.md` とする。
- 業務ルールの正本は `docs/domain-rules.md` とする。
- 技術設計と設計判断の正本は `docs/architecture.md` とする。
- 実装状況と今後の候補は `docs/TODO.md` を参照する。ただし TODO は仕様の正本ではない。
- セットアップ、主要コマンド、運用手順は `README.md` を参照する。
- チャット履歴や過去の説明とリポジトリが矛盾する場合は、現在のコードと上記ドキュメントを優先し、矛盾を明示する。
- 要件または設計を変更した場合は、同じ変更内で対応するドキュメントも更新する。

## 作業開始時

- 最初に `git status --short` を確認し、ユーザーの未コミット変更を把握する。
- 対象機能に関係する要件、業務ルール、アーキテクチャと既存テストを読んでから変更する。
- 未コミット変更はユーザーの成果物として扱い、明示的な依頼なしに破棄、上書き、reset、checkout しない。
- `.env`、`.dev.vars`、トークン、PIN、接続URL、秘密鍵などの機密情報を表示・コミットしない。

## 開発実行環境

- このリポジトリの開発コマンドは、WSL内のLinuxネイティブ環境で実行する。
- Node.js、npm、React Router、Vite、Vitest、Wranglerなどは、WSL側にインストールされたLinux版を使用する。
- `cmd.exe`、PowerShell、Windows版Node.js、Codex付属のWindows向けworkspace dependency runtimeを、開発コマンドの代替として使用しない。
- `command -v node`や`command -v npm`でWindows側のパス（`/mnt/c/`配下など）が解決された場合は、そのまま実行せず、WSL側のNode.js設定、バージョン管理ツール、PATHを確認する。
- WSL側のLinux版Node.jsを利用できない場合は、Windows側へフォールバックしたり依存を再構築したりせず、作業を停止してユーザーへ環境状態を報告する。
- `node_modules`はOSごとのネイティブ依存を含むため、Linux版とWindows版を交換、混在、上書きしない。検証のために別OS向け依存を一時インストールすることも禁止する。
- `npm run typecheck`、`npm test`、`npm run build`を含む検証結果は、WSL内のLinux版Node.jsで実行したものだけを有効とする。

## アーキテクチャ原則

- React Router の loader/action とコンポーネントは HTTP・UI の境界とし、SQLや複雑な業務計算を書かない。
- 認可、入力検証、ユースケースの組み立ては `server/services` に置く。
- PostgreSQL クエリとDB行の変換は `server/repositories` に置き、SQLはプレースホルダーを使う。
- DBやHTTPに依存しない計算は `domain` の純粋関数として実装する。
- MVPでは別REST APIを増やさず、React Router の loader/action から service を呼ぶ既存構成を維持する。
- 金額、チップ、点数は整数として扱い、`BIGINT` と JavaScript `number` の安全な変換境界を意識する。
- 認証・本人確認用トークンの平文をDB、HTML、URL、ログへ保存しない。DBにはハッシュのみを保存し、Cookieは既存の HttpOnly / SameSite / Secure 方針を維持する。
- 認証や秘密値が未設定の場合は fail closed とし、管理操作を許可しない。

## Cloudflare・DB・ストレージ

- Worker はリクエストをまたいだネットワークI/Oを再利用しない。DB接続は既存の client helper とトランザクション方針に従う。
- `npm run db:migrate` と `npm run db:seed` はローカル Docker PostgreSQL 専用とする。
- `db:migrate:production` と `db:seed:production` は本番DBを変更するため、接続先を確認し、ユーザーの明示的な依頼なしに実行しない。
- R2 bucket は非公開を維持し、`r2.dev` と R2 Custom Domain を有効にしない。画像は現在DBで参照中の object だけを Worker の専用 route から配信する。
- R2 と PostgreSQL をまたぐ分散トランザクションは作らない。置換後やDB更新失敗時の未参照 object は自動削除せず、既存の運用方針に従う。
- Cloudflare binding、secret、Hyperdrive、Rate Limiting を変更した場合は `wrangler.jsonc`、型定義、README、関連ドキュメントの整合を確認する。

## 実装と検証

- 変更には、その責務に最も近いテストを追加または更新する。
- 通常の検証コマンドは次の順序を目安とする。

```bash
npm run typecheck
npm test
npm run build
```

- 小さな変更では対象テストから始めてよいが、デプロイまたは `git push` の前には必ず `npm run build` を成功させる。
- `npm run build` にはOSSライセンス検査が含まれる。依存追加時はライセンスを確認し、必要な場合だけ許可リストを更新する。
- 動作確認で生成された一時ファイルやビルド成果物を、意図せずコミット対象に含めない。

## Git・デプロイ

- commit、push、デプロイはユーザーから依頼された範囲でのみ行う。
- commit前に差分を確認し、今回の作業と無関係な変更を含めない。
- `git push` の前に必ず `npm run build` の成功を確認する。
- 既定のデプロイ先は Cloudflare Workers である。
