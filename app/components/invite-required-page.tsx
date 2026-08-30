export function InviteRequiredPage({
  title = "参加するグループが見つかりません",
}: {
  title?: string;
}) {
  return (
    <main className="page-shell entry-gate-page">
      <section className="entry-gate-panel">
        <p className="eyebrow">RIVERCHECK</p>
        <div className="entry-gate-mark" aria-hidden="true">♠</div>
        <h1>{title}</h1>
        <p>
          主催者から届いた受付中の開催リンクを開いてください。開催に参加すると、次回からこの端末でグループを開けます。
        </p>
      </section>
    </main>
  );
}
