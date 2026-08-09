import {
  IconClubsFilled,
  IconDiamondFilled,
  IconHeartFilled,
  IconSpadeFilled,
} from "@tabler/icons-react";
import {
  formatPokerRank,
  parsePokerCardCode,
  type PokerSuit,
} from "@domain/player-profile/favorite-hand";

export function PlayingCard({
  code,
  emptyLabel = "＋",
}: {
  code: string | null;
  emptyLabel?: string;
}) {
  const card = parsePokerCardCode(code);
  if (!card) {
    return (
      <span aria-hidden="true" className="playing-card playing-card-empty">
        {emptyLabel}
      </span>
    );
  }

  const rank = formatPokerRank(card.rank);
  return (
    <span
      aria-label={`${rank}${suitName(card.suit)}`}
      className={`playing-card playing-card-${card.suit.toLowerCase()}`}
    >
      <span className="playing-card-corner">{rank}</span>
      <SuitIcon className="playing-card-suit" suit={card.suit} />
      <span className="playing-card-corner playing-card-corner-bottom">
        {rank}
      </span>
    </span>
  );
}

export function FavoriteHandDisplay({
  card1,
  card2,
}: {
  card1: string | null;
  card2: string | null;
}) {
  if (!parsePokerCardCode(card1) || !parsePokerCardCode(card2)) return null;
  return (
    <div className="favorite-hand-display" aria-label="マイハンド">
      <PlayingCard code={card1} />
      <PlayingCard code={card2} />
    </div>
  );
}

export function SuitIcon({
  className,
  suit,
}: {
  className?: string;
  suit: PokerSuit;
}) {
  const props = { "aria-hidden": true, className, stroke: 0 } as const;
  switch (suit) {
    case "S":
      return <IconSpadeFilled {...props} />;
    case "H":
      return <IconHeartFilled {...props} />;
    case "D":
      return <IconDiamondFilled {...props} />;
    case "C":
      return <IconClubsFilled {...props} />;
  }
}

function suitName(suit: PokerSuit): string {
  return suit === "S"
    ? "スペード"
    : suit === "H"
      ? "ハート"
      : suit === "D"
        ? "ダイヤ"
        : "クラブ";
}
