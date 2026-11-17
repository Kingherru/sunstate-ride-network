/** Compact semantic targets only: prose is deliberately not selected. */
export const COMPACT_TEXT_SELECTOR = [
  '[data-overflow-text]', '.portal-tab-label', '.portal-tab-badge', '.portal-money',
  '.portal-sidebar a > span', '.portal-drawer a > span',
  '.portal-identity p', 'select', 'button', 'a.portal-btn-primary', 'a.portal-btn-secondary',
  '[class*="font-mono"]', '.truncate',
  'button[role="combobox"] > span', '[data-compact-badge]',
].join(',');
export function isMultilineText(label: string) {
  return /address|instructions?|handling|description|notes?|policy|explanation|warning|safety|message body|validation/i.test(label);
}
export function isTextClipped(scrollWidth: number, clientWidth: number) {
  return clientWidth > 0 && scrollWidth > clientWidth + 1;
}