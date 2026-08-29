import { useEffect } from "react";
import { Link } from "react-router";
import {
  DEFAULT_GROUP_CODE,
  readLastVisitedGroup,
} from "~/utils/last-visited-group";

export default function Home() {
  useEffect(() => {
    const groupCode = readLastVisitedGroup(window.localStorage) ?? DEFAULT_GROUP_CODE;
    window.location.replace(`/g/${encodeURIComponent(groupCode)}`);
  }, []);

  return (
    <main className="page-shell home-redirect-page">
      <section className="form-intro">
        <p className="eyebrow">RIVERCHECK</p>
        <h1>前回のグループを開いています</h1>
        <p>いつものテーブルへ戻ります。</p>
        <Link className="button button-primary" to={`/g/${DEFAULT_GROUP_CODE}`}>
          RiverCheckを開く
        </Link>
      </section>
    </main>
  );
}
