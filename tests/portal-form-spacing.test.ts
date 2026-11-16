import { test, expect } from 'bun:test';
import { increasedPadding } from '../src/components/portal/form-spacing-rules';

test('each existing internal padding value increases by exactly one pixel', () => {
  expect(increasedPadding('12px')).toBe(13);
  expect(increasedPadding('16px')).toBe(17);
  expect(increasedPadding('44px')).toBe(45);
  expect(increasedPadding('0px')).toBe(1);
  expect(increasedPadding('6.5px')).toBe(7.5);
});