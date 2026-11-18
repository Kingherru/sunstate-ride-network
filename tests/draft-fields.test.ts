import { expect, it } from 'vitest';
import { restoreDraftFields } from '../src/lib/draft-fields';
it('restores saved fields from current and legacy drafts without unrelated fields',()=>{
 expect(restoreDraftFields({patient_first_name:'Synthetic',pickupCity:'Tampa',unrelated:'excluded'},['patientFirstName','pickupCity'])).toEqual({patientFirstName:'Synthetic',pickupCity:'Tampa'});
});
it('restores optional linked parties, timing, return and instructions',()=>{
 const payload={selected_provider_workspace_id:'provider',payer_id:'payer',saved_patient_id:'patient',dropoff_date:'2026-11-20',dropoff_time:'10:00',return_date:'2026-11-21',return_pickup_time:'12:00',appointment_time:'10:30',special_instructions:'Keep this note',trip_type:'round_trip',transport_type:'wheelchair'};
 expect(restoreDraftFields(payload,['selectedProviderWorkspaceId','payerId','savedPatientId','dropoffDate','dropoffTime','returnDate','returnPickupTime','appointmentTime','specialInstructions','tripType','transportType'])).toEqual({selectedProviderWorkspaceId:'provider',payerId:'payer',savedPatientId:'patient',dropoffDate:'2026-11-20',dropoffTime:'10:00',returnDate:'2026-11-21',returnPickupTime:'12:00',appointmentTime:'10:30',specialInstructions:'Keep this note',tripType:'round_trip',transportType:'wheelchair'});
});
it('delivery resumes legacy pickup timing as requested timing',()=>{expect(restoreDraftFields({pickupDate:'2026-11-20',pickup_time:'11:00',delivery_instructions:'Upright'},['requestedDate','requestedTime','deliveryInstructions'])).toEqual({requestedDate:'2026-11-20',requestedTime:'11:00',deliveryInstructions:'Upright'});});
it('explicit cleared reference cannot resurrect a legacy reference',()=>{expect(restoreDraftFields({payerId:null,payer_id:'old'},['payerId'])).toEqual({payerId:null});});
