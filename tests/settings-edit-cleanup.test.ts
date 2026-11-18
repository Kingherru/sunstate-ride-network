import { expect, it, vi } from 'vitest';
vi.mock('@tanstack/react-start', () => ({ createServerFn: () => { const builder: any = { middleware: () => builder, inputValidator: () => builder, handler: (handler: any) => handler }; return builder; } }));
vi.mock('../src/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));
import { getRecordEditAccess } from '../src/lib/record-edit.functions';
import { upsertContact } from '../src/lib/crm.functions';
import { updateSavedPatient } from '../src/lib/saved-patients.functions';
import { saveNetworkProfile } from '../src/lib/facility-providers.functions';
import { saveCustomerPricing } from '../src/lib/provider-customer-pricing.functions';
import { saveBusinessSettings } from '../src/lib/business-settings.functions';
import { serviceAreaSchema } from '../src/lib/us-geography';

function query(result: unknown, error: unknown = null) {
  const chain: any = {};
  for (const method of ['update','insert','upsert','eq','select','order','is']) chain[method] = vi.fn(() => chain);
  chain.single = vi.fn(async () => ({data:result,error}));
  chain.then = (resolve: any) => resolve({data:result,error});
  return chain;
}
it('Edit projection uses current manage capability for each record, not readable workspace identity', async () => {
  const rows = query([{id:'managed',workspace_id:'workspace'},{id:'read-only',workspace_id:'workspace'},{id:'legacy',workspace_id:null}]);
  const rpc = vi.fn(async (_name: string, args: any) => ({data:args._id === 'managed',error:null}));
  const result = await (getRecordEditAccess as any)({data:{kind:'contacts'},context:{supabase:{from:()=>rows,rpc}}});
  expect(result.ids).toEqual(['managed']);
  expect(rpc).toHaveBeenCalledWith('business_record_access',{_ws:'workspace',_kind:'contacts',_id:'read-only',_level:'manage'});
});
it('permission failures hide Edit instead of assuming a role grants access', async () => {
  const rows = query([{id:'driver',workspace_id:'workspace'}]);
  const result = await (getRecordEditAccess as any)({data:{kind:'drivers'},context:{supabase:{from:()=>rows,rpc:async()=>({data:true,error:{message:'denied'}})}}});
  expect(result.ids).toEqual([]);
});
it('existing contact edits update the same active ID and never create a replacement', async () => {
  const row = query({id:'contact'});
  await (upsertContact as any)({data:{id:'contact',first_name:'Dana',payer_id:null},context:{userId:'owner',supabase:{from:()=>row}}});
  expect(row.eq).toHaveBeenCalledWith('id','contact');
  expect(row.eq).toHaveBeenCalledWith('active',true);
  expect(row.insert).not.toHaveBeenCalled();
});
it('missing or denied contact edit fails instead of falling through to insert', async () => {
  const row = query(null,{message:'missing or denied'});
  await expect((upsertContact as any)({data:{id:'missing',payer_id:null},context:{userId:'owner',supabase:{from:()=>row}}})).rejects.toEqual({message:'missing or denied'});
  expect(row.insert).not.toHaveBeenCalled();
});
it('patient edits require the selected active record and never create a duplicate', async () => {
  const row = query(null,{message:'unavailable'});
  await expect((updateSavedPatient as any)({data:{id:'patient',first_name:'Pat',last_name:'Patient'},context:{userId:'owner',supabase:{from:()=>row}}})).rejects.toThrow('Could not update');
  expect(row.eq).toHaveBeenCalledWith('id','patient');
  expect(row.eq).toHaveBeenCalledWith('active',true);
  expect(row.insert).not.toHaveBeenCalled();
});
it('denied provider services save leaves existing profile untouched and cannot report success', async () => {
  const from=vi.fn();
  const result = await (saveNetworkProfile as any)({data:{workspace_id:'workspace'},context:{userId:'reader',supabase:{rpc:async()=>({data:false}),from}}});
  expect(result).toEqual({ok:false,error:'Active provider manager required.'});
  expect(from).not.toHaveBeenCalled();
});
it('pricing saves retain the reviewed version and existing authenticated RPC', async () => {
  const rpc=vi.fn(async()=>({error:null}));
  await (saveCustomerPricing as any)({data:{workspaceId:'workspace',rates:{},expectedVersion:7,confirmed:true},context:{supabase:{rpc}}});
  expect(rpc.mock.calls[0]?.[0]).toBe('save_provider_customer_pricing');
  expect(rpc.mock.calls[0]?.[1]).toMatchObject({_workspace:'workspace',_expected_version:7,_confirmed:true});
});
it('invalid service radius cannot be saved', () => {
  expect(serviceAreaSchema.safeParse({areas:[],crossState:false,radius:201}).success).toBe(false);
  expect(serviceAreaSchema.safeParse({areas:[],crossState:false,radius:50}).success).toBe(true);
});
it('denied business save rejects without returning success', async () => {
  await expect((saveBusinessSettings as any)({data:{workspaceId:'workspace',details:{display_name:'Unsaved'}},context:{supabase:{rpc:async()=>({error:{message:'denied'}})}}})).rejects.toThrow('could not be saved');
});
it('denied or stale pricing save never reports success', async () => {
  await expect((saveCustomerPricing as any)({data:{workspaceId:'workspace',rates:{},expectedVersion:7,confirmed:true},context:{supabase:{rpc:async()=>({error:{message:'stale version'}})}}})).rejects.toThrow('Rates could not be saved');
});