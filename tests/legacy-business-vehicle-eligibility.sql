-- Read-only synthetic regression cases; creates no vehicles, trips or accounts.
WITH cases(label, fields, service, expected) AS (VALUES
 ('legacy sedan remains ambulatory eligible', '{"vehicle_type":"sedan","status":"active","capacity":4,"service_capabilities":["ambulatory"]}'::jsonb, 'ambulatory', true),
 ('legacy wheelchair van retains explicit wheelchair capability', '{"vehicle_type":"wheelchair_van","status":"active","capacity":4,"service_capabilities":["ambulatory","wheelchair"]}'::jsonb, 'wheelchair', true),
 ('legacy stretcher van retains explicit stretcher capability', '{"vehicle_type":"stretcher_van","status":"active","capacity":4,"service_capabilities":["stretcher"]}'::jsonb, 'stretcher', true),
 ('inactive vehicle fails', '{"vehicle_type":"sedan","status":"inactive","capacity":4,"service_capabilities":["ambulatory"]}'::jsonb, 'ambulatory', false),
 ('missing capacity fails', '{"vehicle_type":"sedan","status":"active","service_capabilities":["ambulatory"]}'::jsonb, 'ambulatory', false),
 ('no capability is inferred from vehicle type', '{"vehicle_type":"wheelchair_van","status":"active","capacity":4,"service_capabilities":[]}'::jsonb, 'wheelchair', false),
 ('sedan cannot gain wheelchair capability', '{"vehicle_type":"sedan","status":"active","capacity":4,"service_capabilities":["wheelchair"]}'::jsonb, 'wheelchair', false),
 ('new categorized incomplete vehicle fails', '{"vehicle_type":"sedan","vehicle_category":"ambulatory","status":"active","capacity":4,"service_capabilities":["ambulatory"]}'::jsonb, 'ambulatory', false),
 ('unsupported service fails', '{"vehicle_type":"sedan","status":"active","capacity":4,"service_capabilities":["other"]}'::jsonb, 'other', false)
), results AS (
 SELECT label, expected, public.business_vehicle_service_eligible(jsonb_populate_record(NULL::public.vehicles, fields),service) AS actual FROM cases
)
SELECT label, expected, actual, actual IS NOT DISTINCT FROM expected AS passed FROM results;