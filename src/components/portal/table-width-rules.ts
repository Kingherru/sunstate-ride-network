export type TableColumnSizing = { id: string; minWidth?: number; maxWidth?: number; width?: number };
export function columnWidth(column: TableColumnSizing, value?: number) {
  const min = column.minWidth ?? 120;
  const max = Math.max(min, column.maxWidth ?? 520);
  return Math.min(max, Math.max(min, Math.round(Number.isFinite(value) ? Number(value) : column.width ?? 180)));
}
/** Share spare desktop space among unsaved columns without exceeding their bounds. */
export function fillTableWidths(columns: TableColumnSizing[], widths: Record<string, number>, available: number): number[] {
  const sizes = columns.map(column => columnWidth(column, widths[column.id]));
  let spare = Math.max(0, Math.floor(available) - sizes.reduce((sum, size) => sum + size, 0));
  while (spare > 0) {
    const flexible = columns.flatMap((column, index) => widths[column.id] === undefined && sizes[index] < (column.maxWidth ?? 520) ? [index] : []);
    if (!flexible.length) break;
    const share = Math.max(1, Math.floor(spare / flexible.length));
    for (const index of flexible) {
      const growth = Math.min(spare, share, (columns[index].maxWidth ?? 520) - sizes[index]);
      sizes[index] += growth; spare -= growth;
    }
  }
  return sizes;
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