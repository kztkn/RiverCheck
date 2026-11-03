// Absolute instants keep the promotion independent of the server's timezone.
const START_AT = Date.parse("2026-12-01T00:00:00+09:00");
const END_AT = Date.parse("2027-02-01T00:00:00+09:00");

export function isYearRecapPromotionVisible(now: Date): boolean {
  return now.getTime() >= START_AT && now.getTime() < END_AT;
}
