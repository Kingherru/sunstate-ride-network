import { test, expect } from 'bun:test';
import { columnWidth, fillTableWidths, readTableWidths } from '../src/components/portal/table-width-rules';
test('column resizing respects individual bounds including protected status width', () => {
  const status = { id: 'status', minWidth: 280, maxWidth: 480, width: 290 };
  expect(columnWidth(status, 20)).toBe(280);
  expect(columnWidth(status, 900)).toBe(480);
  expect(columnWidth(status)).toBe(290);
});
test('initial widths fill available space while respecting column bounds', () => {
  expect(fillTableWidths([{id:'name',width:180,maxWidth:400},{id:'status',width:200,maxWidth:300}],{},600)).toEqual([300,300]);
  expect(fillTableWidths([{id:'name',width:180,maxWidth:400},{id:'status',width:200,maxWidth:300}],{status:220},600)).toEqual([380,220]);
  expect(fillTableWidths([{id:'name',minWidth:160},{id:'status',minWidth:280}],{},300)).toEqual([180,280]);
});
test('only recognized numeric width preferences are restored', () => {
  expect(readTableWidths('{"request":240,"email":"private@example.test","unknown":300}', [{id:'request'}])).toEqual({request:240});
  expect(readTableWidths('{bad', [{id:'request'}])).toEqual({});
  expect(readTableWidths('[]', [{id:'request'}])).toEqual({});
});