import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { COMMUNICATION_TEMPLATE_VERSION, customerCommunicationStatus, prepareReminders, type CommunicationEvidence } from './communication-rules';
import type { PatientSnapshot } from './patient-trips.functions';

export const listCommunicationHistory = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
 .inputValidator((i: unknown) => z.object({ admin: z.boolean().default(false) }).strict().parse(i))
 .handler(async ({ data, context }) => {
  const { data: rows, error } = await context.supabase.rpc('list_communication_preparations', { _admin: data.admin });
  if (error) throw new Error('Communication history unavailable.');
  return (rows ?? []).map(row => ({ id: row.id, title: row.title, createdAt: row.created_at, evidence: row.communication as unknown as CommunicationEvidence }));
 });

/** Read-only exact projection for the current authenticated linked patient.
 * No event inserts, scheduler, delivery helper or arbitrary-recipient input. */
export const previewMyTripCommunications = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
 const { data: auth, error: authError } = await context.supabase.auth.getUser();
 if (authError || !auth.user) throw new Error('Trip communications unavailable.');
 const { data, error } = await context.supabase.rpc('preview_patient_communication_context');
 if (error) throw new Error('Trip communications unavailable.');
 return (data ?? []).map(raw => {
  const item = raw as unknown as { snapshot: PatientSnapshot; timezone: string | null; activeRelationship: boolean; version: string };
  const row = item.snapshot;
  const status = customerCommunicationStatus(row.status, !!row.invoice && row.invoice.balanceCents > 0 && ['ready','sent','payment_pending'].includes(row.invoice.status));
  const request = row.request;
  const pickupDate = typeof request.pickup_date === 'string' ? request.pickup_date : null;
  const pickupTime = typeof request.pickup_time === 'string' ? request.pickup_time : null;
  const reminders = prepareReminders({ tripId: row.tripId ?? request.id, recipientId: context.userId, version: item.version, status: row.status, passenger: request.trip_kind === 'passenger', authorized: true, confirmedEmail: !!auth.user?.email_confirmed_at, activeRelationship: item.activeRelationship, communicationPermission: item.activeRelationship, pickupDate, pickupTime, timezone: item.timezone, now: Date.now() });
  return { requestId: request.id, reference: row.tripNumber ?? request.mfn_id ?? 'Trip', templateVersion: COMMUNICATION_TEMPLATE_VERSION, status, provider: row.providerName ?? 'Provider not available', timezone: item.timezone, reminders, content: { pickupDate, pickupTime, pickupAddress: request.pickup_address ?? null, dropoffAddress: request.dropoff_address ?? null, appointmentTime: request.appointment_time ?? null, returnPickupTime: request.round_trip ? request.return_pickup_time ?? null : null, dispatchPhone: row.contacts?.dispatchPhone ?? null, driverName: row.contacts?.driverName ?? null, driverPhone: row.contacts?.driverPhone ?? null, disclaimer: 'Changes and availability must be confirmed with the provider.' }, deliveryEnabled: false as const };
 });
});

export const getCustomerCommunicationSettings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
 .inputValidator((i: unknown) => z.object({ workspaceId: z.string().uuid() }).strict().parse(i)).handler(async ({ data, context }) => {
  const { data: allowed } = await context.supabase.rpc('can_manage_provider_customer_pricing', { _workspace: data.workspaceId });
  if (!allowed) throw new Error('Communication settings unavailable.');
  const { data: profile, error } = await context.supabase.from('provider_network_profiles').select('customer_communication_settings,trip_dispatch_phone,trip_dispatch_phone_designated').eq('workspace_id', data.workspaceId).maybeSingle();
  if (error) throw new Error('Communication settings unavailable.');
  const settings = profile?.customer_communication_settings as { businessName?: string; dispatchPhone?: string; email?: string; shareDriverName?: boolean; shareDriverPhone?: boolean } | null;
  return { businessName: settings?.businessName ?? '', dispatchPhone: settings?.dispatchPhone ?? (profile?.trip_dispatch_phone_designated ? profile.trip_dispatch_phone ?? '' : ''), email: settings?.email ?? '', shareDriverName: settings?.shareDriverName === true, shareDriverPhone: settings?.shareDriverPhone === true };
 });
export const saveCustomerCommunicationSettings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
 .inputValidator((i: unknown) => z.object({ workspaceId: z.string().uuid(), confirmed: z.literal(true), settings: z.object({ businessName: z.string().trim().max(160), dispatchPhone: z.string().trim().max(32), email: z.union([z.literal(''), z.string().email().max(254)]), shareDriverName: z.boolean(), shareDriverPhone: z.boolean() }).strict() }).strict().parse(i))
 .handler(async ({ data, context }) => { const { error } = await context.supabase.rpc('save_customer_communication_settings', { _ws: data.workspaceId, _settings: data.settings }); if (error) throw new Error('Communication settings could not be saved.'); return { ok: true }; });

export const getSecureEmailChangeState = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
 const { data: current, error } = await context.supabase.auth.getUser();
 if (error || !current.user) throw new Error('Email confirmation state unavailable.');
 const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
 const { data, error: pendingError } = await supabaseAdmin.auth.admin.getUserById(current.user.id);
 if (pendingError || data.user?.id !== context.userId) throw new Error('Email confirmation state unavailable.');
 return { confirmedEmail: current.user.email_confirmed_at ? current.user.email ?? null : null, pendingEmail: data.user.new_email ?? null, pending: !!data.user.new_email, unattendedExpirationSupported: false };
});

export const saveTripCommunicationOverride = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator((i:unknown)=>z.object({tripId:z.string().uuid(),withhold:z.boolean(),timezone:z.string().min(1).max(100),confirmed:z.literal(true)}).strict().parse(i))
 .handler(async({data,context})=>{const {error}=await context.supabase.rpc('set_trip_communication_override',{_trip:data.tripId,_withhold:data.withhold,_timezone:data.timezone});if(error)throw new Error('Trip communication settings unavailable.');return {ok:true};});