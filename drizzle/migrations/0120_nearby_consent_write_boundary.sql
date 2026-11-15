ALTER FUNCTION public.nearby_profile_guard() SECURITY INVOKER;
DO $$ DECLARE f text;BEGIN
SELECT pg_get_functiondef(oid) INTO f FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='save_nearby_settings';
f:=replace(f,'IF coalesce(_settings->>''state''','IF _enabled AND (coalesce(_settings->>''state''');
f:=replace(f,'(_settings->>''end'')::time THEN','(_settings->>''end'')::time) THEN');
f:=replace(f,'IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(_settings->''days'') d WHERE d!~''^[0-6]$'')','IF _enabled AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(_settings->''days'') d WHERE d!~''^[0-6]$'')');
EXECUTE f;
END $$;