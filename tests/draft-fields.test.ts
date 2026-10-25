import { expect, it } from 'vitest';
import { restoreDraftFields } from '../src/lib/draft-fields';
it('restores saved fields from current and legacy drafts without unrelated fields',()=>{
 expect(restoreDraftFields({patient_first_name:'Synthetic',pickupCity:'Tampa',unrelated:'excluded'},['patientFirstName','pickupCity'])).toEqual({patientFirstName:'Synthetic',pickupCity:'Tampa'});
});