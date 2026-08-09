import { useState } from "react";
import {
  POKER_RANKS,
  POKER_SUITS,
  formatPokerRank,
  parsePokerCardCode,
  type PokerRank,
  type PokerSuit,
} from "@domain/player-profile/favorite-hand";
import { PlayingCard, SuitIcon } from "./playing-card";

type Slot = 1 | 2;

export function FavoriteHandPicker({
  card1,
  card2,
  disabled,
  error,
  onChange,
}: {
  card1: string;
  card2: string;
  disabled: boolean;
  error?: string;
  onChange: (card1: string, card2: string) => void;
}) {
  const [activeSlot, setActiveSlot] = useState<Slot | null>(null);
  const [rank, setRank] = useState<PokerRank | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);

  function open(slot: Slot) {
    const current = parsePokerCardCode(slot === 1 ? card1 : card2);
    setRank(current?.rank ?? null);
    setPickerError(null);
    setActiveSlot(slot);
  }

  function selectSuit(suit: PokerSuit) {
    if (!rank || activeSlot === null) return;
    const code = `${rank}${suit}`;
    const otherCard = activeSlot === 1 ? card2 : card1;
    if (code === otherCard) {
      setPickerError("同じカードを2枚選ぶことはできません。");
      return;
    }
    if (activeSlot === 1) {
      onChange(code, card2);
      setActiveSlot(2);
      setRank(parsePokerCardCode(card2)?.rank ?? null);
    } else {
      onChange(card1, code);
      setActiveSlot(null);
      setRank(null);
    }
    setPickerError(null);
  }

  return (
    <section className="favorite-hand-editor" aria-labelledby="favorite-hand-heading">
      <div className="favorite-hand-heading-row">
        <div>
          <span className="field-label" id="favorite-hand-heading">MY HAND</span>
          <span className="field-hint">お気に入りの2枚を選択</span>
        </div>
        {card1 || card2 ? (
          <button
            className="text-button"
            disabled={disabled}
            onClick={() => onChange("", "")}
            type="button"
          >
            クリア
          </button>
        ) : null}
      </div>

      <div className="favorite-hand-slots">
        <button
          aria-label="1枚目を選択"
          className="favorite-hand-slot"
          disabled={disabled}
          onClick={() => open(1)}
          type="button"
        >
          <PlayingCard code={card1} />
          <small>1ST CARD</small>
        </button>
        <button
          aria-label="2枚目を選択"
          className="favorite-hand-slot"
          disabled={disabled}
          onClick={() => open(2)}
          type="button"
        >
          <PlayingCard code={card2} />
          <small>2ND CARD</small>
        </button>
      </div>
      {error ? <span className="field-error">{error}</span> : null}

      {activeSlot !== null ? (
        <div className="favorite-hand-picker" role="dialog" aria-modal="true" aria-label={`${activeSlot}枚目のカードを選択`}>
          <button
            aria-label="カード選択を閉じる"
            className="favorite-hand-picker-backdrop"
            onClick={() => setActiveSlot(null)}
            type="button"
          />
          <div className="favorite-hand-picker-card">
            <div className="favorite-hand-picker-heading">
              <div>
                <span className="eyebrow">{activeSlot === 1 ? "1ST CARD" : "2ND CARD"}</span>
                <strong>ランク → スートの順に選択</strong>
              </div>
              <button aria-label="閉じる" className="profile-edit-modal-close" onClick={() => setActiveSlot(null)} type="button">×</button>
            </div>
            <div className="favorite-hand-rank-grid" aria-label="ランク">
              {POKER_RANKS.map((candidate) => (
                <button
                  aria-pressed={rank === candidate}
                  className={rank === candidate ? "is-selected" : ""}
                  key={candidate}
                  onClick={() => {
                    setRank(candidate);
                    setPickerError(null);
                  }}
                  type="button"
                >
                  {formatPokerRank(candidate)}
                </button>
              ))}
            </div>
            <div className="favorite-hand-suit-grid" aria-label="スート">
              {POKER_SUITS.map((suit) => (
                <button
                  className={`favorite-hand-suit favorite-hand-suit-${suit.toLowerCase()}`}
                  disabled={!rank}
                  key={suit}
                  onClick={() => selectSuit(suit)}
                  type="button"
                >
                  <SuitIcon suit={suit} />
                </button>
              ))}
            </div>
            {pickerError ? <p className="field-error">{pickerError}</p> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
