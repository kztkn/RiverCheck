import type { GameHighlight as GameHighlightData } from "@shared-types/highlight";

export function GameHighlight({
  gameTitle,
  highlight,
  photoUrl,
}: {
  gameTitle: string;
  highlight: GameHighlightData | null;
  photoUrl: string | null;
}) {
  if (!highlight?.text && !photoUrl) return null;

  return (
    <section className="game-highlight-panel" aria-labelledby="highlight-heading">
      <div>
        <h2 id="highlight-heading">TABLE STORY</h2>
      </div>
      {photoUrl ? (
        <figure className="game-highlight-photo">
          <img
            alt={`${gameTitle}の開催写真`}
            decoding="async"
            loading="lazy"
            src={photoUrl}
          />
        </figure>
      ) : null}
      {highlight?.text ? (
        <p className="game-highlight-text">{highlight.text}</p>
      ) : null}
    </section>
  );
}
