import {describe,it,expect} from 'vitest';
import {chooseDriver,maskVin,historyColumnsSchema,connectionEventKey,serviceRoles} from '../src/lib/pass4r-rules';
import {portalNavigation,isPortalPathBlocked,ADMIN_NAV} from '../src/components/portal/portal-nav';
describe('Pass 4R boundaries',()=>{
 it('prefers the saved active eligible driver over completed history',()=>expect(chooseDriver('preferred','previous',['preferred','previous'])).toBe('preferred'));
 it('falls back to the latest completed driver when preference unavailable',()=>expect(chooseDriver('inactive','completed',['completed'])).toBe('completed'));
 it('leaves unassigned when neither eligible driver exists',()=>expect(chooseDriver('inactive','inactive2',[])).toBeNull());
 it('masks full VIN outside editing',()=>expect(maskVin('1HGCM82633A004352')).toBe('•••••••••••••4352'));
 it('never allows essential row actions to be hidden',()=>expect(historyColumnsSchema.safeParse({hidden:['actions'],widths:{}}).success).toBe(false));
 it('rejects unsafe column widths',()=>expect(historyColumnsSchema.safeParse({hidden:[],widths:{date:999}}).success).toBe(false));
 it('uses one stable accepted event per recipient',()=>expect(connectionEventKey('relationship','recipient')).toBe('accepted-connection:relationship:recipient'));
 it('isolates accepted event recipient keys',()=>expect(connectionEventKey('r','a')).not.toBe(connectionEventKey('r','b')));
 it('adds medical delivery role without removing existing subtype choices',()=>expect(serviceRoles).toEqual(['nemt_business','independent_contractor','medical_delivery_driver']));
 it('provider People is never a customer-only blocked page',()=>expect(isPortalPathBlocked('/portal/contacts',{portalKind:'provider',restricted:false,canMessageForWorkspace:true,canUploadCsvRequests:false})).toBe(false));
 it('provider primary navigation retains fleet Network and People',()=>expect(portalNavigation({portalKind:'provider',restricted:false,canMessageForWorkspace:true,canUploadCsvRequests:false}).map(n=>n.to)).toEqual(expect.arrayContaining(['/portal/contacts','/portal/network','/portal/fleet','/portal/trips','/portal/schedule','/portal/training','/portal/messaging'])));
 it('removes redundant admin main Training entry',()=>expect(ADMIN_NAV.some(n=>n.to==='/admin/training')).toBe(false));
});