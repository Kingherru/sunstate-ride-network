/** Compact semantic targets only: prose is deliberately not selected. */
export const COMPACT_TEXT_SELECTOR = [
  '[data-overflow-text]', 'h1', 'h2', 'h3', 'h4', 'th', 'td', 'dt', 'dd',
  '.portal-label', '.portal-tab-label', '.portal-tab-badge', '.portal-money',
  'label > span:first-child', 'label:not(:has(input,select,textarea))',
  '.portal-sidebar a > span', '.portal-drawer a > span',
  '.portal-identity p', 'select', 'button', 'a.portal-btn-primary', 'a.portal-btn-secondary',
  '[class*="font-mono"]', '.ds-label', '.truncate', '.ds-subheading', 'summary',
  'button[role="combobox"] > span', '[data-compact-badge]',
  'label:has(> input[type="checkbox"]) > span', 'label:has(> input[type="radio"]) > span',
].join(',');
export function isMultilineText(label: string) {
  return /address|instructions?|handling|description|notes?|policy|explanation|warning|safety|message body|validation/i.test(label);
}
export function isTextClipped(scrollWidth: number, clientWidth: number) {
  return clientWidth > 0 && scrollWidth > clientWidth + 1;
}