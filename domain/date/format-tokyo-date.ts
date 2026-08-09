const TOKYO_NUMERIC_DATE_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Tokyo",
});

export function formatTokyoDateNumeric(value: string | Date): string {
  return TOKYO_NUMERIC_DATE_FORMATTER.format(
    typeof value === "string" ? new Date(value) : value,
  );
}
