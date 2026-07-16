ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS referral_fee_type text CHECK (referral_fee_type IN ('flat','percent')),
  ADD COLUMN IF NOT EXISTS referral_fee_amount numeric(10,2) CHECK (referral_fee_amount IS NULL OR referral_fee_amount >= 0);