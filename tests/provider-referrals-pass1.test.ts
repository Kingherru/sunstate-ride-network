import {expect,it} from 'vitest';
import {matchesReservationCategory,groupReservations,reservationCategory} from '../src/lib/provider-reservation-groups';
const owned={id:'owned',source_workspace_id:'workspace'};
const sent={id:'sent',source_workspace_id:'workspace',network_distribution_id:'distribution'};
const received={id:'received',source_workspace_id:'other',network_provider_workspace_id:'workspace',network_distribution_id:'other-distribution'};
it('combined Referrals includes sent and received but never owned trips',()=>{
  expect([owned,sent,received].filter(r=>matchesReservationCategory(r,'referrals','workspace','user')).map(r=>r.id)).toEqual(['sent','received']);
});
it('combining the classified referrals does not duplicate records or lose direction',()=>{
  const groups=groupReservations([owned,sent,received,sent],'workspace','user');
  expect([...groups.sent,...groups.received].map(r=>[r.id,reservationCategory(r,'workspace','user')])).toEqual([['sent','sent'],['received','received']]);
});
it('sender ownership takes precedence when receiver metadata is also present',()=>{
  expect(reservationCategory({...sent,network_provider_workspace_id:'workspace'},'workspace','user')).toBe('sent');
});
it('owned presentation excludes both referral directions',()=>{
  expect([owned,sent,received].filter(r=>matchesReservationCategory(r,'owned','workspace','user')).map(r=>r.id)).toEqual(['owned']);
});