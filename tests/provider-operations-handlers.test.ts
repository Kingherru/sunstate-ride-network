import {describe,it,expect,vi} from 'vitest';
vi.mock('@tanstack/react-start',()=>({createServerFn:()=>{const b:any={middleware:()=>b,inputValidator:()=>b,handler:(h:any)=>h};return b;}}));
vi.mock('../src/integrations/supabase/auth-middleware',()=>({requireSupabaseAuth:{}}));
import {changeProviderSubtype} from '../src/lib/provider-setup.functions';
import {getDriverSuggestion} from '../src/lib/pass4r.functions';
describe('provider operation handlers',()=>{
 it('persists confirmed subtype only through the owner-validated RPC',async()=>{const rpc=vi.fn(async()=>({error:null}));await (changeProviderSubtype as any)({data:{workspaceId:'own',subtype:'independent_contractor',confirmed:true},context:{supabase:{rpc}}});expect(rpc).toHaveBeenCalledWith('change_provider_subtype',{_ws:'own',_subtype:'independent_contractor',_confirmed:true});});
 it('denied subtype persistence cannot report success',async()=>{await expect((changeProviderSubtype as any)({data:{workspaceId:'foreign',subtype:'independent_contractor',confirmed:true},context:{supabase:{rpc:async()=>({error:{}})}}})).rejects.toThrow('owner');});
 it('suggestion reads never write trips or assignments',async()=>{const rpc=vi.fn(async()=>({data:{driverId:null,options:[],warning:'No eligible preferred driver'},error:null}));const out=await (getDriverSuggestion as any)({data:{patientId:'patient',service:'ambulatory',date:'2026-11-14'},context:{supabase:{rpc}}});expect(out.driverId).toBeNull();expect(rpc).toHaveBeenCalledTimes(1);expect(rpc).toHaveBeenCalledWith('patient_driver_suggestion',{_patient:'patient',_service:'ambulatory',_date:'2026-11-14'});});
});