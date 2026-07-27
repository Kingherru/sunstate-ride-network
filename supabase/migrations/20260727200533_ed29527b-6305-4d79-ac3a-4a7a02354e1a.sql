-- 1) Reconcile current values: platform_settings.platform_fee_pct is the admin-editable UI value.
UPDATE public.fin_settings
   SET platform_fee_bps = GREATEST(0, ROUND((SELECT platform_fee_pct FROM public.platform_settings WHERE id = true) * 10000)::int)
 WHERE id = true;

-- 2) Trigger: platform_settings -> fin_settings (pct to bps)
CREATE OR REPLACE FUNCTION public.sync_platform_fee_to_fin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_bps int;
BEGIN
  IF NEW.platform_fee_pct IS DISTINCT FROM OLD.platform_fee_pct THEN
    v_bps := GREATEST(0, ROUND(COALESCE(NEW.platform_fee_pct, 0) * 10000)::int);
    UPDATE public.fin_settings
       SET platform_fee_bps = v_bps
     WHERE id = true
       AND platform_fee_bps IS DISTINCT FROM v_bps;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_platform_fee_to_fin ON public.platform_settings;
CREATE TRIGGER trg_sync_platform_fee_to_fin
AFTER UPDATE OF platform_fee_pct ON public.platform_settings
FOR EACH ROW EXECUTE FUNCTION public.sync_platform_fee_to_fin();

-- 3) Trigger: fin_settings -> platform_settings (bps to pct)
CREATE OR REPLACE FUNCTION public.sync_fin_fee_to_platform()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pct numeric;
BEGIN
  IF NEW.platform_fee_bps IS DISTINCT FROM OLD.platform_fee_bps THEN
    v_pct := ROUND((COALESCE(NEW.platform_fee_bps, 0)::numeric / 10000.0)::numeric, 4);
    UPDATE public.platform_settings
       SET platform_fee_pct = v_pct
     WHERE id = true
       AND platform_fee_pct IS DISTINCT FROM v_pct;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_fin_fee_to_platform ON public.fin_settings;
CREATE TRIGGER trg_sync_fin_fee_to_platform
AFTER UPDATE OF platform_fee_bps ON public.fin_settings
FOR EACH ROW EXECUTE FUNCTION public.sync_fin_fee_to_platform();