/** Restores both current camelCase request drafts and older snake_case drafts. */
export function restoreDraftFields(payload: Record<string, unknown>, keys: string[]) {
  const restored: Record<string, unknown> = {};
  for (const key of keys) {
    const oldKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    const legacyAliases: Record<string, string[]> = {
      requestedDate: ['pickupDate', 'pickup_date'], requestedTime: ['pickupTime', 'pickup_time'],
      pickupDate: ['requestedDate', 'requested_date'], pickupTime: ['requestedTime', 'requested_time'],
    };
    const alias = legacyAliases[key]?.find(name => payload[name] !== undefined);
    const value = Object.hasOwn(payload, key) ? payload[key] : Object.hasOwn(payload, oldKey) ? payload[oldKey] : alias ? payload[alias] : undefined;
    if (value !== undefined) restored[key] = value;
  }
  return restored;
}