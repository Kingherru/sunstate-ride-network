import { createContext, useContext } from "react";
import { toast } from "sonner";
import { PROVIDER_DEMO_FIXTURES, providerDemoKeyed } from "./demo-fixtures/provider-demo";
import {contractorFixtures,CONTRACTOR_DEMO_ENABLED} from './demo-fixtures/contractor-demo';
import {PILOT_CHECKS} from '@/lib/pilot-completion-rules';
import {REGIONAL_DEMO_INVOICE} from './demo-fixtures/regional-invoice';
import { DEMO_TRIP_DRAFTS } from './demo-fixtures/trip-drafts';
import { useMutation, useQuery, type UseMutationOptions, type UseMutationResult, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";

/** Shared state for Master-Admin portal previews: which kind of portal is
 *  being previewed and whether preview mode is active at all. Consumed by
 *  the real page/panel components so they never read or write real data. */
export type PortalPreviewState = {
  active: boolean;
  kind: "provider" | "customer";
  accountType: string;
  examples?: boolean;
};

export const PortalPreviewContext = createContext<PortalPreviewState>({ active: false, kind: "customer", accountType: "general_facility" });

export function usePortalPreview(): PortalPreviewState {
  return useContext(PortalPreviewContext);
}

/** Call from any write path (mutation, inline submit, realtime toggle) that
 *  would otherwise touch the server while a preview is active. */
export function previewBlocked() {
  toast("Preview only — no information was saved");
}

/** Clearly-fake fixtures keyed by the first segment of a react-query queryKey.
 *  Unknown keys fall back to an empty array so panels show their real empty
 *  states instead of crashing. */
const PREVIEW_FIXTURES: Record<string, unknown> = {
  'trip-drafts': DEMO_TRIP_DRAFTS,
  'private-regional-profile':{areas:[{country:'US',state:'FL',countyEquivalent:'Orange',countyType:'county',locality:'Orlando',postalCode:'32801',timezone:'America/New_York',region:'central',evidence:'provider_entered'}],crossState:false,radius:null},
  'regional-home':{state:'FL'},
  'regional-service-areas':{regional_service_areas:{areas:[{country:'US',state:'FL',countyEquivalent:'Orange',countyType:'county',locality:'Orlando',postalCode:'32801',timezone:'America/New_York',region:'central',evidence:'provider_entered'}],crossState:false,radius:50},counties:['Orange'],cities:['Orlando'],zips:['32801']},
  'pilot-checklist':PILOT_CHECKS.map((label,i)=>({label,ready:![0,1,4,6,7,8,12,13].includes(i)})),
  'scoped-pilot':{enabled:false,emergencyStop:false,level:'read',workspaces:[{id:'synthetic-workspace',display_name:'Synthetic scoped provider',mfn_id:'MFN-A-DEMO'}],services:['ambulatory']},
  'offer-watermarks':[{id:'00000000-0000-4000-8000-000000000021',revision:2,unread:true}],
  'communication-history':[{id:'synthetic-notice',title:'Synthetic reminder suppressed',createdAt:'2026-11-15T04:00:00Z',evidence:{reference:'MFN-R-DEMO',workspaceId:'synthetic-workspace',recipientId:'synthetic-recipient',tripId:null,requestId:'synthetic-request',category:'day_before',templateVersion:'communications-2026-11-15',channel:'email',state:'suppressed',reason:'Approved reminder timing required',dedupeKey:'synthetic-reminder-1',version:'1',scheduledAt:null,timezone:'America/Chicago',policyBasis:'explicit linked patient',deliveryEnabled:false}}],
  'communication-previews':[{requestId:'synthetic-request',reference:'MFN-R-DEMO',provider:'Synthetic Transportation',templateVersion:'communications-2026-11-15',status:'Approved',timezone:'America/Chicago',reminders:[{type:'day_before',state:'suppressed',reason:'reminder_timing_not_configured',scheduledAt:null,timezone:'America/Chicago'}],content:{pickupDate:'2026-11-20',pickupTime:'09:00',pickupAddress:'Synthetic pickup',dropoffAddress:'Synthetic destination',appointmentTime:'10:00',returnPickupTime:null,dispatchPhone:null,driverName:'Synthetic Driver',driverPhone:null,disclaimer:'Preview only — no reminder prepared or sent.'},deliveryEnabled:false}],
  'nearby-settings':{nearby_opt_in:false,matching_settings:{state:'FL',region:'Central Florida',publicLabel:'Orlando area',displayName:'Synthetic Transportation',radius:50,timezone:'America/New_York',days:[1,2,3,4,5],start:'08:00',end:'18:00',availability:'paused',acceptingTrips:false},matching_consent:{},visible:false},
  'nearby-wave-review':{radius:20,eligible:2,excluded:{'Nearby consent off':3,'Eligible vehicle required':1},enabled:false,candidates:[{workspace:'synthetic-candidate',score:116,explanation:['Serves pickup city','Eligible vehicle and driver','Operating during requested time','Approximately 12 miles from pickup']}]},
  'network-access':{entitled:true,workspaceId:'preview-ws',contractor:false,canPurchase:true,baseActive:true},
  'network-view-counts':{offers:1,activity:1,payments:0,settlements:0,patients:0,providers:0,contractors:0},
  'provider-setup': {provider_subtype:'nemt_business',provider_service_roles:[],isOwner:true,provider_subtype_selected_at:null,pickup_delay_minutes:null,canSelect:false,vehicles:[]},
  'sign-in-preference': {value:null,options:[{to:'/portal',label:'Overview'},{to:'/portal/trips',label:'Trips'},{to:'/portal/fleet',label:'Fleet & Drivers'}]},
  'patient-driver-suggestion': {driverId:'preview-driver-2',preferredDriverId:'preview-driver-2',lastDriverId:'preview-driver-2',source:'preferred',warning:null,options:[{id:'preview-driver-2',name:'Sam Sample (Demo)'}]},
  'patient-scope': {ids:['preview-ws'],privateOnly:false},
  'patient-owner-profile': {person:{first_name:'Demo',last_name:'Account'},workspace:{id:'preview-ws',account_type:'private_pay'},legacy:{patient_type:'another',patient_relationship:'Parent'},patient:{id:'preview-patient',first_name:'Pat',last_name:'Patient',mobility:'ambulatory'}},
  'saved-patients': [{id:'preview-patient',workspace_id:'preview-ws',first_name:'Pat',last_name:'Patient (Demo)',active:true,kind:'patient',mobility:'ambulatory',preferred_driver_id:'preview-driver-2',phone:'5555555555',email:'synthetic@example.test',default_pickup_address:'Synthetic saved pickup',default_pickup_city:'Orlando',default_dropoff_address:'Synthetic saved destination',default_dropoff_city:'Winter Park',oxygen_required:true,assistance_needs:'Synthetic legacy mobility instruction'}],
  'portal-preferences': {interface_density:'standard',high_contrast:false,detail_columns:null},
  'connect-preparation': {state:'Not started',customerReady:false,networkReady:false,signingConfigured:false,activation:false,environment:'sandbox'},
  'account-profile-verification':[],
  'confirmed-usual-provider':null,
  'business-visibility': {workspace:{display_name:'Demo transportation business',account_type:'provider'},profile:null,consent:null},
  'business-search': [{workspace_id:'demo-business',business_name:'Demo Florida Facility',mfn_id:'MFN-A-DEMO',business_type:'facility',location:'Orlando',description:'Synthetic facility example.',facility_category:'Clinic',service_types:[],counties:[],cities:['Orlando'],medical_delivery:false,accepting_connections:true,business_contact_email:null,business_contact_phone:null,verification_level:null}],
  'patient-link-context': {workspaceId:'demo-source',patients:[{workspace_id:'demo-patient',display_name:'Demo Patient',mfn_id:'MFN-A-DEMO-PATIENT'}]},
  'patient-trips': [{request:{id:'demo-patient-request',mfn_id:'MFN-R-DEMO',trip_kind:'passenger',transport_type:'wheelchair',trip_type:'one_way',created_at:'2026-11-07T12:00:00Z',pickup_date:'2026-11-10',pickup_time:'09:00',pickup_city:'Orlando',dropoff_city:'Winter Park'},tripId:null,tripNumber:null,providerName:'Demo independent provider',source:'Created by facility',events:[],payments:[],scheduledAt:null,driverAssigned:false,invoice:REGIONAL_DEMO_INVOICE,stage:'Approved',group:'upcoming',timeline:[{label:'Pending',at:'2026-11-07T12:00:00Z'},{label:'Approved',at:'2026-11-07T13:00:00Z'}]}],
  'workspace-business-settings':{display_name:'Demo Transportation',legal_business_name:'Demo Transportation LLC',business_phone:'',dispatch_phone:'',business_address:'Demo address',mailing_address:'',operating_hours:'Weekdays 8–6',mfn_id:'MFN-A-DEMO',account_type:'provider',npi:'',medicaid_number:'',canEditProviderNumbers:false},
  'personal-settings': { first_name: 'Demo', last_name: 'Account', display_name: 'Demo Account', phone: '', mfn_id: 'MFN-P-DEMO', notification_preferences: { in_app: true, email: false }, status: 'active' },
  'personal-security-audit': [],
  'targeted-patient-requests': [],
  "work-hours": { weekly: {} },
  "my-drivers": [],
  "day-reservations": [],
  "reservations-by-state": [],
  "referral-reservations": [],
  "trip-history": [],
  "trip-history-drivers": new Map(),
  "driver-upcoming-trips": { driver: null, trips: [] },
  "driver-earnings": { trips: { completed_count: 0, pickup_legs: 0, total_miles: 0, wait_minutes: 0, canceled_count: 0, worked_hours: 0, worked_days: 0 }, pay_type: null, lines: [], gross_cents: 0, adjustments_cents: 0, amount_paid_cents: 0, outstanding_cents: 0, adjustments: [], payments: [] },
  "driver-payment-history": [],
  "driver-earnings-reports": [],
  contacts: [],
  "my-payers": [],
  "payer-cards": [],
  notifications: { rows: [] },
  pricing: null,
  integrations: [],
  "fin-settings": { standard_hold_days: 3, medicaid_net_business_days: 15 },
  "provider-balance-detailed": { balance: { available_cents: 0, pending_cents: 0, lifetime_paid_out_cents: 0 }, entries: [], cashouts: [] },
  "payout-account": { status: "not_connected", payouts_enabled: false, charges_enabled: false, stripe_account_id: null },
  "payout-trips": [],
  "my-network-profile": { ok: true, verified: false, profile: null },
  "my-provider-application": null,
  "hipaa-ack-status": { acknowledged: false, acknowledged_at: null },
  "public-courses": [
    { id: 'demo-hipaa', slug: 'hipaa', title: 'HIPAA Training for NEMT', summary: 'Demo training — patient privacy and professional responsibilities.', duration_min: 30, price_cents: 5000, price_id: 'course_hipaa_v2', passing_score: 80, cert_validity_months: 12 },
    { id: 'demo-nemt', slug: 'nemt-certification', title: 'Florida Basic NEMT Test', summary: 'Never abandon a patient, safety, communication and professionalism.', duration_min: 5, price_cents: 5000, price_id: 'course_nemt_v2', passing_score: 80, cert_validity_months: 12 },
  ],
  "my-enrollments": [{ id: 'demo-enrollment', course_id: 'demo-nemt', status: 'active', progress: null, courses: { slug: 'nemt-certification', title: 'Florida Basic NEMT Test', summary: 'Demo enrollment', duration_min: 5 } }],
};

export function previewFixtureFor(queryKey: readonly unknown[]): unknown {
  const key = String(queryKey[0] ?? "");
  if(CONTRACTOR_DEMO_ENABLED&&key in contractorFixtures)return contractorFixtures[key];
  const keyed = providerDemoKeyed(queryKey);
  if (keyed !== undefined) return keyed;
  if (key === "my-drivers") return PROVIDER_DEMO_FIXTURES["my-drivers"] ?? PROVIDER_DEMO_FIXTURES.drivers ?? [];
  if (key in PROVIDER_DEMO_FIXTURES) return PROVIDER_DEMO_FIXTURES[key];
  if (key in PREVIEW_FIXTURES) return PREVIEW_FIXTURES[key];
  return [];
}

/** Drop-in replacement for useQuery: while a preview is active it never calls
 *  the real queryFn (no server/Supabase calls) and serves a seeded fixture
 *  instead, with polling/refetching disabled. Behaves exactly like useQuery
 *  otherwise. */
export function usePortalQuery<TData = unknown, TError = unknown>(
  options: UseQueryOptions<TData, TError> & { queryKey: readonly unknown[] },
): UseQueryResult<TData, TError> {
  const preview = usePortalPreview();
  const effective = preview.active
    ? {
        ...options,
        queryKey: ['portal-preview', preview.examples !== false, ...options.queryKey],
        queryFn: async () => (preview.examples === false && ['trip-drafts','patient-trips','vehicles','drivers','network-offers','network-activity','network-settlements','network-payments'].includes(String(options.queryKey[0])) ? [] : previewFixtureFor(options.queryKey)) as TData,
        refetchInterval: false as const,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        retry: false,
      }
    : options;
  return useQuery(effective);
}

/** Drop-in replacement for useMutation: while a preview is active, calling
 *  mutate()/mutateAsync() never reaches the real mutationFn — it shows the
 *  "preview only" toast and rejects quietly instead. */
export function usePortalMutation<TData = unknown, TError = unknown, TVariables = void, TContext = unknown>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>,
): UseMutationResult<TData, TError, TVariables, TContext> {
  const preview = usePortalPreview();
  const effective = preview.active
    ? {
        ...options,
        mutationFn: async () => {
          previewBlocked();
          throw new Error("__PREVIEW_BLOCKED__");
        },
        onError: (...args: Parameters<NonNullable<typeof options.onError>>) => {
          const err = args[0];
          if (err instanceof Error && err.message === "__PREVIEW_BLOCKED__") return;
          options.onError?.(...args);
        },
        onSuccess: undefined,
        onSettled: undefined,
      }
    : options;
  return useMutation(effective as UseMutationOptions<TData, TError, TVariables, TContext>);
}
