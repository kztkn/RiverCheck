import { useEffect, useId, useRef, useState } from "react";
import { IconCheck, IconX } from "@tabler/icons-react";
import { AchievementIcon } from "./achievement-icon";
import type {
  PlayerAchievementCollection,
  PlayerAchievementItem,
} from "@shared-types/achievement";

type CollectionTab = "unlocked" | "locked";

export function PlayerAchievementCollectionView({
  collection,
}: {
  collection: PlayerAchievementCollection;
}) {
  const unlockedItems = sortUnlockedAchievements(
    collection.items.filter((achievement) => achievement.isUnlocked),
  );
  const lockedItems = collection.items.filter(
    (achievement) => !achievement.isUnlocked,
  );
  const previewItems = unlockedItems.slice(0, 5);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<CollectionTab>("unlocked");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const unlockedTabId = useId();
  const lockedTabId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (collectionOpen && !dialog.open) {
      dialog.showModal();
    } else if (!collectionOpen && dialog.open) {
      dialog.close();
    }
  }, [collectionOpen]);

  useEffect(() => {
    if (!collectionOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [collectionOpen]);

  function openCollection() {
    setActiveTab(unlockedItems.length > 0 ? "unlocked" : "locked");
    setCollectionOpen(true);
  }

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

      {previewItems.length === 0 ? (
        <p className="achievement-empty">まだ獲得した称号はありません。</p>
      ) : (
        <div
          aria-label="獲得済み称号のプレビュー"
          className="achievement-preview-rail"
        >
          {previewItems.map((achievement) => (
            <AchievementPreview
              achievement={achievement}
              key={achievement.id}
            />
          ))}
        </div>
      )}

      {collection.totalCount > 0 ? (
        <button
          className="achievement-collection-open"
          onClick={openCollection}
          type="button"
        >
          <span>コレクションを見る</span>
        </button>
      ) : null}

      {collection.totalCount > 0 ? (
        <dialog
          aria-labelledby={headingId}
          className="achievement-collection-dialog"
          onCancel={() => setCollectionOpen(false)}
          onClick={(event) => {
            if (event.target === event.currentTarget) setCollectionOpen(false);
          }}
          onClose={() => setCollectionOpen(false)}
          ref={dialogRef}
        >
          <div className="achievement-collection-sheet">
            <header className="achievement-collection-dialog-header">
              <div>
                <p className="eyebrow">TITLE COLLECTION</p>
                <h2 id={headingId}>称号コレクション</h2>
                <p>
                  {collection.unlockedCount} / {collection.totalCount} 獲得
                </p>
              </div>
              <button
                aria-label="称号コレクションを閉じる"
                className="achievement-collection-close"
                onClick={() => setCollectionOpen(false)}
                type="button"
              >
                <IconX aria-hidden="true" />
              </button>
            </header>

            <div
              aria-label="称号の獲得状態"
              className="achievement-collection-tabs"
              role="tablist"
            >
              <button
                aria-controls={`${unlockedTabId}-panel`}
                aria-selected={activeTab === "unlocked"}
                id={unlockedTabId}
                onClick={() => setActiveTab("unlocked")}
                role="tab"
                type="button"
              >
                獲得済み <span>{unlockedItems.length}</span>
              </button>
              <button
                aria-controls={`${lockedTabId}-panel`}
                aria-selected={activeTab === "locked"}
                id={lockedTabId}
                onClick={() => setActiveTab("locked")}
                role="tab"
                type="button"
              >
                未獲得 <span>{lockedItems.length}</span>
              </button>
            </div>

            <div className="achievement-collection-dialog-body">
              <div
                aria-labelledby={unlockedTabId}
                hidden={activeTab !== "unlocked"}
                id={`${unlockedTabId}-panel`}
                role="tabpanel"
              >
                {unlockedItems.length === 0 ? (
                  <p className="achievement-modal-empty">
                    まだ獲得した称号はありません。
                  </p>
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
              <div
                aria-labelledby={lockedTabId}
                hidden={activeTab !== "locked"}
                id={`${lockedTabId}-panel`}
                role="tabpanel"
              >
                {lockedItems.length === 0 ? (
                  <p className="achievement-modal-empty">
                    すべての称号を獲得しています。
                  </p>
                ) : (
                  <ul
                    aria-label="未獲得称号"
                    className="achievement-locked-list"
                  >
                    {lockedItems.map((achievement) => (
                      <LockedAchievement
                        achievement={achievement}
                        key={achievement.id}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </dialog>
      ) : null}
    </section>
  );
}

function AchievementPreview({
  achievement,
}: {
  achievement: PlayerAchievementItem;
}) {
  return (
    <article
      className="achievement-preview-card"
      data-achievement-category={achievement.category}
    >
      <span className="achievement-preview-icon">
        <AchievementIcon iconKey={achievement.iconKey} />
      </span>
      <strong>{achievement.name}</strong>
      <small>{achievement.isEquipped ? "装備中" : "獲得済み"}</small>
    </article>
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
            <span>{achievement.sourceGame.title}</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function LockedAchievement({
  achievement,
}: {
  achievement: PlayerAchievementItem;
}) {
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

function sortUnlockedAchievements(
  items: PlayerAchievementItem[],
): PlayerAchievementItem[] {
  return [...items].sort((left, right) => {
    if (left.isEquipped !== right.isEquipped) {
      return left.isEquipped ? -1 : 1;
    }
    const unlockedDifference =
      achievementTime(right.unlockedAt) - achievementTime(left.unlockedAt);
    if (unlockedDifference !== 0) return unlockedDifference;
    return left.name.localeCompare(right.name, "ja");
  });
}

function achievementTime(value: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatAchievementDate(value: string | null): string {
  if (!value) return "獲得日不明";
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}
