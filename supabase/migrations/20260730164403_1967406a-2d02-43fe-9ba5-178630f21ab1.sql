CREATE OR REPLACE FUNCTION public.notify_dispatch_on_new_trip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_email text;
  v_title text;
  v_body text;
BEGIN
  v_title := 'New trip in dispatch queue';
  v_body := 'Trip ' || COALESCE(NEW.display_id, NEW.id::text) ||
            ' on ' || NEW.pickup_date || ' at ' || NEW.pickup_time || ' needs assignment.';

  FOR r IN
    SELECT DISTINCT user_id FROM public.user_roles
     WHERE role IN ('admin','app_manager','dispatcher')
    UNION
    SELECT DISTINCT zma.user_id FROM public.zone_manager_assignments zma
     WHERE NEW.dispatch_zone_id IS NOT NULL AND zma.zone_id = NEW.dispatch_zone_id
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (r.user_id, 'trip_new', v_title, v_body, '/admin?tab=dispatch');

    -- Prefer the contact email saved on the staff member's account profile.
    SELECT COALESCE(NULLIF(btrim(mp.dispatch_email), ''), u.email)
      INTO v_email
      FROM auth.users u
      LEFT JOIN public.member_profiles mp ON mp.user_id = u.id
     WHERE u.id = r.user_id;

    IF v_email IS NOT NULL THEN
      INSERT INTO public.notification_email_queue (recipient_email, subject, body)
      VALUES (v_email, v_title, v_body || E'\n\nOpen dispatch: /admin?tab=dispatch');
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;