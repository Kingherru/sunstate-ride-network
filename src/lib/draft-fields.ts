/** Restores both current camelCase request drafts and older snake_case drafts. */
export function restoreDraftFields(payload: Record<string, unknown>, keys: string[]) {
  const restored: Record<string, unknown> = {};
  for (const key of keys) {
    const oldKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    const value = payload[key] ?? payload[oldKey];
    if (value !== undefined) restored[key] = value;
  }
  return restored;
}