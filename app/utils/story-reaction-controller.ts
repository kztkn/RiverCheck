import type { GameStoryReactionType } from "@shared-types/game-story-reaction";
export type ReactionState = { active: boolean; count: number };
export type ReactionStore = Record<
  string,
  Partial<Record<GameStoryReactionType, ReactionState>>
>;
export function getReactionState(
  store: ReactionStore,
  post: string,
  type: GameStoryReactionType,
): ReactionState {
  return store[post]?.[type] ?? { active: false, count: 0 };
}
export function setReactionState(
  store: ReactionStore,
  post: string,
  type: GameStoryReactionType,
  value: ReactionState,
): ReactionStore {
  return { ...store, [post]: { ...store[post], [type]: value } };
}
interface Mutation {
  post: string;
  type: GameStoryReactionType;
  desired: boolean;
  confirmed: ReactionState;
}
/** Optimistic taps stay responsive; writes for one stamp are serialized. */
export class StoryReactionController {
  private mutations = new Map<string, Mutation>();
  private stopped = false;
  constructor(
    private store: ReactionStore,
    private save: (
      post: string,
      type: GameStoryReactionType,
      active: boolean,
    ) => Promise<ReactionState>,
    private change: (store: ReactionStore, pending: Set<string>) => void,
    private error: (post: string) => void,
  ) {}
  dispose() {
    this.stopped = true;
  }
  toggle(post: string, type: GameStoryReactionType) {
    if (this.stopped) return;
    const key = `${post}:${type}`;
    const previous = getReactionState(this.store, post, type);
    const desired = !previous.active;
    this.store = setReactionState(this.store, post, type, {
      active: desired,
      count: Math.max(0, previous.count + (desired ? 1 : -1)),
    });
    const existing = this.mutations.get(key);
    if (existing) {
      existing.desired = desired;
      this.emit();
      return;
    }
    const mutation = { post, type, desired, confirmed: previous };
    this.mutations.set(key, mutation);
    this.emit();
    void this.drain(key, mutation);
  }
  private emit() {
    if (!this.stopped) this.change(this.store, new Set(this.mutations.keys()));
  }
  private async drain(key: string, mutation: Mutation) {
    try {
      while (!this.stopped) {
        const sent = mutation.desired;
        const confirmed = await this.save(mutation.post, mutation.type, sent);
        if (this.stopped) return;
        mutation.confirmed = confirmed;
        if (mutation.desired !== sent) continue;
        this.store = setReactionState(
          this.store,
          mutation.post,
          mutation.type,
          confirmed,
        );
        break;
      }
    } catch {
      if (this.stopped) return;
      this.store = setReactionState(
        this.store,
        mutation.post,
        mutation.type,
        mutation.confirmed,
      );
      this.error(mutation.post);
    } finally {
      this.mutations.delete(key);
      this.emit();
    }
  }
}
