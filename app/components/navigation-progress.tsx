export function NavigationProgress({ active }: { active: boolean }) {
  return (
    <div
      aria-hidden={active ? undefined : true}
      aria-label={active ? "ページを読み込み中" : undefined}
      aria-valuetext={active ? "読み込み中" : undefined}
      className={`app-navigation-progress${active ? " is-active" : ""}`}
      role={active ? "progressbar" : undefined}
    >
      <span aria-hidden="true" />
    </div>
  );
}
