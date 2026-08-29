import { IconPlus } from "@tabler/icons-react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { GAME_STORY_REACTION_TYPES } from "@domain/story/game-story-reaction";
import type {
  GameStoryReactionSummary,
  GameStoryReactionType,
} from "@shared-types/game-story-reaction";

const REACTION_VISUALS: ReadonlyArray<{
  label: string;
  src: string;
  type: GameStoryReactionType;
}> = [
  { type: "laugh", label: "爆笑", src: "/reactions/fluent-laugh.svg" },
  { type: "fire", label: "熱い", src: "/reactions/fluent-fire.svg" },
  { type: "shock", label: "えぐい", src: "/reactions/fluent-shock.svg" },
  { type: "nice", label: "ナイス", src: "/reactions/fluent-nice.svg" },
  { type: "respect", label: "GG・リスペクト", src: "/reactions/fluent-respect.svg" },
];

type ReactionState = { active: boolean; count: number };
type ReactionStore = Record<
  string,
  Partial<Record<GameStoryReactionType, ReactionState>>
>;

interface ReactionContextValue {
  canReact: boolean;
  loaded: boolean;
  pending: ReadonlySet<string>;
  store: ReactionStore;
  toggle: (postId: string, type: GameStoryReactionType) => void;
}

const ReactionContext = createContext<ReactionContextValue | null>(null);

export function GameStoryReactionProvider({ children }: { children: ReactNode }) {
  const pathname = typeof window === "undefined" ? "" : window.location.pathname;
  const endpoint = buildGameStoryReactionPath(pathname);
  const [loaded, setLoaded] = useState(false);
  const [canReact, setCanReact] = useState(false);
  const [store, setStore] = useState<ReactionStore>({});
  const [pending, setPending] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!endpoint) {
      setLoaded(true);
      setCanReact(false);
      setStore({});
      return;
    }
    const controller = new AbortController();
    setLoaded(false);
    setStore({});
    void fetch(endpoint, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Reaction load failed: ${response.status}`);
        return response.json() as Promise<{
          canReact: boolean;
          reactions: GameStoryReactionSummary[];
        }>;
      })
      .then((overview) => {
        if (controller.signal.aborted) return;
        setCanReact(overview.canReact);
        setStore(buildReactionStore(overview.reactions));
        setLoaded(true);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error("Failed to load game story reactions", error);
        setCanReact(false);
        setStore({});
        setLoaded(true);
      });
    return () => controller.abort();
  }, [endpoint]);

  function toggle(postId: string, type: GameStoryReactionType) {
    if (!endpoint || !canReact) return;
    const key = reactionKey(postId, type);
    if (pending.has(key)) return;
    const previous = getReactionState(store, postId, type);
    const desired = !previous.active;

    setStore((current) =>
      setReactionState(current, postId, type, {
        active: desired,
        count: Math.max(0, previous.count + (desired ? 1 : -1)),
      }),
    );
    setPending((current) => new Set(current).add(key));

    const formData = new FormData();
    formData.set("postId", postId);
    formData.set("reactionType", type);
    formData.set("active", desired ? "yes" : "no");
    void fetch(endpoint, {
      method: "POST",
      body: formData,
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const data = await response.json() as {
          ok: boolean;
          active?: boolean;
          count?: number;
          error?: string;
        };
        if (!response.ok || !data.ok || typeof data.count !== "number") {
          throw new Error(data.error ?? `Reaction save failed: ${response.status}`);
        }
        setStore((current) =>
          setReactionState(current, postId, type, {
            active: Boolean(data.active),
            count: data.count ?? 0,
          }),
        );
      })
      .catch((error) => {
        console.error("Failed to save game story reaction", error);
        setStore((current) =>
          setReactionState(current, postId, type, previous),
        );
      })
      .finally(() => {
        setPending((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
      });
  }

  const value = useMemo(
    () => ({ canReact, loaded, pending, store, toggle }),
    [canReact, loaded, pending, store],
  );
  return (
    <ReactionContext.Provider value={value}>
      {children}
    </ReactionContext.Provider>
  );
}

export function GameStoryReactionBar({ postId }: { postId: string }) {
  const context = useContext(ReactionContext);
  const [pickerOpen, setPickerOpen] = useState(false);
  if (!context?.loaded) return null;

  const visible = REACTION_VISUALS.filter(
    ({ type }) => getReactionState(context.store, postId, type).count > 0,
  );
  if (!context.canReact && visible.length === 0) return null;

  return (
    <div className="game-story-reactions">
      <div className="game-story-reaction-row">
        {visible.map((reaction) => {
          const state = getReactionState(context.store, postId, reaction.type);
          const isPending = context.pending.has(reactionKey(postId, reaction.type));
          return context.canReact ? (
            <button
              aria-pressed={state.active}
              className={`game-story-reaction-chip${state.active ? " is-selected" : ""}`}
              disabled={isPending}
              key={reaction.type}
              onClick={() => context.toggle(postId, reaction.type)}
              title={reaction.label}
              type="button"
            >
              <ReactionImage reaction={reaction} />
              <span>{state.count}</span>
            </button>
          ) : (
            <span className="game-story-reaction-chip" key={reaction.type}>
              <ReactionImage reaction={reaction} />
              <span>{state.count}</span>
            </span>
          );
        })}
        {context.canReact ? (
          <button
            aria-expanded={pickerOpen}
            aria-label="リアクションを追加"
            className="game-story-reaction-add"
            onClick={() => setPickerOpen((current) => !current)}
            type="button"
          >
            <IconPlus aria-hidden="true" stroke={2} />
          </button>
        ) : null}
      </div>
      {context.canReact && pickerOpen ? (
        <div className="game-story-reaction-picker" aria-label="リアクションを選択">
          {REACTION_VISUALS.map((reaction) => {
            const state = getReactionState(context.store, postId, reaction.type);
            const isPending = context.pending.has(reactionKey(postId, reaction.type));
            return (
              <button
                aria-label={`${reaction.label}${state.active ? "を取り消す" : "を付ける"}`}
                aria-pressed={state.active}
                className={`game-story-reaction-option${state.active ? " is-selected" : ""}`}
                disabled={isPending}
                key={reaction.type}
                onClick={() => context.toggle(postId, reaction.type)}
                title={reaction.label}
                type="button"
              >
                <ReactionImage reaction={reaction} />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ReactionImage({ reaction }: { reaction: (typeof REACTION_VISUALS)[number] }) {
  return (
    <img
      alt=""
      aria-hidden="true"
      className="game-story-reaction-icon"
      draggable={false}
      src={reaction.src}
    />
  );
}

export function buildGameStoryReactionPath(pathname: string): string | null {
  const normalized = pathname.replace(/\/$/u, "");
  return /^\/g\/[^/]+\/games\/[^/]+$/u.test(normalized)
    ? `${normalized}/story-reactions`
    : null;
}

export function buildReactionStore(
  summaries: GameStoryReactionSummary[],
): ReactionStore {
  let store: ReactionStore = {};
  for (const summary of summaries) {
    if (!GAME_STORY_REACTION_TYPES.includes(summary.type)) continue;
    store = setReactionState(store, summary.postId, summary.type, {
      active: summary.reactedByCurrentPlayer,
      count: summary.count,
    });
  }
  return store;
}

function getReactionState(
  store: ReactionStore,
  postId: string,
  type: GameStoryReactionType,
): ReactionState {
  return store[postId]?.[type] ?? { active: false, count: 0 };
}

function setReactionState(
  store: ReactionStore,
  postId: string,
  type: GameStoryReactionType,
  value: ReactionState,
): ReactionStore {
  return {
    ...store,
    [postId]: {
      ...store[postId],
      [type]: value,
    },
  };
}

function reactionKey(postId: string, type: GameStoryReactionType): string {
  return `${postId}:${type}`;
}
