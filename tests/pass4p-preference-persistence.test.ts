import { describe,it,expect,vi } from 'vitest';
vi.mock('@tanstack/react-start',()=>({createServerFn:()=>{const b:any={middleware:()=>b,inputValidator:()=>b,handler:(h:any)=>h};return b;}}));
vi.mock('../src/integrations/supabase/auth-middleware',()=>({requireSupabaseAuth:{}}));
import {savePortalPreferences,getPortalPreferences} from '../src/lib/portal-preferences.functions';
describe('person scoped accessibility persistence',()=>{
 it('writes only the authenticated person and reads both settings back',async()=>{
  let stored:any=null;
  const query:any={select:()=>query,eq:()=>query,is:()=>Promise.resolve({data:[]}),maybeSingle:()=>Promise.resolve({data:stored}),upsert:vi.fn(async(row:any)=>{stored=row;return {error:null};})};
  const context={userId:'synthetic-owner',supabase:{from:()=>query}};
  await (savePortalPreferences as any)({data:{interface_density:'extra_large',high_contrast:true,user_id:'unrelated-person'},context});
  expect(query.upsert.mock.calls[0][0].user_id).toBe('synthetic-owner');
  const out=await (getPortalPreferences as any)({context});expect(out.interface_density).toBe('extra_large');expect(out.high_contrast).toBe(true);
 });
 it('reset stores Default without touching other preference fields',async()=>{
  const upsert=vi.fn(async()=>({error:null}));await (savePortalPreferences as any)({data:{interface_density:'standard',high_contrast:false},context:{userId:'owner',supabase:{from:()=>({upsert})}}});
  expect(upsert.mock.calls[0][0]).toMatchObject({user_id:'owner',interface_density:'standard',high_contrast:false});expect(upsert.mock.calls[0][0]).not.toHaveProperty('page_after_sign_in');
 });
});