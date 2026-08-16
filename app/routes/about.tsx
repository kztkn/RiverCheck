import type { ReactNode } from "react";
import { Link } from "react-router";
import { GroupSiteHeader } from "~/components/site-menu";
import { findGroupByPublicCode } from "@server/repositories/group-repository.server";
import type { Route } from "./+types/about";

export async function loader({ params }: Route.LoaderArgs) {
  const group = await findGroupByPublicCode(params.groupCode);
  if (!group) throw new Response("Group not found", { status: 404 });
  return { group: { name: group.name, publicCode: group.publicCode } };
}

export default function About({ loaderData }: Route.ComponentProps) {
  const { group } = loaderData;

  return (
    <main className="page-shell about-page">
      <GroupSiteHeader groupCode={group.publicCode} />

      <section className="form-intro about-intro">
        <p className="eyebrow">ABOUT</p>
        <h1>RIVERCHECK</h1>
        <p>
          {group.name} の開催結果、会費の精算、個人戦績をひとつにまとめる
          ポーカー会向けWebアプリです。
        </p>
      </section>

      <section className="about-guide" aria-label="RiverCheckの使い方">
        <AboutItem number="01" title="参加する">
          OPEN GAMESから参加したい会を選択、もしくは主催者から届いた開催リンクを開き、自分の名前で参加します。終了時に残りチップとリバイ回数を入力してください。
        </AboutItem>
        <AboutItem number="02" title="結果を見る">
          主催者が結果を確定すると、順位、損益BB、会費の負担額を同じリンクから確認できます。
        </AboutItem>
        <AboutItem number="03" title="戦績を振り返る">
          ランキングと個人ページでは、過去の参加回数や累計損益BB、開催ごとの推移を確認できます。
        </AboutItem>
        <AboutItem number="04" title="プロフィールを育てる">
          本人用リンクで端末を紐付けると、名前、アイコン、ひとことを自分で編集できます。
        </AboutItem>
      </section>

      <section className="about-home-screen">
        <div>
          <h2>ホーム画面からすぐ開く</h2>
        </div>
        <p>iPhoneではSafariでRiverCheckを開き、次の順に操作します。</p>
        <ol className="about-install-steps">
          <li>画面下の共有ボタンをタップ</li>
          <li>「ホーム画面に追加」をタップ</li>
          <li>「Webアプリとして開く」をオン</li>
          <li>右上の「追加」をタップ</li>
        </ol>
        <p>
          追加後は、ホーム画面のRCアイコンからRiverCheckをアプリのように開けます。「ホーム画面に追加」が見つからない場合は、共有メニュー下部の「アクションを編集」から追加できます。
        </p>
      </section>

      <div className="about-meta-link">
        <a href="/oss-licenses.md">OSSライセンス</a>
        <Link to={`/g/${group.publicCode}`}>グループトップへ戻る</Link>
      </div>
    </main>
  );
}

function AboutItem({
  children,
  number,
  title,
}: {
  children: ReactNode;
  number: string;
  title: string;
}) {
  return (
    <article className="about-guide-item">
      <span>{number}</span>
      <div>
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
    </article>
  );
}
