import { IconCheck } from "@tabler/icons-react";
import { AchievementIcon } from "./achievement-icon";
import type {
  PlayerAchievementCollection,
  PlayerAchievementItem,
} from "@shared-types/achievement";

export function PlayerAchievementCollectionView({
  collection,
}: {
  collection: PlayerAchievementCollection;
}) {
  const unlockedItems = [
    ...collection.items.filter(
      (achievement) => achievement.isUnlocked && achievement.isEquipped,
    ),
    ...collection.items.filter(
      (achievement) => achievement.isUnlocked && !achievement.isEquipped,
    ),
  ];
  const lockedItems = collection.items.filter(
    (achievement) => !achievement.isUnlocked,
  );

  return (
    <section
      aria-labelledby="achievements-heading"
      className="content-section achievement-collection"
    >
      <div className="section-heading stats-section-heading">
        <h2 id="achievements-heading">称号コレクション</h2>
        <span className="count-badge">
          {collection.unlockedCount} / {collection.totalCount} 獲得
        </span>
      </div>

      <div className="achievement-unlocked-section">
        <h3>獲得済み</h3>
        {unlockedItems.length === 0 ? (
          <p className="achievement-empty">まだ獲得した称号はありません。</p>
        ) : (
          <div
            aria-label="獲得済み称号"
            className="achievement-unlocked-grid"
          >
            {unlockedItems.map((achievement) => (
              <UnlockedAchievement
                achievement={achievement}
                key={achievement.id}
              />
            ))}
          </div>
        )}
      </div>

      {lockedItems.length > 0 ? (
        <details className="achievement-locked-disclosure">
          <summary>
            <span>
              未獲得 <strong>{lockedItems.length}</strong>
            </span>
            <span className="achievement-disclosure-action">
              <span className="when-closed">すべて見る</span>
              <span className="when-open">閉じる</span>
              <span aria-hidden="true">⌄</span>
            </span>
          </summary>
          <ul aria-label="未獲得称号" className="achievement-locked-list">
            {lockedItems.map((achievement) => (
              <LockedAchievement
                achievement={achievement}
                key={achievement.id}
              />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function UnlockedAchievement({
  achievement,
}: {
  achievement: PlayerAchievementItem;
}) {
  return (
    <article
      className="achievement-card is-unlocked"
      data-achievement-category={achievement.category}
    >
      <span className="achievement-card-icon">
        <AchievementIcon iconKey={achievement.iconKey} />
      </span>
      <div className="achievement-card-copy">
        <div className="achievement-card-title">
          <strong>{achievement.name}</strong>
          {achievement.isEquipped ? (
            <span className="achievement-equipped-label">
              <IconCheck aria-hidden="true" /> 装備中
            </span>
          ) : null}
        </div>
        <p>{achievement.description}</p>
        <div className="achievement-earned-meta">
          <time dateTime={achievement.unlockedAt ?? undefined}>
            {formatAchievementDate(achievement.unlockedAt)} 獲得
          </time>
          {achievement.sourceGame ? (
            <span>
              {achievement.sourceGame.title}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function LockedAchievement({ achievement }: { achievement: PlayerAchievementItem }) {
  const concealed = achievement.isHidden;
  return (
    <li data-achievement-category={achievement.category}>
      <span className="achievement-locked-icon">
        <AchievementIcon iconKey={achievement.iconKey} locked />
      </span>
      <span className="achievement-locked-copy">
        <strong>{concealed ? "???" : achievement.name}</strong>
        <small>{concealed ? "条件は秘密" : achievement.description}</small>
      </span>
      <span className="achievement-locked-label">未獲得</span>
    </li>
  );
}

function formatAchievementDate(value: string | null): string {
  if (!value) return "獲得日不明";
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}
