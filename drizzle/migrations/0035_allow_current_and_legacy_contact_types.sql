ALTER TABLE public.provider_contacts DROP CONSTRAINT provider_contacts_contact_type_check;
ALTER TABLE public.provider_contacts ADD CONSTRAINT provider_contacts_contact_type_check CHECK (contact_type IN ('patient', 'caregiver', 'facility', 'broker', 'organization', 'personal', 'business', 'payer'));
