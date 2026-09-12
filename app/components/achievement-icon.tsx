import {
  IconArrowsUpDown,
  IconBolt,
  IconCards,
  IconRosetteDiscountCheck,
  IconCalendarCheck,
  IconFlame,
  IconHeart,
  IconLock,
  IconNotes,
  IconRefresh,
  IconTrendingUp,
  IconTrophy,
} from "@tabler/icons-react";
import type { AchievementIconKey } from "@shared-types/achievement";

export function AchievementIcon({
  iconKey,
  locked = false,
}: {
  iconKey: AchievementIconKey;
  locked?: boolean;
}) {
  if (locked) return <IconLock aria-hidden="true" />;
  const Icon = {
    trophy: IconTrophy,
    flame: IconFlame,
    "calendar-check": IconCalendarCheck,
    "trending-up": IconTrendingUp,
    "badge-check": IconRosetteDiscountCheck,
    cards: IconCards,
    bolt: IconBolt,
    refresh: IconRefresh,
    notes: IconNotes,
    heart: IconHeart,
    "arrows-up-down": IconArrowsUpDown,
  }[iconKey];
  return <Icon aria-hidden="true" />;
}
