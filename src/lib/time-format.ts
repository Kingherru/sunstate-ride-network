/**
 * Consistent 12-hour clock formatting helpers used across all portals.
 * Backend stores times as HH:MM[:SS] (24h) and dates as YYYY-MM-DD.
 */

export function formatTime12(t?: string | null): string {
  if (!t) return "";
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t).trim());
  if (!m) return String(t);
  let h = Number(m[1]);
  const mm = m[2];
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${mm} ${period}`;
}

export function formatDateLong(d?: string | null): string {
  if (!d) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d).trim());
  if (!m) return String(d);
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime12(d?: string | null, t?: string | null): string {
  const dd = formatDateLong(d);
  const tt = formatTime12(t);
  return [dd, tt].filter(Boolean).join(" · ");
}

export function formatIsoDateTime12(iso?: string | null): string {
  if (!iso) return "";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}
