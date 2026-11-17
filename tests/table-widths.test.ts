import { test, expect } from 'bun:test';
import { columnWidth, readTableWidths } from '../src/components/portal/table-width-rules';
test('column resizing respects individual bounds including protected status width', () => {
  const status = { id: 'status', minWidth: 280, maxWidth: 480, width: 290 };
  expect(columnWidth(status, 20)).toBe(280);
  expect(columnWidth(status, 900)).toBe(480);
  expect(columnWidth(status)).toBe(290);
});
test('only recognized numeric width preferences are restored', () => {
  expect(readTableWidths('{"request":240,"email":"private@example.test","unknown":300}', [{id:'request'}])).toEqual({request:240});
  expect(readTableWidths('{bad', [{id:'request'}])).toEqual({});
  expect(readTableWidths('[]', [{id:'request'}])).toEqual({});
});