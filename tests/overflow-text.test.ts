import { test, expect } from 'bun:test';
import { isTextClipped, isMultilineText } from '../src/components/portal/overflow-text-rules';
test('only actually clipped visible text receives overflow disclosure', () => {
  expect(isTextClipped(201,100)).toBe(true);
  expect(isTextClipped(100,100)).toBe(false);
  expect(isTextClipped(100,0)).toBe(false);
});
test('address, instructions, notes and explanations stay multiline', () => {
  for (const label of ['Pickup address','Special instructions','Medical Delivery handling','Smart Notes','Verification explanation','Safety warning']) expect(isMultilineText(label)).toBe(true);
  for (const label of ['MFN ID','Assigned driver','Service type','Pickup time']) expect(isMultilineText(label)).toBe(false);
});