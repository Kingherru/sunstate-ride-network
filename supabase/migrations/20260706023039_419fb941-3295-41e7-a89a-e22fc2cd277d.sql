ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS work_hours_weekly jsonb NOT NULL DEFAULT jsonb_build_object(
    '0', jsonb_build_object('start','06:00','end','20:00','closed',true),
    '1', jsonb_build_object('start','06:00','end','20:00','closed',false),
    '2', jsonb_build_object('start','06:00','end','20:00','closed',false),
    '3', jsonb_build_object('start','06:00','end','20:00','closed',false),
    '4', jsonb_build_object('start','06:00','end','20:00','closed',false),
    '5', jsonb_build_object('start','06:00','end','20:00','closed',false),
    '6', jsonb_build_object('start','06:00','end','20:00','closed',true)
  );