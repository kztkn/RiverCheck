# RiverCheck Codex 引き継ぎ

更新日: 2026-08-08（JST）

## 目的

Codex Desktop のエージェント実行環境を Windows から WSL 2（Ubuntu）へ変更した後、別タスクから安全に開発を再開するための引き継ぎです。

このリポジトリをプロジェクトの唯一のソースとして扱ってください。チャット履歴だけを根拠にせず、最初に必ずリポジトリの現状を確認してください。

## プロジェクト

- アプリ名: RiverCheck
- 用途: ポーカー会の結果・精算管理Webアプリ
- リポジトリ（WSL）: `/home/kzt/projects/RiverCheck`
- Windowsから見たパス: `\\wsl.localhost\Ubuntu\home\kzt\projects\RiverCheck`
- 主な技術: Node.js / React Router / Vite / Cloudflare Workers系ランタイム / PostgreSQL / Docker Compose

## 推奨実行環境

開発ツールをWSL内へ統一します。

- Codex DesktopのUI: Windows
- Codexエージェント・ターミナル: WSL 2 Ubuntu
- リポジトリ: `/home/kzt/projects/RiverCheck`（`/mnt/c`へ移動しない）
- Node.js/npm: WSL内のLinux版を使用
- Docker: WSLのDocker CLIからDocker Desktopへ接続

Windows版Node.jsをWSL上のリポジトリに対して使わないでください。また、Windows版とWSL版で同じ `node_modules` を共用しないでください。

## これまでに確認できたこと

- Docker DesktopのWSL連携は現在正常です。
- WSL内で `/usr/bin/docker` が見つかっています。
- Docker CLI: 29.6.1
- Docker Compose: v5.3.0
- `docker info` でDocker Desktopサーバーへ接続できています。
- 過去にWindows側Node.jsからWSL上のリポジトリを操作した際、次の問題が発生しました。
  - UNCパス・ドライブ変換の問題
  - Viteのファイル監視エラー（`EISDIR ... watch`）
  - Cloudflare `workerd` / Viteの `write EOF`
  - ファイル操作と依存関係処理の遅延
- Windows側からの回避策では、少なくとも `npm test`、`npm run typecheck`、`npm run build` の成功を確認した時点があります。ただし、引き継ぎ後の現在状態は必ず再検証してください。

## WSL移行直後の確認

以下をWSLのシェルで実行してください。

```bash
cd /home/kzt/projects/RiverCheck
pwd
git status --short
git branch --show-current
git log -5 --oneline --decorate

which node || true
node -v || true
npm -v || true
which docker
docker --version
docker compose version
docker info
```

Node.jsがない、または要件を満たさない場合は、WSL内へNode.js 24 LTSを導入してください。少なくともNode.js 22.22以降を想定しています。導入方法を決める前に `package.json`、lockfile、READMEの指定を確認してください。

## 依存関係の再構築

`node_modules` がWindows側Node.jsによって作られた可能性があります。内容とパスを確認し、WSL用に再作成してください。削除・退避は対象の絶対パスが `/home/kzt/projects/RiverCheck/node_modules` であることを確認してから行ってください。ユーザーの未コミットファイルや他のディレクトリを削除しないでください。

lockfileに合うコマンドを選び、原則として次を実施します。

```bash
cd /home/kzt/projects/RiverCheck
npm ci
npm run typecheck
npm test
npm run build
```

その後、開発サーバーを起動してブラウザで主要画面を確認してください。

```bash
npm run dev
```

必要ならDocker Composeのサービスを起動します。

```bash
docker compose up -d
docker compose ps
```

Compose操作の前に `compose.yaml` / `docker-compose.yml` と `.env.example` を確認し、必要な環境変数や永続ボリュームを把握してください。

## Git・作業上の注意

- 未コミット変更はユーザーの成果物です。勝手に破棄、reset、checkoutしないでください。
- 最初に `git status --short` と差分を確認してください。
- このリポジトリ内の `AGENTS.md` があれば最優先で読んでください。
- 現在与えられている必須ルール:
  - Vercelへ新規デプロイするときはプロジェクトルートに `.npmrc` を作り、`legacy-peer-deps=true` を設定する。
  - `git push` の前に必ず `npm run build` の成功を確認する。
- `.env`、トークン、秘密鍵などの機密情報をコミットしないでください。
- WindowsとWSLのGit設定差を確認してください。

```bash
git config user.name
git config user.email
git config core.autocrlf
```

## 最初に読むもの

存在するものを順に確認してください。

1. `AGENTS.md`
2. `README.md`
3. `package.json` とlockfile
4. Docker Compose設定
5. `.env.example`
6. Cloudflare/Vite/React Router関連設定
7. `git status` と未コミット差分

## 新しいCodexタスクへ貼る開始プロンプト

```text
/home/kzt/projects/RiverCheck の CODEX_HANDOFF.md を最初に全文読んでください。
このリポジトリを唯一のソースとして扱い、AGENTS.md、README.md、package.json、Git状態、未コミット差分を確認してください。

Codexのエージェント環境をWindowsからWSL 2 Ubuntuへ移行した直後です。Windows版Node.jsとWSL版Node.jsを混在させず、WSL内のNode/npmとDocker Desktop連携を確認してください。既存のnode_modulesがWindows側で作成された可能性があるため、安全に確認してWSL用に依存関係を再構築してください。

その後、npm run typecheck、npm test、npm run buildを実行し、必要なDocker Composeサービスとnpm run devを起動してRiverCheckの動作を確認してください。未コミット変更は破棄せず、問題があれば原因と実施した対応を報告してください。
```

## 現チャット終了時の制約

引き継ぎ文書作成時、Windows側Codexの実行プロセスが `setup refresh had errors` で起動できず、最新のGit状態をコマンドで再取得できませんでした。そのため、この文書にはブランチ名、未コミットファイル一覧、最新コミットIDを固定値として記載していません。新しいWSL環境で最初に取得してください。
