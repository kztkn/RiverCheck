import { IconPlus } from "@tabler/icons-react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
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
  {
    type: "respect",
    label: "GG・リスペクト",
    src: "/reactions/fluent-respect.svg",
  },
];

import {
  StoryReactionController,
  getReactionState,
  setReactionState,
  type ReactionStore,
} from "~/utils/story-reaction-controller";

interface ReactionContextValue {
  canReact: boolean;
  loaded: boolean;
  errors: Record<string, string>;
  pending: ReadonlySet<string>;
  store: ReactionStore;
  toggle: (postId: string, type: GameStoryReactionType) => void;
}

const ReactionContext = createContext<ReactionContextValue | null>(null);

export function GameStoryReactionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname =
    typeof window === "undefined" ? "" : window.location.pathname;
  const endpoint = buildGameStoryReactionPath(pathname);
  const [loaded, setLoaded] = useState(false);
  const [canReact, setCanReact] = useState(false);
  const [store, setStore] = useState<ReactionStore>({});
  const [pending, setPending] = useState<Set<string>>(() => new Set());

  const controllerRef = useRef<StoryReactionController | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    controllerRef.current?.dispose();
    controllerRef.current = null;
    setPending(new Set());
    setErrors({});
    setCanReact(false);
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
        if (!response.ok)
          throw new Error(`Reaction load failed: ${response.status}`);
        return response.json() as Promise<{
          canReact: boolean;
          reactions: GameStoryReactionSummary[];
        }>;
      })
      .then((overview) => {
        if (controller.signal.aborted) return;
        setCanReact(overview.canReact);
        const initialStore = buildReactionStore(overview.reactions);
        setStore(initialStore);
        controllerRef.current = new StoryReactionController(
          initialStore,
          async (postId, type, active) => {
            const formData = new FormData();
            formData.set("postId", postId);
            formData.set("reactionType", type);
            formData.set("active", active ? "yes" : "no");
            const response = await fetch(endpoint, {
              method: "POST",
              body: formData,
              headers: { Accept: "application/json" },
              signal: controller.signal,
            });
            const result = (await response.json()) as {
              ok?: unknown;
              active?: unknown;
              count?: unknown;
            } | null;
            if (
              !response.ok ||
              !result ||
              result.ok !== true ||
              typeof result.active !== "boolean" ||
              typeof result.count !== "number" ||
              !Number.isFinite(result.count) ||
              result.count < 0
            )
              throw new Error("Reaction save failed");
            return { active: result.active, count: result.count };
          },
          (next, pendingKeys) => {
            setStore(next);
            setPending(pendingKeys);
          },
          (postId) =>
            setErrors((current) => ({
              ...current,
              [postId]:
                "スタンプを保存できませんでした。もう一度お試しください。",
            })),
        );
        setLoaded(true);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error("Failed to load game story reactions", error);
        setCanReact(false);
        setStore({});
        setLoaded(true);
      });
    return () => {
      controllerRef.current?.dispose();
      controllerRef.current = null;
      controller.abort();
    };
  }, [endpoint]);

  function toggle(postId: string, type: GameStoryReactionType) {
    if (!endpoint || !canReact) return;
    setErrors((current) => {
      const next = { ...current };
      delete next[postId];
      return next;
    });
    controllerRef.current?.toggle(postId, type);
  }

  const value = useMemo(
    () => ({ canReact, loaded, pending, store, toggle, errors }),
    [canReact, loaded, pending, store, errors],
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
    ({ type }) =>
      getReactionState(context.store, postId, type).count > 0 ||
      context.pending.has(reactionKey(postId, type)),
  );
  if (!context.canReact && visible.length === 0) return null;

  return (
    <div className="game-story-reactions">
      {context.errors[postId] ? (
        <p role="alert" className="game-story-reaction-error">
          {context.errors[postId]}
        </p>
      ) : null}
      <div className="game-story-reaction-row">
        {visible.map((reaction) => {
          const state = getReactionState(context.store, postId, reaction.type);
          const isPending = context.pending.has(
            reactionKey(postId, reaction.type),
          );
          return context.canReact ? (
            <button
              aria-pressed={state.active}
              className={`game-story-reaction-chip${state.active ? " is-selected" : ""}`}
              aria-busy={isPending}
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
        <div
          className="game-story-reaction-picker"
          aria-label="リアクションを選択"
        >
          {REACTION_VISUALS.map((reaction) => {
            const state = getReactionState(
              context.store,
              postId,
              reaction.type,
            );
            const isPending = context.pending.has(
              reactionKey(postId, reaction.type),
            );
            return (
              <button
                aria-label={`${reaction.label}${state.active ? "を取り消す" : "を付ける"}`}
                aria-pressed={state.active}
                className={`game-story-reaction-option${state.active ? " is-selected" : ""}`}
                aria-busy={isPending}
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

function ReactionImage({
  reaction,
}: {
  reaction: (typeof REACTION_VISUALS)[number];
}) {
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

function reactionKey(postId: string, type: GameStoryReactionType): string {
  return `${postId}:${type}`;
}
