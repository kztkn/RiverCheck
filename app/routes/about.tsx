import type { ReactNode } from "react";
import { IconBrandLine } from "@tabler/icons-react";
import { Link } from "react-router";
import { GroupSiteHeader } from "~/components/site-menu";
import { findGroupByPublicCode } from "@server/repositories/group-repository.server";
import type { Route } from "./+types/about";

export const LINE_OPEN_CHAT_URL =
  "https://line.me/ti/g2/8Bsonb9YK8YewGVvTNCp4vnCofI2PrXey7cVEg";
export const ABOUT_DESCRIPTION =
  "開催結果、会費の精算、個人戦績をひとつにまとめるポーカー会向けWebアプリです。";

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
        <p>{ABOUT_DESCRIPTION}</p>
      </section>

      <AboutSections />

      <div className="about-meta-link">
        <a href="/oss-licenses.md">OSSライセンス</a>
        <Link to={`/g/${group.publicCode}`}>グループトップへ戻る</Link>
      </div>
    </main>
  );
}

export function AboutSections() {
  return (
    <>
      <AboutGuide />
      <AboutOpenChatSection />
      <AboutHomeScreenGuide />
    </>
  );
}

export function AboutGuide() {
  return (
    <section className="about-guide" aria-label="RiverCheckの使い方">
      <AboutItem number="01" title="参加する">
        OPEN GAMESまたは主催者から届いたリンクを開き、自分の名前で参加します。プレイ中はリバイと100BB返済を記録し、終了後に残りチップと手元のリバイ証を入力します。
      </AboutItem>
      <AboutItem number="02" title="結果と精算を確認する">
        主催者が確定すると、順位、損益BB、会費の負担額を同じリンクから確認できます。精算は結果画面からPayPayへ進めます。
      </AboutItem>
      <AboutItem number="03" title="戦績を振り返る">
        ランキングでは累計・平均損益、最大勝ち、直近3戦、TOP3回数などを比較できます。個人ページでは開催ごとの成績と損益BBの推移を確認できます。
      </AboutItem>
      <AboutItem number="04" title="プロフィールを育てる">
        プロフィール画面で自分の名前を選ぶと、この端末に紐付きます。アイコン、ひとこと、マイハンドを編集して、自分らしいプロフィールに育てられます。
      </AboutItem>
      <AboutItem number="05" title="称号を集める">
        確定した戦績に応じて称号を獲得できます。個人ページでコレクションを確認し、獲得済みから1つ選んでプロフィールやランキングに表示できます。
      </AboutItem>
    </section>
  );
}

export function AboutOpenChatSection() {
  return (
    <aside className="about-community-section" aria-labelledby="open-chat-title">
      <div className="about-community-mark" aria-hidden="true">
        <IconBrandLine stroke={1.65} />
      </div>
      <div className="about-community-copy">
        <p className="about-community-label">COMMUNITY / LINE OPENCHAT</p>
        <h2 id="open-chat-title">次の開催も、ここから。</h2>
        <p>
          開催通知や集合時間など、当日の連絡をオープンチャットで案内します。
        </p>
      </div>
      <a
        className="about-community-link"
        href={LINE_OPEN_CHAT_URL}
        rel="noreferrer"
        target="_blank"
      >
        <IconBrandLine aria-hidden="true" stroke={1.9} />
        <span>LINEオープンチャットに参加</span>
      </a>
    </aside>
  );
}

export function AboutHomeScreenGuide() {
  return (
    <details className="about-home-screen">
      <summary>
        <div>
          <h2>ホーム画面に追加する</h2>
          <p>よく使う場合の設定（任意）</p>
        </div>
        <span className="about-home-screen-chevron" aria-hidden="true">
          ⌄
        </span>
      </summary>
      <div className="about-home-screen-body">
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
      </div>
    </details>
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
