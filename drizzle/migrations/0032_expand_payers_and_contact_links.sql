ALTER TABLE public.payers
  ADD COLUMN billing_address text,
  ADD COLUMN ein text,
  ADD COLUMN payer_type text,
  ADD COLUMN active boolean NOT NULL DEFAULT true,
  ADD COLUMN linked_contact_id uuid,
  ADD COLUMN multi_load_ok boolean NOT NULL DEFAULT false,
  ADD COLUMN preferred_driver text,
  ADD COLUMN vehicle_preference text,
  ADD COLUMN pickup_signature_required boolean NOT NULL DEFAULT false,
  ADD COLUMN dropoff_signature_required boolean NOT NULL DEFAULT false,
  ADD COLUMN early_late_preference text,
  ADD COLUMN early_late_minutes integer;

ALTER TABLE public.payers
  ADD CONSTRAINT payers_payer_type_check CHECK (payer_type IS NULL OR payer_type IN ('broker','private_patient','insurance')),
  ADD CONSTRAINT payers_vehicle_preference_check CHECK (vehicle_preference IS NULL OR vehicle_preference IN ('car','suv','van','wheelchair_van','stretcher_van','provider_choice')),
  ADD CONSTRAINT payers_early_late_check CHECK (early_late_preference IS NULL OR early_late_preference IN ('early','late'));

ALTER TABLE public.provider_contacts
  ADD COLUMN payer_id uuid;

COMMENT ON COLUMN public.provider_contacts.payer_id IS 'Optional link to public.payers so a payer contact appears on both Contacts and Payers tabs without duplicating the record.';