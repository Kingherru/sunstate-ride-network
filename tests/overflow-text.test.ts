import { test, expect } from 'bun:test';
import { COMPACT_TEXT_SELECTOR, isTextClipped, isMultilineText } from '../src/components/portal/overflow-text-rules';
test('only actually clipped visible text receives overflow disclosure', () => {
  expect(isTextClipped(201,100)).toBe(true);
  expect(isTextClipped(100,100)).toBe(false);
  expect(isTextClipped(100,0)).toBe(false);
});
test('ordinary content and labels are not global compact targets', () => {
  const targets = COMPACT_TEXT_SELECTOR.split(',');
  for (const target of ['h1','h2','h3','h4','dd','dt','td','th','.ds-label','.ds-subheading','summary']) expect(targets.includes(target)).toBe(false);
  expect(targets.includes('[data-overflow-text]')).toBe(true);
});
test('address, instructions, notes and explanations stay multiline', () => {
  for (const label of ['Pickup address','Special instructions','Medical Delivery handling','Smart Notes','Verification explanation','Safety warning']) expect(isMultilineText(label)).toBe(true);
  for (const label of ['MFN ID','Assigned driver','Service type','Pickup time']) expect(isMultilineText(label)).toBe(false);
});