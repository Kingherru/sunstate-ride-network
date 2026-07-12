ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS payer_id UUID REFERENCES public.payers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS trips_payer_id_idx ON public.trips(payer_id);