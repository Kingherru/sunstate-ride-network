
-- ============================================================================
-- ride_requests: field-level authorization by role
-- ============================================================================
-- Row-level policies keep saying "you may update this row"; this trigger says
-- "you may update these columns". Anything financial, administrative, or audit
-- related is locked to admins/staff, even for the assigned provider or the
-- requester. Providers assigned to a request may only touch workflow columns.

CREATE OR REPLACE FUNCTION public.ride_requests_enforce_field_authorization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  is_admin boolean := false;
  is_staff boolean := false;
  is_requester boolean := (OLD.requester_user_id IS NOT NULL AND OLD.requester_user_id = uid);
  is_assigned_provider boolean := (OLD.assigned_provider_id IS NOT NULL AND OLD.assigned_provider_id = uid);
  changed text[] := ARRAY[]::text[];
  -- Columns providers/facilities/patients may NEVER modify. System-controlled,
  -- financial, medical billing, ownership, assignment, audit.
  locked_cols_all text[] := ARRAY[
    'id','created_at','last_updated_at',
    'requester_user_id','embed_provider_id','embed_token',
    'ip_address','user_agent',
    'assigned_provider_id','assigned_driver_id','assigned_vehicle_id',
    'payment_amount_cents','payment_status',
    'estimated_cost_cents','estimated_duration_seconds','estimated_duration_traffic_seconds',
    'route_polyline','route_computed_at','distance_miles',
    'black_tie_quote_cents','black_tie_quote_notes','black_tie_quote_status',
    'medicaid_number','medicaid_plan','authorization_number','diagnosis_code',
    'payer','payer_id',
    'trip_billing_source','trip_billing_first_name','trip_billing_last_name',
    'trip_billing_email','trip_billing_phone',
    'hipaa_ack_id','dispatch_source','scheduled_start_time'
  ];
  -- Workflow columns the assigned provider may update. Everything else is denied.
  provider_workflow_cols text[] := ARRAY[
    'status','provider_notes','last_updated_at','cancel_reason','canceled_at'
  ];
BEGIN
  -- Service role / no auth context: allow (webhooks, admin, triggers).
  IF uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Admin / staff bypass field-level restrictions.
  is_admin := public.has_role(uid, 'admin'::app_role);
  IF is_admin THEN
    RETURN NEW;
  END IF;
  BEGIN
    is_staff := public.has_role(uid, 'staff'::app_role)
             OR public.has_role(uid, 'app_manager'::app_role)
             OR public.has_role(uid, 'dispatcher'::app_role);
  EXCEPTION WHEN others THEN
    is_staff := false;
  END;
  IF is_staff THEN
    RETURN NEW;
  END IF;

  -- Compute changed columns (compare row_to_json).
  SELECT COALESCE(array_agg(key), ARRAY[]::text[]) INTO changed
  FROM (
    SELECT key FROM jsonb_each(to_jsonb(NEW))
    EXCEPT
    SELECT key FROM jsonb_each(to_jsonb(OLD))
  ) diff;

  IF array_length(changed, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Assigned provider: restrict to workflow columns only.
  IF is_assigned_provider THEN
    IF EXISTS (
      SELECT 1 FROM unnest(changed) c
      WHERE c <> ALL(provider_workflow_cols)
    ) THEN
      RAISE EXCEPTION 'Assigned providers can only update workflow fields (status, notes, cancel). Contact dispatch for other changes.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- Requester / facility / patient: block all locked columns.
  IF is_requester THEN
    IF EXISTS (
      SELECT 1 FROM unnest(changed) c
      WHERE c = ANY(locked_cols_all)
    ) THEN
      RAISE EXCEPTION 'This field is system-controlled and cannot be edited by the requester. Contact dispatch for changes.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- Anyone else the row-level policy let through gets read-only treatment here.
  RAISE EXCEPTION 'You are not permitted to modify this ride request.'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_ride_requests_field_authz ON public.ride_requests;
CREATE TRIGGER trg_ride_requests_field_authz
BEFORE UPDATE ON public.ride_requests
FOR EACH ROW
EXECUTE FUNCTION public.ride_requests_enforce_field_authorization();
