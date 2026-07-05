
-- Add new staff roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'app_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'zone_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'dispatcher';
