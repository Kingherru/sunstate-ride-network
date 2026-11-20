import {DsField,DsInput,DsSelect} from '@/components/ds/controls';
import {US_STATES,US_TIMEZONES} from '@/lib/us-geography';
type AddressFields={pickupState?:string;dropoffState?:string;pickupZip?:string;dropoffZip?:string;pickupCounty?:string;dropoffCounty?:string;pickupTimezone?:string;dropoffTimezone?:string};
export function RegionalAddressFields({value,side,onChange,hideTimezone=false}:{hideTimezone?:boolean;value:AddressFields;side:'pickup'|'dropoff';onChange:(fields:AddressFields)=>void}){
 const state=side==='pickup'?value.pickupState:value.dropoffState;
 return <div className="grid gap-3 sm:grid-cols-2 [&_label]:font-bold [&_label]:text-ds-primary">
 <DsField label={`${side==='pickup'?'Pickup':'Destination'} state`}>{p=><DsSelect {...p} value={state??''} onChange={e=>onChange({[`${side}State`]:e.target.value,[`${side}County`]:'',[`${side}Timezone`]:''})}><option value="">Select state</option>{US_STATES.map(s=><option key={s.code} value={s.code}>{s.name}</option>)}</DsSelect>}</DsField>
 <DsField label="ZIP / postal code">{p=><DsInput {...p} value={value[`${side}Zip`]??''} maxLength={10} onChange={e=>onChange({[`${side}Zip`]:e.target.value})}/>}</DsField>
 <details className="sm:col-span-2"><summary className="ds-label cursor-pointer">Advanced location & local time</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><DsField label="County" hint="Selected information — subject to review.">{p=><DsInput {...p} value={value[`${side}County`]??''} maxLength={120} onChange={e=>onChange({[`${side}County`]:e.target.value})}/>}</DsField>
 {!hideTimezone && <DsField label={`${side==='pickup'?'Pickup':'Destination'} timezone`} hint="Leave unknown for review; local times are not converted.">{p=><DsSelect {...p} value={value[`${side}Timezone`]??''} onChange={e=>onChange({[`${side}Timezone`]:e.target.value})}><option value="">Unknown — review required</option>{US_TIMEZONES.map(z=><option key={z} value={z}>{z.split('/').at(-1)?.replaceAll('_',' ')} local time</option>)}</DsSelect>}</DsField>}
 </div></details></div>;
}