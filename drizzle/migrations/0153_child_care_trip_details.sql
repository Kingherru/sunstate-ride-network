ALTER TABLE public.ride_requests ADD COLUMN IF NOT EXISTS service_line text NOT NULL DEFAULT 'medical';
ALTER TABLE public.ride_requests ADD CONSTRAINT ride_requests_service_line_check CHECK (service_line IN ('medical','child_care'));
ALTER TABLE public.ride_requests ADD COLUMN IF NOT EXISTS child_care_details jsonb;
ALTER TABLE public.ride_requests ADD CONSTRAINT ride_requests_child_care_details_check CHECK (
  child_care_details IS NULL OR (
    jsonb_typeof(child_care_details) = 'object'
    AND child_care_details->>'version' = '1'
    AND jsonb_typeof(child_care_details->'children') = 'array'
    AND jsonb_array_length(child_care_details->'children') BETWEEN 1 AND 5
  )
);
COMMENT ON COLUMN public.ride_requests.child_care_details IS 'Versioned child rows (first name, age, seat requirement). Workspace-authorized via existing ride_requests RLS; never projected into Network offers or public directory.';