import { IconCheck } from "@tabler/icons-react";
import { Link } from "react-router";
import { AchievementIcon } from "./achievement-icon";
import type { PlayerAchievementCollection } from "@shared-types/achievement";

export function PlayerAchievementCollectionView({
  collection,
  groupCode,
}: {
  collection: PlayerAchievementCollection;
  groupCode: string;
}) {
  return (
    <section className="content-section achievement-collection" aria-labelledby="achievements-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">ACHIEVEMENTS</p>
          <h2 id="achievements-heading">実績</h2>
        </div>
        <span className="count-badge">
          {collection.unlockedCount} / {collection.totalCount} 獲得
        </span>
      </div>

      <div className="achievement-collection-grid">
        {collection.items.map((achievement) => {
          const concealed = achievement.isHidden && !achievement.isUnlocked;
          return (
            <article
              className={`achievement-card${achievement.isUnlocked ? " is-unlocked" : " is-locked"}`}
              key={achievement.id}
            >
              <span className="achievement-card-icon">
                <AchievementIcon
                  iconKey={achievement.iconKey}
                  locked={!achievement.isUnlocked}
                />
              </span>
              <div className="achievement-card-copy">
                <div className="achievement-card-title">
                  <strong>{concealed ? "???" : achievement.name}</strong>
                  {achievement.isEquipped ? (
                    <span className="achievement-equipped-label">
                      <IconCheck aria-hidden="true" /> 表示中
                    </span>
                  ) : null}
                </div>
                <p>{concealed ? "条件は秘密" : achievement.description}</p>
                {achievement.isUnlocked ? (
                  <div className="achievement-earned-meta">
                    <time dateTime={achievement.unlockedAt ?? undefined}>
                      {formatAchievementDate(achievement.unlockedAt)} 獲得
                    </time>
                    {achievement.sourceGame ? (
                      <Link to={`/g/${groupCode}/games/${achievement.sourceGame.id}`}>
                        {achievement.sourceGame.title}
                      </Link>
                    ) : null}
                  </div>
                ) : (
                  <span className="achievement-locked-label">未獲得</span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function formatAchievementDate(value: string | null): string {
  if (!value) return "獲得日不明";
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}
