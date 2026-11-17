export type TableColumnSizing = { id: string; minWidth?: number; maxWidth?: number; width?: number };
export function columnWidth(column: TableColumnSizing, value?: number) {
  const min = column.minWidth ?? 120;
  const max = Math.max(min, column.maxWidth ?? 520);
  return Math.min(max, Math.max(min, Math.round(Number.isFinite(value) ? Number(value) : column.width ?? 180)));
}
/** Persist presentation only; unknown keys and nonnumeric/invalid values are discarded. */
export function readTableWidths(raw: string | null, columns: TableColumnSizing[]): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(raw ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(columns.flatMap(column => {
      const value = (parsed as Record<string, unknown>)[column.id];
      return typeof value === 'number' && Number.isFinite(value) ? [[column.id, columnWidth(column, value)]] : [];
    }));
  } catch { return {}; }
}