import { Link, useRouter, useRouteContext } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { adminSubmitRideRequest, adminSubmitDeliveryRequest } from "@/lib/admin-on-behalf.functions";
import { toast } from "sonner";
import {
  submitRideRequest,
  submitDeliveryRequest,
  deliveryRequestSchema,
  type DeliveryRequestInput,
  DELIVERY_CATEGORY_OPTIONS,
  DELIVERY_CATEGORY_LABELS,
  rideRequestSchema,
  type RideRequestInput,
  type BillingContact,
  RECURRENCE_OPTIONS,
} from "@/lib/forms.functions";
import { enrichRideRequest } from "@/lib/maps.functions";
import { useTripRoute } from './use-trip-route';
import { ADDITIONAL_PASSENGER_CHOICES, CHILD_COUNT_CHOICES, CHILD_REQUIREMENTS, CHILD_REQUIREMENT_LABELS, type ChildRow, resizeChildren, totalPassengers, additionalFromTotal, childCareTransport, estimateDropoffTime, estimateDropoffDate, formatUsDate, locationResolved } from "@/lib/trip-form-rules";
import { CITY_LIST } from "@/lib/cities";
import { AddressAutocomplete, type AddressSelection } from "@/components/forms/AddressAutocomplete";
import { PriceEstimate } from "@/components/pricing/PriceEstimate";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { TimePickerField, TimeSelect, CompactTimeContext } from "@/components/ui/time-picker-field";
import { RoutePreview, googleRouteUrl, formatMinutes } from "@/components/maps/RoutePreview";
import { supabase } from "@/integrations/supabase/client";
import { listTripPatients } from "@/lib/saved-patients.functions";
import { listMyPayers } from "@/lib/payers.functions";
import { getPortalPreferences } from "@/lib/portal-preferences.functions";
import { NonEmergencyNotice } from "@/components/public/page-kit";
import { LINKS } from "@/lib/site-config";
import { TripLegsPreview, type LegInput } from "@/components/trips/TripLegsPreview";
import { usePortalPreview, previewBlocked, previewFixtureFor } from "@/components/portal/preview-data";
import { saveTripDraft, deleteTripDraft } from '@/lib/trip-drafts.functions';
import { restoreDraftFields } from '@/lib/draft-fields';
import { recordOwnedReferralFailure } from '@/lib/provider-referral-audit.functions';
import {coordinateTimezone} from '@/lib/trip-location-timezone';
import { ProviderInvitation } from '@/components/portal/ProviderInvitation';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CheckoutAcknowledgment } from '@/components/payments/CheckoutAcknowledgment';
import { currentCheckoutConsent } from '@/lib/payment-policy';
import { PAYMENT_RESPONSIBILITY_WARNING } from '@/lib/trip-network-rules';
import { continueOwnedReferral, validateReferralReview, type ReferralReview } from '@/lib/provider-referral-flow';
import { createNetworkDistribution, sendNetworkWave, getDistributionReadiness } from '@/lib/trip-network.functions';
import { getReferralFundingPreparation } from '@/lib/trip-invoices.functions';
import { submitProviderOwnedTrip } from '@/lib/provider-owned-submit.functions';
import { VISIBLE_MOBILITY_OPTIONS, PICKUP_OPTIONS, readPickupOptions, writePickupOptions, readMobility, writeMobility, matchingTripPatients } from '@/lib/trip-mobility';
import { tripChronologyErrors, routePoints, routeArrivalPatch, manualArrivalFromDraft, TRIP_TYPE_DISPLAY } from '@/lib/trip-form-rules';
import { DsButton, DsCheckbox } from '@/components/ds/controls';
import { PatientProviderPicker } from '@/components/network/PatientProviderPicker';
import type { NetworkProviderRow } from '@/lib/facility-providers.functions';
import { LinkedPatientSelector } from '@/components/portal/LinkedPatientSelector';
import { TripCommerceContext } from './trip-commerce-context';
import {getTripDefaults,getFacilityAuthorizedPatients} from '@/lib/trip-defaults.functions';
import {fillEmptyTripDefaults,approvedPatientDefaults} from '@/lib/trip-defaults.rules';
import {PayerDialog} from '@/components/dashboard/PayersPanel';
import {ContactDialog} from '@/components/dashboard/ContactsPanel';
import {listContacts} from '@/lib/crm.functions';
import {TripSeriesBuilder} from '@/components/portal/TripSeriesBuilder';
import {PatientDriverSuggestion} from '@/components/portal/PatientDriverSuggestion';
import {RegionalAddressFields} from '@/components/forms/RegionalAddressFields';


const SERVICE_CHOICES: { id: string; label: string; kind: "ride" | "delivery"; type?: RideRequestInput["transportType"] }[] = [
  { id: "ambulatory", label: "Ambulatory", kind: "ride", type: "ambulatory" },
  { id: "wheelchair", label: "Wheelchair", kind: "ride", type: "wheelchair" },
  { id: "stretcher", label: "Stretcher", kind: "ride", type: "gurney" },
  { id: "medical-delivery", label: "Medical Delivery", kind: "delivery" },
  { id: "child-care", label: "Child Care Transportation", kind: "ride", type: "ambulatory" },
];

const SERVICE_PARAM: Record<string, RideRequestInput["transportType"]> = { ambulatory: "ambulatory", wheelchair: "wheelchair", stretcher: "gurney" };

export type RequestFormContext = "public" | "portal";

/**
 * Shared authoritative request form (passenger transportation + medical
 * delivery). Used by the public Book a Trip page and the signed-in portal.
 * Validation and submission always go through the same schemas and server
 * functions; the server resolves the requester and workspace itself.
 */
/** When set, the form submits for this customer through the admin-on-behalf
 *  server functions (same schemas). The admin's own session is never replaced. */
export type OnBehalfTarget = { targetUserId: string; workspaceId: string | null };
export const OnBehalfContext = createContext<OnBehalfTarget | null>(null);

export function RequestForm({ context = "public", initialService, initialDraft, allowProviderSelection = false }: { context?: RequestFormContext; initialService?: string; initialDraft?: { id: string; payload: Record<string, unknown> }; allowProviderSelection?: boolean }) {
  return <RequestRidePage context={context} service={initialService} initialDraft={initialDraft} allowProviderSelection={allowProviderSelection} />;
}

const empty: RideRequestInput = {
  pickupState:'FL',dropoffState:'FL',pickupZip:'',dropoffZip:'',pickupCounty:'',dropoffCounty:'',pickupTimezone:'',dropoffTimezone:'',
  patientFirstName: "",
  patientLastName: "",
  patientPhone: "",
  patientEmail: "",
  patientWorkspaceId: null,
  passengerCount:1,wheelchairPositions:0,serviceLine:'medical',children:[],
  payerId:null,savedPatientId:null,coordinationContactId:null,confirmedProviderDriverId:null,confirmedDriverEndTime:"",
  pickupAddress: "",
  pickupAddressDetails: "",
  pickupCity: "",
  pickupDate: "",
  pickupTime: "",
  appointmentTime: "",
  dropoffAddress: "",
  dropoffCity: "",
  transportType: "ambulatory",
  tripType: "one_way",
  roundTrip: false,
  returnPickupTime: "",
  returnDropoffTime: "",
  returnDate: "",
  returnPickupBuilding: "",
  returnPickupDoctor: "",
  returnPickupSuite: "",
  additionalStops: [],
  mobilityNotes: "",
  specialInstructions: "",
  recurrence: "none",
  recurrenceEndDate: "",
  billingSource: "account",
  createAccount: false,
  blackTie: false,
};

function buildLegs(f: RideRequestInput): LegInput[] {
  const pickup = [f.pickupAddress, f.pickupCity, f.pickupState, f.pickupZip].filter(Boolean).join(", ");
  const dropoff = [f.dropoffAddress, f.dropoffCity, f.dropoffState, f.dropoffZip].filter(Boolean).join(", ");
  const legs: LegInput[] = [];
  // Leg 1: primary pickup → drop-off (or first stop for multi-trip)
  const firstTo =
    f.tripType === "multi_trip" && f.additionalStops.length > 0
      ? [f.additionalStops[0].address, f.additionalStops[0].city].filter(Boolean).join(", ")
      : dropoff;
  legs.push({
    label: "Pickup",
    from: pickup,
    to: firstTo,
    date: f.pickupDate,
    time: f.pickupTime,
  });
  if (f.tripType === "multi_trip") {
    for (let i = 0; i < f.additionalStops.length; i++) {
      const s = f.additionalStops[i];
      const next = f.additionalStops[i + 1];
      const to = next
        ? [next.address, next.city].filter(Boolean).join(", ")
        : dropoff;
      const stopTime = s.pickupTime ?? "";
      legs.push({
        label: `Stop ${i + 1}`,
        from: [s.address, s.city].filter(Boolean).join(", "),
        to,
        date: f.pickupDate,
        time: stopTime || f.pickupTime,
        inheritedDate: true,
        inheritedTime: !stopTime,
        note: s.note || undefined,
      });
    }
  }
  if (f.tripType === "round_trip") {
    const rdate = f.returnDate || f.pickupDate;
    legs.push({
      label: "Return",
      from: dropoff,
      to: pickup,
      date: rdate,
      time: f.returnPickupTime || f.pickupTime,
      inheritedDate: !f.returnDate || f.returnDate === f.pickupDate,
      inheritedTime: !f.returnPickupTime,
    });
  }
  return legs;
}


const TRIP_TYPE_LABELS: Record<RideRequestInput["tripType"], string> = {
  one_way: "One-way",
  round_trip: "Round trip",
  multi_trip: "Multi Trip",
};

function Field({
  label,
  children,
  required,
  error,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  error?: string;
}) {
  return (
    <label
      className={
        error
          ? "block rounded-ds-sm [&_input]:border-destructive [&_textarea]:border-destructive [&_select]:border-destructive [&_button]:border-destructive"
          : "block"
      }
      data-field-error={error ? "true" : undefined}
    >
      <span className="block text-xs font-bold uppercase tracking-widest text-ds-text-2 mb-2">
        {label}
        {required && <span className="text-ds-accent-active"> *</span>}
      </span>
      {children}
      {error && (
        <span role="alert" className="block mt-1 text-xs font-semibold text-ds-error">
          {error}
        </span>
      )}
    </label>
  );
}


const inputCls =
  "w-full bg-ds-surface border border-ds-border rounded-ds-sm px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ds-focus focus:border-ds-sky-border transition-all";

function haversineMiles(lat1: number | null, lng1: number | null, lat2: number | null, lng2: number | null): number {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return 0;
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function RequestRidePage({ context, service, initialDraft, allowProviderSelection }: { context: RequestFormContext; service?: string; initialDraft?: { id: string; payload: Record<string, unknown> }; allowProviderSelection: boolean }) {
  const commerce = useContext(TripCommerceContext);
  const auditReferralFailure=useServerFn(recordOwnedReferralFailure);
  const ownedSubmit=useServerFn(submitProviderOwnedTrip),createReferral=useServerFn(createNetworkDistribution),sendWave=useServerFn(sendNetworkWave),readiness=useServerFn(getDistributionReadiness),fundingReview=useServerFn(getReferralFundingPreparation);
  const [operationId]=useState(()=>crypto.randomUUID());
  const [referralOpen,setReferralOpen]=useState(false),[compensation,setCompensation]=useState(''),[expiration,setExpiration]=useState(''),[paymentAck,setPaymentAck]=useState(false),[policyAck,setPolicyAck]=useState(false),[pendingReferral,setPendingReferral]=useState<ReferralReview|null>(null),[referralResult,setReferralResult]=useState<{message:string;reason:string|null;tripId:string}|null>(null);
  const [fundingReviewResult,setFundingReviewResult]=useState('');
  const preview = usePortalPreview();
  const router = useRouter();
  const portal = context === "portal";
  const { access } = useRouteContext({ strict: false });
  const patientAccount = portal && (preview.active ? preview.accountType === 'private_pay_patient' : access?.primary?.type === 'private_pay');
  const [bookingFor, setBookingFor] = useState<'self' | 'other'>(initialDraft?.payload.patientWorkspaceId || initialDraft?.payload.savedPatientId ? 'other' : 'self');
  const [selfDefaults, setSelfDefaults] = useState<Parameters<typeof fillEmptyTripDefaults>[1] | null>(null);
  const [kind, setKind] = useState<"ride" | "delivery">(initialDraft?.payload.requestCategory === "medical_delivery" || service === "medical-delivery" ? "delivery" : "ride");
  const submitSelf = useServerFn(submitRideRequest);
  const submitAdmin = useServerFn(adminSubmitRideRequest);
  const onBehalf = useContext(OnBehalfContext);
  const submit = (a: { data: RideRequestInput }) =>
    onBehalf ? submitAdmin({ data: { ...onBehalf, request: a.data } }) : submitSelf(a);
  const enrich = useServerFn(enrichRideRequest);
  const [form, setForm] = useState<RideRequestInput>(() => initialDraft && initialDraft.payload.requestCategory !== "medical_delivery" ? { ...empty, pickupState:undefined,dropoffState:undefined, ...restoreDraftFields(initialDraft.payload, Object.keys(rideRequestSchema.shape)) } as RideRequestInput : (service && SERVICE_PARAM[service] ? { ...empty, transportType: SERVICE_PARAM[service] } : empty));
  const [dropoffManual, setDropoffManual] = useState(() => manualArrivalFromDraft(initialDraft?.payload, form.dropoffTime));
  const manualArrival = useRef(dropoffManual);
  const [draftId, setDraftId] = useState(initialDraft?.id);
  const [selectedProvider, setSelectedProvider] = useState<NetworkProviderRow | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const confirmDriver = useCallback((id:string|null,end?:string)=>setForm(f=>f.confirmedProviderDriverId===id?f:{...f,confirmedProviderDriverId:id,confirmedDriverEndTime:end??""}),[]);
  const saveDraft = useServerFn(saveTripDraft);
  const removeDraft = useServerFn(deleteTripDraft);
  async function onSaveDraft() {
    if (preview.active) { previewBlocked(); return; }
    setSavingDraft(true);
    try { const saved = await saveDraft({ data: { draft_id: commerce?.draftId ?? draftId, payload: { ...initialDraft?.payload, ...form, ...commerce?.draftExtras, dropoffTimeEdited:dropoffManual, billingContact: form.billingSource === 'custom' ? customBilling : form.billingSource === 'saved' ? savedBilling ?? form.billingContact : undefined }, autosaved: false } }); setDraftId(saved.id); commerce?.onDraftSaved?.(saved.id); toast.success('Draft saved securely.'); }
    catch { toast.error('Could not save draft.'); }
    finally { setSavingDraft(false); }
  }
  const [returnDateManual, setReturnDateManual] = useState(Boolean(initialDraft?.payload.returnDate ?? initialDraft?.payload.return_date));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{
    id: string;
    miles?: number | null;
    cents?: number | null;
    durationSec?: number | null;
    trafficSec?: number | null;
    polyline?: string | null;
    pickupLat?: number | null;
    pickupLng?: number | null;
    dropoffLat?: number | null;
    dropoffLng?: number | null;
  } | null>(null);
  const [savedBilling, setSavedBilling] = useState<BillingContact | null>(null);
  const [customBilling, setCustomBilling] = useState<BillingContact>((initialDraft?.payload.billingContact as BillingContact | undefined) ?? {
    firstName: "", lastName: "", email: "", phone: "",
  });
  // Autocomplete-derived location metadata used for live price estimate.
  const [pickupMeta, setPickupMeta] = useState<{ zip: string; state: string; lat: number | null; lng: number | null }>({ zip: "", state: "", lat: null, lng: null });
  const [dropoffMeta, setDropoffMeta] = useState<{ zip: string; state: string; lat: number | null; lng: number | null }>({ zip: "", state: "", lat: null, lng: null });
  const estimatedMiles = haversineMiles(pickupMeta.lat, pickupMeta.lng, dropoffMeta.lat, dropoffMeta.lng);
  useEffect(() => { if (kind === 'ride') commerce?.onChange({...form,dropoffTimeEdited:dropoffManual,billingContact:form.billingSource==='custom'?customBilling:form.billingSource==='saved'?savedBilling??undefined:undefined}); }, [form, dropoffManual, customBilling, savedBilling, kind, commerce?.onChange]);

  useEffect(() => {
    if (preview.active) return;
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user || cancelled) return;
      const { data: p } = await supabase
        .from("member_profiles")
        .select("billing_contact")
        .eq("user_id", u.user.id)
        .maybeSingle();
      const bc = (p as any)?.billing_contact as BillingContact | null;
      if (bc && !cancelled) setSavedBilling(bc);
    })();
    return () => { cancelled = true; };
  }, []);


  const upd = <K extends keyof RideRequestInput>(k: K, v: RideRequestInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const childCare = form.serviceLine === "child_care";
  const children = (form.children ?? []) as ChildRow[];
  const setChildren = (rows: ChildRow[]) => setForm(f => ({ ...f, children: rows, transportType: childCareTransport(rows), passengerCount: totalPassengers(additionalFromTotal(f.passengerCount, (f.children ?? []).length), rows.length) }));
  const additionalPassengers = additionalFromTotal(form.passengerCount, childCare ? children.length : 0);
  const routed = useTripRoute(routePoints(form), portal && kind === 'ride');
  const routeEstimate = form.tripType === 'multi_trip' ? null : estimateDropoffTime(form.pickupTime, routed.firstSeconds);
  const arrivalDate = routeEstimate ? estimateDropoffDate(form.pickupDate, form.pickupTime, routed.firstSeconds) : null;
  const autoArrival = useRef(false);
  useEffect(() => {
    const patch = routeArrivalPatch(manualArrival.current, autoArrival.current, routeEstimate, arrivalDate);
    if (!patch) return;
    autoArrival.current = !!routeEstimate;
    setForm(f => manualArrival.current || (f.dropoffTime === patch.dropoffTime && f.dropoffDate === patch.dropoffDate) ? f : {...f, ...patch});
  }, [routeEstimate, arrivalDate, dropoffManual]);
  const chronology = tripChronologyErrors(form);
  const [stashedLegs, setStashedLegs] = useState<RideRequestInput['additionalStops']>([]);
  const reportRoute = commerce?.onRouteMiles;
  useEffect(() => {
    if (!reportRoute) return;
    if (kind === 'ride') reportRoute({status: routed.status, miles: routed.miles});
  }, [kind, routed.status, routed.miles, reportRoute]);

  // Signed-in portal users: saved patients + default payer prefill for review (never card data, never auto-submit).
  const [patientSearch, setPatientSearch] = useState('');
  const [patients, setPatients] = useState<{ id: string; first_name: string; last_name: string; phone: string | null; email: string | null; mobility?:string|null; oxygen_required?:boolean; assistance_needs?:string|null; default_pickup_address?:string|null; default_pickup_city?:string|null; default_dropoff_address?:string|null; default_dropoff_city?:string|null; state?:string|null; zip?:string|null; county_equivalent?:string|null; timezone?:string|null; patient_workspace_id?:string|null; default_payer_id: string | null; active: boolean; kind: string | null }[]>([]);
  const [payers, setPayers] = useState<{ id: string; name: string; email: string | null; phone: string | null; active: boolean | null }[]>([]);
  const [patientChoice, setPatientChoice] = useState(String(initialDraft?.payload.savedPatientId ?? initialDraft?.payload.saved_patient_id ?? ''));
  const [payerNote, setPayerNote] = useState<string | null>(null);
  const [addingPayer,setAddingPayer]=useState(false);
  const [addingContact,setAddingContact]=useState(false);
  const [contacts,setContacts]=useState<Awaited<ReturnType<typeof listContacts>>>([]);
  const [facilityPatients,setFacilityPatients]=useState<Awaited<ReturnType<typeof getFacilityAuthorizedPatients>>>([]);
  const loadFacilityPatients=useServerFn(getFacilityAuthorizedPatients);
  const loadDefaults=useServerFn(getTripDefaults);
  const loadContacts=useServerFn(listContacts);
  const loadPayers=useServerFn(listMyPayers);
  const applyPayer = (payerId: string | null | undefined, list = payers) => {
    const p = list.find((x) => x.id === payerId && x.active !== false);
    if (!p) return;
    const [first, ...rest] = p.name.trim().split(/\s+/);
    setCustomBilling({ firstName: first ?? "", lastName: rest.join(" ") || first || "", email: p.email ?? "", phone: p.phone ?? "" });
    setForm((f) => ({ ...f, billingSource: "custom",payerId:p.id }));
    setPayerNote(`Billing prefilled from payer “${p.name}”. Review before submitting.`);
  };
  useEffect(() => {
    if(preview.active && portal){setPatients(previewFixtureFor(['saved-patients']) as typeof patients);return;}
    if (!portal) return;
    let cancelled = false;
    (async () => {
      try {
        const [pts, pys, prefs,defaults,cts] = await Promise.all([listTripPatients({data:{workspaceId:commerce?.workspaceId}}), listMyPayers(), getPortalPreferences(),loadDefaults(),loadContacts()]);
        if (cancelled) return;
        setPatients((pts as any[]).filter((x) => x.active !== false && (x.kind ?? "patient") === "patient"));
        setPayers(pys as any[]);
        setContacts(cts);
        if(!initialDraft && defaults.billing)setSavedBilling(current=>current??defaults.billing);
        if(defaults.workspaceId && defaults.accountType==='provider'){const linked=await loadFacilityPatients({data:{sourceId:defaults.workspaceId}});if(!cancelled)setFacilityPatients(linked);}
        const basicDefaults=defaults.defaults;
        if (defaults.accountType === 'private_pay' && basicDefaults) setSelfDefaults(basicDefaults);
        if(!initialDraft && basicDefaults)setForm(f=>({...fillEmptyTripDefaults(f,basicDefaults),...(f.patientFirstName||f.patientLastName?{}:{transportType:basicDefaults.transportType??f.transportType})}));
        if (!initialDraft && prefs.default_payer_id) applyPayer(prefs.default_payer_id, pys as any[]);
      } catch { /* optional helpers only */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portal]);
  const choosePatient = (id: string) => {
    setPatientChoice(id); setPatientSearch('');
    const p = patients.find((x) => x.id === id);
    if (!p) return;
    setForm((f) => ({ ...f,...approvedPatientDefaults(p),pickupAddress:p.default_pickup_address??f.pickupAddress,pickupCity:p.default_pickup_city??f.pickupCity,dropoffAddress:p.default_dropoff_address??f.dropoffAddress,dropoffCity:p.default_dropoff_city??f.dropoffCity,pickupState:p.state||f.pickupState,pickupZip:p.zip??f.pickupZip,pickupCounty:p.county_equivalent??f.pickupCounty,pickupTimezone:p.timezone||f.pickupTimezone,mobilityNotes:writeMobility(p.assistance_needs??f.mobilityNotes,[...(p.mobility==='wheelchair'?['Wheelchair Required' as const]:[]),...(p.oxygen_required?['Oxygen Required' as const]:[])]),savedPatientId:p.id,patientWorkspaceId:(p as {patient_workspace_id?:string|null}).patient_workspace_id??null } as RideRequestInput));
    if (p.default_payer_id) applyPayer(p.default_payer_id);
  };

  async function onSubmit(e: {preventDefault:()=>void}, referralIntent=false) {
    e.preventDefault();
    if (preview.active && !referralIntent) { previewBlocked(); return; }
    if (commerce?.submissionBlocked) { toast.error('Confirm the changed quote first, or finish the separate controlled Network preparation. Nothing was submitted.'); return; }
    setErrors({});
    const withBilling: RideRequestInput = {
      ...form,recurrence:"none",recurrenceEndDate:"",
      customerQuoteDraftId: commerce?.quote?.draftId ?? null,
      customerQuoteId: commerce?.quote?.id ?? null,
      selectedProviderWorkspaceId: allowProviderSelection ? selectedProvider?.workspace_id ?? form.selectedProviderWorkspaceId ?? null : null,
      billingContact:
        form.billingSource === "saved" ? savedBilling ?? undefined
        : form.billingSource === "custom" ? customBilling
        : undefined,
    };
    const parsed = rideRequestSchema.safeParse(withBilling);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        const raw = issue.message ?? "";
        const generic =
          !raw ||
          /^Required$/i.test(raw) ||
          /at least \d+ character/i.test(raw) ||
          /^Invalid/i.test(raw) ||
          /expected|received/i.test(raw);
        errs[key] = generic
          ? key.toLowerCase().includes("email")
            ? "Enter a valid email address."
            : key.toLowerCase().includes("phone")
              ? "Enter a valid phone number."
              : key.toLowerCase().includes("date")
                ? "Choose a date."
                : key.toLowerCase().includes("time")
                  ? "Choose a time."
                  : "This field is required."
          : raw;
      }

      setErrors(errs);
      toast.error("Please fix the highlighted fields.");
      // Bring the first problem field into view so the user can correct it.
      requestAnimationFrame(() => {
        const el = document.querySelector("[data-field-error='true']");
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }

    if(referralIntent){setReferralOpen(true);return;}
    setSubmitting(true);
    try {
      const res = commerce?.provider && commerce.workspaceId ? await ownedSubmit({data:{request:parsed.data,operationId,workspaceId:commerce.workspaceId}}) : await submit({ data: parsed.data });
      if (res.ok) {
        if (draftId && !commerce?.quote) { try { await removeDraft({ data: { draft_id: draftId } }); } catch { toast.error('Request received, but the saved draft could not be removed.'); } }
        if(pendingReferral){
          const tripId='tripId' in res ? res.tripId : null;
          if(tripId){const result=await continueOwnedReferral(tripId,pendingReferral,{prepare:async(id,review)=>{const ready=await readiness({data:{trip_id:id}});if(ready.missing.length)throw new Error('Source readiness required');return (await createReferral({data:{trip_id:id,amount_cents:review.amountCents,expires_at:review.expiresAt,payment_responsibility_confirmed:true,policyConsent:review.consent}})).id;},send:id=>sendWave({data:{distribution_id:id}})});setReferralResult(result);toast(result.message);if(!result.sent && commerce?.workspaceId){try{await auditReferralFailure({data:{workspaceId:commerce.workspaceId,tripId}});}catch{toast.error('Trip retained; referral failure audit could not be recorded.');}}}
          else setReferralResult({tripId:res.id,message:'Trip saved — referral not sent',reason:'Owned operational trip linkage requires review.'});
          setPendingReferral(null);
        }
        // Geocode + compute miles, drive time, traffic-aware ETA & polyline in the background;
        // if it fails we still confirm the booking.
        let enrichedInfo: Partial<NonNullable<typeof done>> = {};
        try {
          if (!('enrichmentToken' in res)) throw new Error('Provider route review remains separate');
          const enriched = await enrich({ data: { id: res.id, token: res.enrichmentToken } });
          if (enriched.ok) {
            enrichedInfo = {
              miles: enriched.miles,
              cents: enriched.estimated_cost_cents,
              durationSec: enriched.duration_seconds,
              trafficSec: enriched.duration_traffic_seconds,
              polyline: enriched.polyline,
              pickupLat: enriched.pickup_lat,
              pickupLng: enriched.pickup_lng,
              dropoffLat: enriched.dropoff_lat,
              dropoffLng: enriched.dropoff_lng,
            };
          }
        } catch { /* ignore — non-fatal */ }
        setDone({ id: res.id, mfnId: (res as any).mfnId ?? null, ...enrichedInfo } as any);
        toast.success('ownedOperation' in res && res.ownedOperation ? "Owned operational trip created. No Network offer was sent." : "Request received for review. Availability and acceptance are not guaranteed.");
        router.invalidate();

      } else {
        toast.error(res.error);
      }
    } catch (err) {
      console.error("trip request submission failed");
      toast.error("Something went wrong. Please try again or call us.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(()=>{if(pendingReferral)void onSubmit({preventDefault:()=>{}});},[pendingReferral]);

  if (done) {
    const hasRoute =
      done.miles != null ||
      done.cents != null ||
      done.trafficSec != null ||
      done.durationSec != null;
    return (
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <p className=" text-xs font-bold text-ds-accent-active uppercase tracking-[0.2em] mb-4">
            Confirmation {(done as any).mfnId ?? `#${done.id.slice(0, 8).toUpperCase()}`}
          </p>
          <h1 className="ds-display mb-6 uppercase text-ds-primary">{referralResult?.message??'Trip request submitted'}</h1>
          {referralResult && <div role="status"><p>{referralResult.reason}</p><Link to="/portal/network" className="ds-label text-ds-link underline">Review / retry in Network</Link></div>}

          {hasRoute && (
            <div className="bg-ds-surface border border-ds-border rounded-ds-sm p-5 mb-6 text-left">
              <div className="grid sm:grid-cols-3 gap-4 mb-4">
                {done.miles != null && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-ds-text-2">Total miles</div>
                    <div className="text-lg font-extrabold">{done.miles.toFixed(1)} mi</div>
                  </div>
                )}
                {done.trafficSec != null && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-ds-text-2">Drive time (traffic)</div>
                    <div className="text-lg font-extrabold">{formatMinutes(done.trafficSec)}</div>
                    {done.durationSec != null && done.durationSec !== done.trafficSec && (
                      <div className="text-[11px] text-ds-text-2">Typical {formatMinutes(done.durationSec)}</div>
                    )}
                  </div>
                )}
                {done.cents != null && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-ds-text-2">Estimated trip cost</div>
                    <div className="text-lg font-extrabold">${(done.cents / 100).toFixed(2)}</div>
                    <div className="text-[11px] text-ds-text-2">
                      {form.tripType === "round_trip" ? "Round trip estimate" : form.tripType === "multi_trip" ? "Multi-stop estimate" : "One-way estimate"}
                    </div>
                  </div>
                )}
              </div>
              <RoutePreview
                polyline={done.polyline}
                pickupLat={done.pickupLat}
                pickupLng={done.pickupLng}
                dropoffLat={done.dropoffLat}
                dropoffLng={done.dropoffLng}
                height={240}
              />
              <a
                href={googleRouteUrl(done.pickupLat, done.pickupLng, done.dropoffLat, done.dropoffLng)}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-xs font-bold uppercase tracking-wider text-ds-primary hover:underline"
              >
                Open route in Google Maps →
              </a>
              <p className="mt-4 text-[11px] leading-relaxed text-ds-text-2 border-t border-ds-border pt-3">
                <strong className="font-bold text-ds-on-surface">This is an estimate only.</strong> The final price is set by the accepting provider and may change with wait time, additional stops, or manual quoting. A provider confirms pricing before accepting the trip.
              </p>
            </div>
          )}

          <p className="ds-body-lg mb-10 text-ds-text-2">
            Your request was received for review. Submitting <strong>does not guarantee availability or acceptance</strong> — a participating independent provider must review and accept it. We'll contact you using the details you provided.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {portal ? (
              <Link to="/portal/requests" className="ds-button-text inline-flex min-h-12 items-center rounded-ds-sm bg-ds-primary px-6 uppercase text-ds-on-primary hover:bg-ds-primary-hover">View my requests</Link>
            ) : (<>
              <Link to="/" className="ds-button-text inline-flex min-h-12 items-center rounded-ds-sm bg-ds-primary px-6 uppercase text-ds-on-primary hover:bg-ds-primary-hover">Back to home</Link>
              <a href={LINKS.createAccount} className="ds-button-text inline-flex min-h-12 items-center rounded-ds-sm bg-ds-sky px-6 uppercase text-ds-primary hover:bg-ds-hover">Create an account</a>
            </>)}
          </div>
        </div>
      </section>
    );
  }

  return (
    <CompactTimeContext.Provider value={!!commerce?.provider}>
    <section className={portal ? "" : "bg-ds-bg px-5 py-16 sm:px-6 lg:py-20"}>
      <div className={portal ? 'min-w-0 w-full' : 'mx-auto max-w-3xl'}>
        {!commerce && (portal ? <h1 className="ds-section-title uppercase text-ds-primary">New trip</h1> : <h1 className="ds-display text-center uppercase text-ds-primary">Book a trip</h1>)}
        {!commerce?.provider && <p className="ds-body-lg mx-auto mt-4 max-w-[46rem] text-center text-ds-text-2">
          {patientAccount ? 'Choose your provider and enter your trip details. Acceptance is not guaranteed.' : commerce ? allowProviderSelection ? 'Prepare a request for your selected provider. Your facility’s billing responsibility and approved agreement are reviewed separately. Acceptance is not guaranteed.' : 'Prepare your own workspace trip. Saving or submitting does not share it to the Referral Network, send an invoice or collect payment.' : 'Share the trip details below. Requests stay under MY FLORIDA NEMT review unless you intentionally select a provider. Submitting does not guarantee a ride.'}
        </p>}
        {!commerce?.provider && <div role="note" className="ds-body-lg mx-auto mt-6 mb-6 max-w-[46rem] rounded-ds bg-ds-membership p-5 text-center text-ds-primary">
          <strong>We recommend submitting requests 48–72 hours in advance.</strong> Short-notice requests may be submitted for review, but availability and acceptance are not guaranteed.
        </div>}
        {!commerce?.provider && <NonEmergencyNotice className="mb-10" />}
        {portal && !onBehalf && !commerce?.provider && kind === 'ride' && <div className="mb-5 flex justify-end"><DsButton type="button" variant="secondary" disabled={savingDraft} onClick={onSaveDraft}>{savingDraft ? 'Saving…' : 'Save draft'}</DsButton></div>}

        {kind === "ride" && <fieldset data-form-section="Trip Type" className="mb-6">
          <legend className="ds-label mb-3 block text-ds-on-surface">Trip type</legend>
              <div role="radiogroup" aria-label="Trip type" className="trip-type-group grid grid-cols-3 gap-2 sm:max-w-xl">
                {(["one_way", "round_trip", "multi_trip"] as const).map((t) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={form.tripType === t}
                    key={t}
                    onClick={() => {
                      if (form.tripType === "multi_trip" && t !== "multi_trip") setStashedLegs(form.additionalStops);
                      setForm((f) => ({
                        ...f,
                        tripType: t,
                        roundTrip: t === "round_trip",
                        // Default the return leg time to the pickup time when switching to round trip
                        returnPickupTime:
                          f.returnPickupTime,
                        // Default the return date to the pickup date when switching to round trip
                        returnDate:
                          t === "round_trip"
                            ? (returnDateManual && f.returnDate ? f.returnDate : f.pickupDate)
                            : "",
                        // Clear stops when leaving multi-trip; otherwise keep them
                        // Legs are stashed (not discarded) when leaving Multi Trip and restored on return.
                        additionalStops: t === "multi_trip" ? (f.additionalStops.length ? f.additionalStops : stashedLegs.length ? stashedLegs : [{ address: "", city: "", pickupTime: "", note: "" }]) : [],
                      }));
                      if (t !== "round_trip") setReturnDateManual(false);
                    }}
                    className={`px-3 py-2.5 border rounded-ds-sm text-xs font-bold uppercase tracking-wide transition-all ${
                      form.tripType === t
                        ? "border-primary bg-ds-action text-ds-on-action"
                        : "border-ds-border hover:border-ds-sky-border"
                    }`}
                  >
                    {TRIP_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
          {form.tripType === "multi_trip" && <p className="mt-2 text-xs text-ds-text-2">Ordered legs: Pickup → each leg → final Drop-Off. Edit, reorder or remove legs below.</p>}
        </fieldset>}

        <fieldset data-form-section="Transportation Type" className="mb-8">
          <legend className="ds-label mb-3 block text-ds-on-surface">Transportation type</legend>
          <div role="radiogroup" aria-label="Transportation type" className={commerce?.provider ? "grid gap-2 sm:grid-cols-2 xl:grid-cols-5" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"}>
            {SERVICE_CHOICES.map((c) => {
              const on = c.kind === "delivery" ? kind === "delivery" : c.id === "child-care" ? kind === "ride" && childCare : kind === "ride" && !childCare && form.transportType === c.type;
              return (
                <DsButton key={c.id} type="button" role="radio" aria-checked={on} variant={on ? "primary" : "secondary"}
                  onClick={() => { setKind(c.kind); if (c.id === "child-care") { const rows = resizeChildren(children, children.length || 1); setForm(f => ({ ...f, serviceLine: "child_care", children: rows, transportType: childCareTransport(rows), passengerCount: totalPassengers(additionalFromTotal(f.passengerCount, childCare ? children.length : 0), rows.length) })); } else if (c.type) { const t = c.type; setForm(f => ({ ...f, serviceLine: "medical", children: [], transportType: t, passengerCount: totalPassengers(additionalFromTotal(f.passengerCount, childCare ? children.length : 0)) })); } }}
                  className={`ds-button-text min-h-12 min-w-0 rounded-ds-sm px-3 uppercase ds-transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus ${on ? "bg-ds-action text-ds-on-action" : "bg-ds-sky text-ds-primary hover:bg-ds-hover"}`}>
                  {c.label}
                </DsButton>
              );
            })}
          </div>
        </fieldset>

        {kind === "delivery" ? (
          <DeliveryRequestForm portal={portal} initialDraft={initialDraft?.payload.requestCategory === "medical_delivery" ? initialDraft : undefined} />
        ) : (
        <form noValidate onSubmit={onSubmit} className={`space-y-8 bg-ds-surface rounded-ds-sm ${portal ? '' : 'border border-ds-border p-4 sm:p-6'}`}>
          {initialDraft && <div className="flex flex-wrap items-center justify-between gap-3"><p className="ds-caption break-all">Draft ID: {commerce?.draftId ?? draftId}</p><DsButton type="button" variant="ghost" onClick={()=>window.history.back()}>Cancel</DsButton></div>}

          {allowProviderSelection && !selectedProvider && form.selectedProviderWorkspaceId && <p className="ds-caption">Provider selection retained from the draft; server authorization is rechecked on submission.</p>}
          {allowProviderSelection && !onBehalf && <PatientProviderPicker value={selectedProvider} onChange={p=>{setSelectedProvider(p);upd('selectedProviderWorkspaceId',p?.workspace_id??null);}} />}
          {commerce?.provider && form.savedPatientId && <PatientDriverSuggestion patientId={form.savedPatientId} service={form.transportType==='gurney'?'stretcher':form.transportType} date={form.pickupDate||undefined} onConfirm={confirmDriver}/>}
          {patientAccount && <Field label="Who is this trip for?"><select className={inputCls} value={bookingFor} onChange={e => {
            const next = e.target.value === 'other' ? 'other' : 'self'; setBookingFor(next); setPatientChoice('');
            setForm(f => ({...f, patientWorkspaceId:null, savedPatientId:null, patientFirstName:next === 'self' ? selfDefaults?.patientFirstName ?? '' : '', patientLastName:next === 'self' ? selfDefaults?.patientLastName ?? '' : '', patientPhone:next === 'self' ? selfDefaults?.patientPhone ?? '' : '', patientEmail:next === 'self' ? selfDefaults?.patientEmail ?? '' : ''}));
          }}><option value="self">Booking for myself</option><option value="other">Booking for another patient</option></select></Field>}
          {portal && !onBehalf && (!patientAccount || bookingFor === 'other') && <LinkedPatientSelector value={form.patientWorkspaceId} onChange={id => setForm(f=>({...f,patientWorkspaceId:id,savedPatientId:null}))} onDefaults={d=>setForm(f=>({...f,...d,savedPatientId:null}))} />}
          {facilityPatients.length>0 && <Field label="Facility-authorized linked patient"><select className={inputCls} value={form.savedPatientId??''} onChange={e=>{const p=facilityPatients.find(p=>p.savedPatientId===e.target.value);if(p && confirm('Attach this confirmed patient and fill only basic trip details?'))setForm(f=>({...f,patientFirstName:p.patientFirstName??'',patientLastName:p.patientLastName??'',patientPhone:p.patientPhone??'',patientEmail:p.patientEmail??'',transportType:p.transportType??'ambulatory',patientWorkspaceId:p.patientWorkspaceId,savedPatientId:p.savedPatientId}));}}><option value="">Choose authorized patient</option>{facilityPatients.map(p=><option key={p.savedPatientId} value={p.savedPatientId}>{p.patientFirstName} {p.patientLastName} · {p.facilityMfnId}</option>)}</select></Field>}

          {/* Patient */}
          <fieldset data-form-section="Passenger Information" className="space-y-6">
            <legend className="text-sm font-bold uppercase tracking-widest text-ds-primary mb-2">
              {childCare ? "Parent / Guardian information" : "Passenger information"}
            </legend>
            {portal && patients.length > 0 && (!patientAccount || bookingFor === 'other') && (
              <Field label="Saved patient">
                <select className={inputCls} value={patientChoice} onChange={(e) => choosePatient(e.target.value)}>
                  <option value="">Choose a saved patient (optional)…</option>
                  {patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                </select>
              </Field>
            )}
            {payerNote && <p className="ds-support rounded-ds-sm border border-ds-border bg-ds-bg px-3 py-2">{payerNote}</p>}
            <div className="grid md:grid-cols-2 gap-6">
              <Field label="First name" required error={errors.patientFirstName}>
                <input className={inputCls} value={form.patientFirstName} onChange={(e) => { upd("patientFirstName", e.target.value); setPatientSearch(e.target.value); }} />
              </Field>
              <Field label="Last name" required error={errors.patientLastName}>
                <input className={inputCls} value={form.patientLastName} onChange={(e) => { upd("patientLastName", e.target.value); setPatientSearch(e.target.value); }} />
              </Field>
              <Field label="Phone" required error={errors.patientPhone}>
                <input type="tel" className={inputCls} value={form.patientPhone} onChange={(e) => { upd("patientPhone", e.target.value); setPatientSearch(e.target.value); }} placeholder="(555) 555-0123" />
              </Field>
              <Field label="Email" error={errors.patientEmail}>
                <input type="email" className={inputCls} value={form.patientEmail} onChange={(e) => { upd("patientEmail", e.target.value); setPatientSearch(e.target.value); }} />
              </Field>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Additional passengers" error={errors.passengerCount}>
                <select className={inputCls} value={additionalPassengers} onChange={e=>upd('passengerCount',totalPassengers(Number(e.target.value),childCare?children.length:0))}>{ADDITIONAL_PASSENGER_CHOICES.map(n=><option key={n} value={n}>{n===0?'None':n}</option>)}</select>
              </Field>
              {form.transportType==='wheelchair' && !childCare && <Field label="Wheelchair positions" error={errors.wheelchairPositions}><select className={inputCls} value={form.wheelchairPositions||1} onChange={e=>upd('wheelchairPositions',Number(e.target.value))}>{Array.from({length:form.passengerCount},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}</option>)}</select></Field>}
            </div>
            {commerce?.provider && matchingTripPatients(patients,patientSearch).length>0 && <div role="listbox" aria-label="Matching saved patients" className="grid gap-2">{matchingTripPatients(patients,patientSearch).map(p=><DsButton key={p.id} type="button" role="option" aria-selected={patientChoice===p.id} variant="secondary" onClick={()=>choosePatient(p.id)}>{p.first_name} {p.last_name} · {p.phone??p.email}</DsButton>)}</div>}
          </fieldset>


          {childCare && (
            <fieldset data-form-section="Child Information" className="space-y-4">
              <legend className="text-sm font-bold uppercase tracking-widest text-ds-primary mb-2">Child information</legend>
              <Field label="Number of children" required error={errors.children}>
                <select className={inputCls} value={children.length} onChange={e=>setChildren(resizeChildren(children,Number(e.target.value)))}>{CHILD_COUNT_CHOICES.map(n=><option key={n} value={n}>{n}</option>)}</select>
              </Field>
              {children.map((c,i)=>(
                <div key={i} className="grid gap-4 md:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)]" data-child-row={i+1}>
                  <Field label={`Child ${i+1} first name`} required error={errors[`children.${i}.firstName`]}><input className={inputCls} value={c.firstName} onChange={e=>setChildren(children.map((r,k)=>k===i?{...r,firstName:e.target.value}:r))}/></Field>
                  <Field label="Age" required error={errors[`children.${i}.age`]}><input className={inputCls} type="number" inputMode="numeric" min={0} max={17} value={c.age??''} onChange={e=>setChildren(children.map((r,k)=>k===i?{...r,age:e.target.value===''?null:Number(e.target.value)}:r))}/></Field>
                  <Field label="Transportation requirement" error={errors[`children.${i}.requirement`]}><select className={inputCls} value={c.requirement} onChange={e=>setChildren(children.map((r,k)=>k===i?{...r,requirement:e.target.value as ChildRow['requirement']}:r))}>{CHILD_REQUIREMENTS.map(v=><option key={v} value={v}>{CHILD_REQUIREMENT_LABELS[v]}</option>)}</select></Field>
                </div>
              ))}
              <p className="ds-caption">Child details stay with this request for authorized reviewers only. Acceptance and pricing require provider review.</p>
            </fieldset>
          )}

          {/* Pickup */}
          <fieldset data-form-section="Pickup" className="space-y-6">
            <legend className="text-sm font-bold uppercase tracking-widest text-ds-primary mb-2">Pickup</legend>
            <Field label={childCare ? "Home Pickup Address" : "Pickup Address"} required error={errors.pickupAddress}>
              <AddressAutocomplete
                value={form.pickupAddress}
                onChange={(v) => upd("pickupAddress", v)}
                onSelect={(sel: AddressSelection) => {
                  upd("pickupAddress", sel.address);
                  if (sel.city) upd("pickupCity", sel.city);
                  setForm(f=>({...f,pickupState:sel.state||undefined,pickupZip:sel.zip,pickupCounty:sel.county,pickupTimezone:coordinateTimezone(sel.lat,sel.lng) as RideRequestInput['pickupTimezone']}));
                  setPickupMeta({ zip: sel.zip, state: sel.state, lat: sel.lat, lng: sel.lng });
                }}
                placeholder="Street, suite/unit"
                className={inputCls}
              />
            </Field>
            {!commerce?.provider && <Field label="Building / Doctor's office / Suite (optional)" error={errors.pickupAddressDetails}>
              <input className={inputCls} value={form.pickupAddressDetails ?? ""} onChange={(e) => upd("pickupAddressDetails", e.target.value)} placeholder="e.g. Baptist MOB Suite 304, side entrance" />
            </Field>}
            <Field label="City" required error={errors.pickupCity}>
              <input className={inputCls} value={form.pickupCity} onChange={(e) => upd("pickupCity", e.target.value)} list="fl-cities" />
            </Field>
            <div className="grid gap-6 md:grid-cols-3">
              <Field label="Pickup Date" required error={errors.pickupDate}>
                <DatePickerField
                  value={form.pickupDate}
                  onChange={(v) => {
                    setForm((f) => ({
                      ...f,
                      pickupDate: v,
                      returnDate: !returnDateManual && f.tripType === "round_trip" ? v : f.returnDate,
                    }));
                  }}
                  booking usFormat
                  required
                />
              </Field>
              <Field label="Pickup Time" required error={errors.pickupTime}>
                <TimePickerField
                  controlLabel="Pickup Time"
                  value={form.pickupTime}
                  pickupDate={form.pickupDate}
                enforceLeadTime={form.pickupState==='FL' && (!form.pickupTimezone||form.pickupTimezone==='America/New_York')}
                  onChange={(v) => {
                    setForm((f) => ({
                      ...f,
                      pickupTime: v,
                      returnPickupTime: f.tripType === "round_trip" && !f.returnPickupTime ? v : f.returnPickupTime,
                      additionalStops: f.additionalStops.map((s) => (s.pickupTime ? s : { ...s, pickupTime: v })),
                    }));
                  }}
                />
              </Field>
              <Field label="Appointment Time" error={errors.appointmentTime ?? chronology.appointmentTime}>
                <TimeSelect label="Appointment Time" value={form.appointmentTime ?? ""} invalid={!!(errors.appointmentTime ?? chronology.appointmentTime)} onChange={(v) => upd("appointmentTime", v)} />
              </Field>
            </div>
            <fieldset data-form-section="Pickup Options" className="trip-option-group">
              <legend className="ds-label mb-2 text-ds-primary">Pickup options</legend>
              <div className="trip-checkbox-grid">{PICKUP_OPTIONS.map(option=><DsCheckbox key={option} label={option} checked={readPickupOptions(form.mobilityNotes).includes(option)} onChange={e=>{const cur=readPickupOptions(form.mobilityNotes);upd('mobilityNotes',writePickupOptions(form.mobilityNotes,e.target.checked?[...cur,option]:cur.filter(v=>v!==option)));}}/>)}</div>
            </fieldset>
            {!locationResolved(form.pickupState, form.pickupZip) && <div data-manual-location="pickup" className="space-y-2"><p className="ds-caption">Address not matched by map lookup — enter the state and ZIP manually.</p><RegionalAddressFields value={form} side="pickup" onChange={fields=>setForm(f=>({...f,...fields}) as RideRequestInput)}/></div>}
          </fieldset>

          {/* Dropoff */}
          <fieldset data-form-section="Drop-Off" className="space-y-6">
            <legend className="text-sm font-bold uppercase tracking-widest text-ds-primary mb-2">Drop-off</legend>
            <Field label={childCare ? "School Drop-Off Address" : "Drop-Off Address"} required error={errors.dropoffAddress}>
              <AddressAutocomplete
                value={form.dropoffAddress}
                onChange={(v) => upd("dropoffAddress", v)}
                onSelect={(sel: AddressSelection) => {
                  upd("dropoffAddress", sel.address);
                  if (sel.city) upd("dropoffCity", sel.city);
                  setForm(f=>({...f,dropoffState:sel.state||undefined,dropoffZip:sel.zip,dropoffCounty:sel.county,dropoffTimezone:coordinateTimezone(sel.lat,sel.lng) as RideRequestInput['dropoffTimezone']}));
                  setDropoffMeta({ zip: sel.zip, state: sel.state, lat: sel.lat, lng: sel.lng });
                }}
                className={inputCls}
              />
            </Field>
            {(!form.dropoffCity || !locationResolved(form.dropoffState, form.dropoffZip) || errors.dropoffCity) && <Field label="Drop-Off City" required error={errors.dropoffCity}>
              <input className={inputCls} value={form.dropoffCity} onChange={(e) => upd("dropoffCity", e.target.value)} list="fl-cities" />
            </Field>}
            {form.tripType === 'multi_trip' ? <div role="status" data-total-trip-time className="space-y-1"><span className="ds-label">Estimated Total Trip Time</span><p className="ds-body font-semibold">{routed.totalSeconds != null ? `${formatMinutes(routed.totalSeconds)} (estimated driving time)` : routed.status === 'loading' ? 'Calculating…' : 'Review Required — complete route duration unavailable.'}</p><p className="ds-caption">Driving time for every current leg; excludes appointments, waiting and stops.</p></div> : <Field label="Estimated Drop-Off Time" error={errors.dropoffTime}>
              <TimeSelect label="Estimated Drop-Off Time" value={form.dropoffTime ?? ""} onChange={(v) => { manualArrival.current = true; autoArrival.current = false; setDropoffManual(true); setForm(f=>({...f,dropoffTime:v,dropoffDate:v ? (f.dropoffDate || f.pickupDate) : ''})); }} />
              <p role="status" className="mt-1 text-xs text-ds-text-2">{dropoffManual ? 'Manual estimate — retained when the route changes.' : routeEstimate ? `Estimated from outbound Google Maps driving time.${arrivalDate && arrivalDate !== form.pickupDate ? ` Arrival ${formatUsDate(arrivalDate)} (next day).` : ''} Final timing is confirmed by the provider.` : routed.status === 'loading' ? 'Calculating route duration… You can enter a manual estimate.' : 'Review Required — route estimate unavailable. Enter a manual estimate or leave blank for provider review.'}</p>
            </Field>}
            {!locationResolved(form.dropoffState, form.dropoffZip) && <div data-manual-location="dropoff" className="space-y-2"><p className="ds-caption">Address not matched by map lookup — enter the state and ZIP manually.</p><RegionalAddressFields hideTimezone={commerce?.provider} value={form} side="dropoff" onChange={fields=>setForm(f=>({...f,...fields}) as RideRequestInput)}/></div>}
            {!commerce && !childCare && form.pickupState==='FL' && form.dropoffState==='FL' && (
              <PriceEstimate
                pickupZip={pickupMeta.zip}
                miles={estimatedMiles}
                transportType={form.transportType}
                legs={form.tripType === "round_trip" ? 2 : form.tripType === "multi_trip" ? 1 + form.additionalStops.length : 1}
                stops={form.tripType === "multi_trip" ? form.additionalStops.length : 0}
                tripTypeLabel={TRIP_TYPE_LABELS[form.tripType]}
              />
            )}
          </fieldset>

            {form.tripType === "round_trip" && (
              <div className="border border-dashed border-ds-border rounded-ds-sm p-4 grid md:grid-cols-2 gap-6">
                <Field label="Return date" required error={(errors as any).returnDate}>
                  <DatePickerField
                    value={form.returnDate ?? ""}
                    onChange={(v) => {
                      setReturnDateManual(true);
                      upd("returnDate", v);
                    }}
                    booking
                  />
                  <p className="mt-1 text-xs text-ds-text-2">
                    Defaults to your pickup date. Change it if the patient returns on a different day (e.g. surgery).
                  </p>
                </Field>
                <Field label="Return pickup time" required error={errors.returnPickupTime ?? chronology.returnPickupTime}>
                  <TimePickerField
                    controlLabel="Return Pickup Time"
                    value={form.returnPickupTime ?? ""}
                    pickupDate={form.returnDate || form.pickupDate}
                    enforceLeadTime
                    onChange={(v) => upd("returnPickupTime", v)}
                    helperText="When the patient is ready to be picked up after the appointment."
                  />
                </Field>
                <Field label="Return drop-off time" error={errors.returnDropoffTime}>
                  <TimeSelect
                      label="Return Drop-Off Time"
                    value={form.returnDropoffTime ?? ""}
                    onChange={(v) => upd("returnDropoffTime", v)}
                  />
                  <p className="mt-1 text-xs text-ds-text-2">Optional — expected arrival back home.</p>
                </Field>
                <Field label="Return pickup building" error={(errors as any).returnPickupBuilding}>
                  <input
                    className={inputCls}
                    value={form.returnPickupBuilding ?? ""}
                    onChange={(e) => upd("returnPickupBuilding", e.target.value)}
                    placeholder="e.g. Medical Arts Building B"
                  />
                </Field>
                <Field label="Return pickup doctor / office" error={(errors as any).returnPickupDoctor}>
                  <input
                    className={inputCls}
                    value={form.returnPickupDoctor ?? ""}
                    onChange={(e) => upd("returnPickupDoctor", e.target.value)}
                    placeholder="e.g. Dr. Smith"
                  />
                </Field>
                <Field label="Return pickup suite" error={(errors as any).returnPickupSuite}>
                  <input
                    className={inputCls}
                    value={form.returnPickupSuite ?? ""}
                    onChange={(e) => upd("returnPickupSuite", e.target.value)}
                    placeholder="e.g. Suite 210"
                  />
                </Field>
              </div>
            )}



            {form.tripType === "multi_trip" && (
              <div data-form-section="Additional Stops" className="space-y-4">
                <div className="flex flex-col items-start gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-ds-text-2">Multi Trip legs</span>
                  <button
                    type="button"
                    onClick={() =>
                      setForm(f=>({...f,tripType:"multi_trip",roundTrip:false,additionalStops:[...f.additionalStops,{ address: "", city: "", pickupTime: "", note: "" }]}))
                    }
                    disabled={form.additionalStops.length >= 10}
                    className="trip-compact-action"
                  >
                    + Add Leg
                  </button>
                </div>
                <p className="text-xs text-ds-text-2">Each leg is the next pickup/drop-off point in order, ending at the Drop-Off above. Times on the same date must follow the preceding leg.</p>
                <ol className="space-y-3">
                {form.additionalStops.map((stop, i) => {
                  const setStop = (patch: Partial<typeof stop>) => { const next = [...form.additionalStops]; next[i] = { ...stop, ...patch }; upd("additionalStops", next); };
                  const move = (dir: -1 | 1) => { const next = [...form.additionalStops]; const j = i + dir; if (j < 0 || j >= next.length) return; [next[i], next[j]] = [next[j]!, next[i]!]; upd("additionalStops", next); };
                  const err = errors[`additionalStops.${i}.address`] || errors[`additionalStops.${i}.city`] || errors[`additionalStops.${i}.pickupTime`] || chronology[`additionalStops.${i}.pickupTime`];
                  return (
                  <li key={i} data-trip-leg={i + 1} className="trip-leg-card space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="ds-label text-ds-primary">Leg {i + 2}</span>
                      <div className="flex flex-wrap gap-1.5">
                        <button type="button" className="trip-compact-action" aria-label={`Move leg ${i + 2} up`} disabled={i === 0} onClick={() => move(-1)}>↑ Up</button>
                        <button type="button" className="trip-compact-action" aria-label={`Move leg ${i + 2} down`} disabled={i === form.additionalStops.length - 1} onClick={() => move(1)}>↓ Down</button>
                        <button type="button" className="trip-compact-action" aria-label={`Remove leg ${i + 2}`} onClick={() => setForm(f=>{const next=f.additionalStops.filter((_, idx) => idx !== i);return {...f,additionalStops:next,tripType:next.length?"multi_trip":"one_way"};})}>Remove</button>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,12rem)]">
                      <Field label={`Leg ${i + 2} address`}>
                        <AddressAutocomplete value={stop.address} onChange={(v) => setStop({ address: v })} onSelect={(sel: AddressSelection) => setStop({ address: sel.address, ...(sel.city ? { city: sel.city } : {}), ...(sel.state ? { state: sel.state as typeof stop.state } : {}), ...(sel.zip ? { zip: sel.zip } : {}), ...(sel.county ? { county: sel.county } : {}), timezone: coordinateTimezone(sel.lat, sel.lng) as RideRequestInput['pickupTimezone'] })} className={inputCls} />
                      </Field>
                      <Field label="City"><input className={inputCls} list="fl-cities" value={stop.city} onChange={(e) => setStop({ city: e.target.value })} /></Field>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label={`Leg ${i + 2} date`}><DatePickerField value={stop.date || form.pickupDate} onChange={v => setStop({ date: v })} booking usFormat /></Field>
                      <Field label={`Leg ${i + 2} pickup time`}><TimeSelect label={`Leg ${i + 2} pickup time`} value={stop.pickupTime ?? ""} onChange={(v) => setStop({ pickupTime: v })} /></Field>
                    </div>
                    {!locationResolved(stop.state, stop.zip) && stop.address.length > 2 && <RegionalAddressFields hideTimezone={commerce?.provider} value={{pickupState:stop.state,pickupZip:stop.zip,pickupCounty:stop.county,pickupTimezone:stop.timezone}} side="pickup" onChange={fields=>setStop({...(fields.pickupState!==undefined?{state:fields.pickupState}:{}),...(fields.pickupZip!==undefined?{zip:fields.pickupZip}:{}),...(fields.pickupCounty!==undefined?{county:fields.pickupCounty}:{}),...(fields.pickupTimezone!==undefined?{timezone:fields.pickupTimezone as RideRequestInput['pickupTimezone']}:{})})}/>}
                    {err && <p role="alert" className="text-xs text-ds-error">{err}</p>}
                  </li>);
                })}
                </ol>
              </div>
            )}

          <fieldset data-form-section="Mobility Requirements" className="space-y-3">
            <legend className="text-sm font-bold uppercase tracking-widest text-ds-primary mb-2">Mobility requirements</legend>
            <div className="trip-checkbox-grid">{VISIBLE_MOBILITY_OPTIONS.map(option=><DsCheckbox key={option} label={option} checked={readMobility(form.mobilityNotes).selected.includes(option)} onChange={e=>upd('mobilityNotes',writeMobility(form.mobilityNotes,e.target.checked?[...readMobility(form.mobilityNotes).selected,option]:readMobility(form.mobilityNotes).selected.filter(v=>v!==option)))}/>)}</div>
            {readMobility(form.mobilityNotes).legacy && <p className="ds-support whitespace-pre-wrap">Retained mobility notes: {readMobility(form.mobilityNotes).legacy}</p>}
          </fieldset>

          <div data-form-section="Mobility / Special Instructions">
            <Field label="Mobility / Special Instructions" error={errors.specialInstructions}>
              <textarea
                className={`${inputCls} min-h-[80px]`}
                value={form.specialInstructions}
                onChange={(e) => upd("specialInstructions", e.target.value)}
                placeholder="Gate codes, building entry, appointment time..."
              />
            </Field>
          </div>
          {!commerce?.provider && <TripLegsPreview className="mt-2" legs={buildLegs(form)} />}

          {portal && !onBehalf && <div className="trip-secondary-actions flex flex-wrap items-start gap-3">
          {portal && !onBehalf && <TripSeriesBuilder source={{...form,selectedProviderWorkspaceId:allowProviderSelection?selectedProvider?.workspace_id??form.selectedProviderWorkspaceId??null:null,billingContact:form.billingSource==='custom'?customBilling:form.billingSource==='saved'?savedBilling??undefined:undefined}} blocked={commerce?.submissionBlocked}/>}

          {commerce?.provider && commerce.workspaceId && <ProviderInvitation workspaceId={commerce.workspaceId}/>}
          </div>}

          <div data-form-section="Billing">
          {commerce?.provider && (<fieldset className="space-y-4">
            <legend className="text-sm font-bold uppercase tracking-widest text-ds-primary mb-2">
              Billing information
            </legend>
            {portal && <div className="space-y-3"><Field label="Authorized payer"><select className={inputCls} value={form.payerId??''} onChange={e=>{if(e.target.value)applyPayer(e.target.value);else upd('payerId',null);}}><option value="">No saved payer selected</option>{payers.filter(p=>p.active!==false).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><Field label="Trip coordination contact"><select className={inputCls} value={form.coordinationContactId??''} onChange={e=>upd('coordinationContactId',e.target.value||null)}><option value="">No contact selected</option>{contacts.filter(c=>c.active && c.coordination_allowed).map(c=><option key={c.id} value={c.id}>{c.company_name||`${c.first_name??''} ${c.last_name??''}`}</option>)}</select></Field><div className="flex flex-wrap gap-2"><DsButton type="button" variant="ghost" onClick={()=>setAddingPayer(true)}>Add payer</DsButton><DsButton type="button" variant="ghost" onClick={()=>setAddingContact(true)}>Add contact</DsButton></div><p className="ds-support">Billing and trip coordination only. Secure payment-method collection is not activated.</p></div>}
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.billingSource === "account"}
                onChange={(e) =>
                  setForm(f=>({...f,billingSource:e.target.checked?'account':savedBilling?'saved':'custom',payerId:null}))
                }
              />
              <span>Use same information as account holder</span>
            </label>

            {form.billingSource !== "account" && (
              <div className="space-y-4 pl-6 border-l-2 border-ds-border">
                {savedBilling && (
                  <div className="flex flex-wrap gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="billingSource"
                        checked={form.billingSource === "saved"}
                        onChange={() => upd("billingSource", "saved")}
                      />
                      <span>
                        Use saved billing contact ({savedBilling.firstName} {savedBilling.lastName})
                      </span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="billingSource"
                        checked={form.billingSource === "custom"}
                        onChange={() => upd("billingSource", "custom")}
                      />
                      <span>Enter different billing contact for this trip</span>
                    </label>
                  </div>
                )}

                {form.billingSource === "custom" && (
                  <div className="grid md:grid-cols-2 gap-6">
                    <Field label="First name" required error={errors["billingContact.firstName"]}>
                      <input className={inputCls} value={customBilling.firstName}
                        onChange={(e) => setCustomBilling((b) => ({ ...b, firstName: e.target.value }))} />
                    </Field>
                    <Field label="Last name" required error={errors["billingContact.lastName"]}>
                      <input className={inputCls} value={customBilling.lastName}
                        onChange={(e) => setCustomBilling((b) => ({ ...b, lastName: e.target.value }))} />
                    </Field>
                    <Field label="Email" required error={errors["billingContact.email"]}>
                      <input type="email" className={inputCls} value={customBilling.email}
                        onChange={(e) => setCustomBilling((b) => ({ ...b, email: e.target.value }))} />
                    </Field>
                    <Field label="Phone" required error={errors["billingContact.phone"]}>
                      <input type="tel" className={inputCls} value={customBilling.phone}
                        onChange={(e) => setCustomBilling((b) => ({ ...b, phone: e.target.value }))} />
                    </Field>
                  </div>
                )}
              </div>
            )}
          </fieldset>)}


          {!commerce?.provider && (<fieldset className="space-y-4">
            <legend className="text-sm font-bold uppercase tracking-widest text-ds-primary mb-2">
              Billing information
            </legend>
            {portal && <div className="space-y-3"><Field label="Authorized payer"><select className={inputCls} value={form.payerId??''} onChange={e=>{if(e.target.value)applyPayer(e.target.value);else upd('payerId',null);}}><option value="">No saved payer selected</option>{payers.filter(p=>p.active!==false).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><Field label="Trip coordination contact"><select className={inputCls} value={form.coordinationContactId??''} onChange={e=>upd('coordinationContactId',e.target.value||null)}><option value="">No contact selected</option>{contacts.filter(c=>c.active && c.coordination_allowed).map(c=><option key={c.id} value={c.id}>{c.company_name||`${c.first_name??''} ${c.last_name??''}`}</option>)}</select></Field><div className="flex flex-wrap gap-2"><DsButton type="button" variant="ghost" onClick={()=>setAddingPayer(true)}>Add payer</DsButton><DsButton type="button" variant="ghost" onClick={()=>setAddingContact(true)}>Add contact</DsButton></div><p className="ds-support">Billing and trip coordination only. Secure payment-method collection is not activated.</p></div>}
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.billingSource === "account"}
                onChange={(e) =>
                  setForm(f=>({...f,billingSource:e.target.checked?'account':savedBilling?'saved':'custom',payerId:null}))
                }
              />
              <span>Use same information as account holder</span>
            </label>

            {form.billingSource !== "account" && (
              <div className="space-y-4 pl-6 border-l-2 border-ds-border">
                {savedBilling && (
                  <div className="flex flex-wrap gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="billingSource"
                        checked={form.billingSource === "saved"}
                        onChange={() => upd("billingSource", "saved")}
                      />
                      <span>
                        Use saved billing contact ({savedBilling.firstName} {savedBilling.lastName})
                      </span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="billingSource"
                        checked={form.billingSource === "custom"}
                        onChange={() => upd("billingSource", "custom")}
                      />
                      <span>Enter different billing contact for this trip</span>
                    </label>
                  </div>
                )}

                {form.billingSource === "custom" && (
                  <div className="grid md:grid-cols-2 gap-6">
                    <Field label="First name" required error={errors["billingContact.firstName"]}>
                      <input className={inputCls} value={customBilling.firstName}
                        onChange={(e) => setCustomBilling((b) => ({ ...b, firstName: e.target.value }))} />
                    </Field>
                    <Field label="Last name" required error={errors["billingContact.lastName"]}>
                      <input className={inputCls} value={customBilling.lastName}
                        onChange={(e) => setCustomBilling((b) => ({ ...b, lastName: e.target.value }))} />
                    </Field>
                    <Field label="Email" required error={errors["billingContact.email"]}>
                      <input type="email" className={inputCls} value={customBilling.email}
                        onChange={(e) => setCustomBilling((b) => ({ ...b, email: e.target.value }))} />
                    </Field>
                    <Field label="Phone" required error={errors["billingContact.phone"]}>
                      <input type="tel" className={inputCls} value={customBilling.phone}
                        onChange={(e) => setCustomBilling((b) => ({ ...b, phone: e.target.value }))} />
                    </Field>
                  </div>
                )}
              </div>
            )}
          </fieldset>)}

          </div>
          {commerce?.invoiceSlot && <div data-form-section="Live Invoice">{commerce.invoiceSlot}</div>}

          <datalist id="fl-cities">

            {CITY_LIST.map((c) => (
              <option key={c.slug} value={c.name} />
            ))}
          </datalist>

          {!commerce?.provider && <p className="ds-body rounded-ds-sm bg-ds-sky p-4 text-ds-on-surface">
            Want to track requests and save details for next time? <a href={LINKS.createAccount} className="font-semibold text-ds-link underline underline-offset-4">Create your own Patient/Personal or Facility account</a> — it's optional.
          </p>}

          {commerce?.invoiceBottomSlot}
          <div className="provider-trip-actions flex flex-wrap items-stretch gap-3">
            {portal && !onBehalf && (
              <DsButton type="button" variant="secondary" disabled={savingDraft || submitting} onClick={onSaveDraft} className="whitespace-nowrap">
                {savingDraft ? "Saving…" : "Save draft"}
              </DsButton>
            )}
            <DsButton type="submit" disabled={submitting || commerce?.submissionBlocked}>{submitting ? "Submitting…" : "Submit Trip Request"}</DsButton>
            {commerce?.provider && <DsButton type="button" variant="secondary" disabled={submitting || commerce.submissionBlocked} onClick={()=>{setPendingReferral(null);void onSubmit({preventDefault:()=>{}},true);}}>Submit to Referral Network</DsButton>}

          </div>
          <p className="text-xs text-ds-text-2 text-center">
            By submitting you agree to be contacted about this trip. Submitting is a request, not a confirmed booking.
          </p>
        </form>
        )}
        <Dialog open={referralOpen} onOpenChange={setReferralOpen}><DialogContent className="provider-trip-dialog theme-portal max-h-[85dvh] overflow-y-auto"><DialogTitle>Submit to Referral Network</DialogTitle><DialogDescription>The owned trip saves first. A controlled offer requires eligible membership, verified funding, approved launch settings and eligible receivers. No open statewide pool.</DialogDescription><Field label="Provider compensation ($)"><input type="number" min="0.01" step="0.01" className={inputCls} value={compensation} onChange={e=>{setCompensation(e.target.value);setFundingReviewResult('');setPaymentAck(false);setPolicyAck(false);}}/></Field><Field label="Offer expiration"><input type="datetime-local" className={inputCls} value={expiration} onChange={e=>setExpiration(e.target.value)}/></Field><p className="ds-support">{PAYMENT_RESPONSIBILITY_WARNING}</p><DsCheckbox label="I am responsible for paying the receiving provider" checked={paymentAck} onChange={e=>setPaymentAck(e.target.checked)}/><CheckoutAcknowledgment accepted={policyAck} onChange={setPolicyAck}/><DsButton type="button" variant="secondary" disabled={!compensation} onClick={async()=>{if(preview.active){setFundingReviewResult('Preview only — not funded. No offer or payment created.');return;}if(!commerce?.workspaceId)return;try{const r=await fundingReview({data:{workspaceId:commerce.workspaceId,receiverCents:Math.round(Number(compensation)*100),environment:'sandbox'}});setFundingReviewResult(`${r.totalCents===null?'Funding configuration required':`Reviewed sender total $${(r.totalCents/100).toFixed(2)}`} · ${r.blocker}`);}catch{setFundingReviewResult('Funding review unavailable.');}}}>Review funding preparation</DsButton>{fundingReviewResult&&<p role="status" className="ds-support">{fundingReviewResult}</p>}<DsButton type="button" disabled={submitting||!paymentAck||!policyAck||!compensation||!expiration||!fundingReviewResult} onClick={()=>{try{const review={amountCents:Math.round(Number(compensation)*100),expiresAt:new Date(expiration).toISOString(),paymentAcknowledged:paymentAck,consent:currentCheckoutConsent(policyAck)};validateReferralReview(review);if(preview.active){previewBlocked();return;}setPendingReferral(review);setReferralOpen(false);}catch{toast.error('Review compensation, expiration and current terms.');}}}>Confirm referral intent</DsButton>{pendingReferral&&<p className="ds-caption">Submit the reviewed trip to continue.</p>}<DsButton type="button" variant="secondary" onClick={()=>setReferralOpen(false)}>Cancel</DsButton></DialogContent></Dialog>
        {addingPayer && <PayerDialog payer={{active:true}} contacts={contacts.map(c=>({id:c.id,name:c.company_name||`${c.first_name??''} ${c.last_name??''}`}))} onClose={()=>setAddingPayer(false)} onSaved={()=>{setAddingPayer(false);if(!preview.active)void loadPayers().then(setPayers);}}/>}
        {addingContact && <ContactDialog contact={{contact_type:'personal',coordination_allowed:true}} payers={payers.map(p=>({id:p.id,name:p.name}))} onClose={()=>setAddingContact(false)} onSaved={()=>{setAddingContact(false);if(!preview.active)void loadContacts().then(setContacts);}}/>}
      </div>
    </section>
    </CompactTimeContext.Provider>
  );
}

const emptyDelivery: DeliveryRequestInput = {
  pickupState:'FL',dropoffState:'FL',pickupZip:'',dropoffZip:'',pickupCounty:'',dropoffCounty:'',pickupTimezone:'',dropoffTimezone:'',
  requestCategory: "medical_delivery",
  contactFirstName: "",
  contactLastName: "",
  contactPhone: "",
  contactEmail: "",
  pickupAddress: "",
  pickupAddressDetails: "",
  pickupCity: "",
  dropoffAddress: "",
  dropoffCity: "",
  requestedDate: "",
  requestedTime: "",
  deliveryCategory: "medical_supplies",
  deliveryInstructions: "",
  signatureRequired: false,
};

/** Medical Delivery request — kept separate from passenger fields. In-memory state only. */
function DeliveryRequestForm({ portal, initialDraft }: { portal: boolean; initialDraft?: { id: string; payload: Record<string, unknown> } }) {
  const commerce = useContext(TripCommerceContext);
  const preview = usePortalPreview();
  const saveDraft = useServerFn(saveTripDraft);
  const removeDraft = useServerFn(deleteTripDraft);
  const [draftId, setDraftId] = useState(initialDraft?.id);
  const [savingDraft, setSavingDraft] = useState(false);
  const submitSelf = useServerFn(submitDeliveryRequest);
  const submitAdmin = useServerFn(adminSubmitDeliveryRequest);
  const onBehalf = useContext(OnBehalfContext);
  const submit = (a: { data: DeliveryRequestInput }) =>
    onBehalf ? submitAdmin({ data: { ...onBehalf, request: a.data } }) : submitSelf(a);
  const [form, setForm] = useState<DeliveryRequestInput>(() => initialDraft ? { ...emptyDelivery,pickupState:undefined,dropoffState:undefined, deliveryCategory: "" as DeliveryRequestInput["deliveryCategory"], ...restoreDraftFields(initialDraft.payload, Object.keys(deliveryRequestSchema.shape)) } as DeliveryRequestInput : emptyDelivery);
  useEffect(() => { commerce?.onChange(form); }, [form, commerce?.onChange]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [doneId, setDoneId] = useState<string | null>(null);
  const upd = <K extends keyof DeliveryRequestInput>(k: K, v: DeliveryRequestInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const deliveryRoute = useTripRoute(routePoints(form), !!commerce?.provider);
  useEffect(() => { commerce?.onRouteMiles?.({status: deliveryRoute.status, miles: deliveryRoute.miles}); }, [deliveryRoute.status, deliveryRoute.miles, commerce?.onRouteMiles]);

  async function onSubmit(e: {preventDefault:()=>void}, referralIntent=false) {
    e.preventDefault();
    setErrors({});
    if (preview.active) { previewBlocked(); return; }
    if (commerce?.submissionBlocked) { toast.error('Confirm the changed quote first. Nothing was submitted.'); return; }
    const parsed = deliveryRequestSchema.safeParse({ ...form, customerQuoteDraftId: commerce?.quote?.draftId ?? null, customerQuoteId: commerce?.quote?.id ?? null });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        errs[key] = key === "deliveryInstructions" ? "Keep delivery instructions within 500 characters. Your full note is retained here for review." : /email/i.test(key) ? "Enter a valid email address."
          : /phone/i.test(key) ? "Enter a valid phone number."
          : /date/i.test(key) ? "Choose a valid date."
          : /time/i.test(key) ? "Choose a time."
          : "This field is required.";
      }
      setErrors(errs);
      toast.error("Please fix the highlighted fields.");
      requestAnimationFrame(() => document.querySelector("[data-field-error='true']")?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    setSubmitting(true);
    try {
      const res = await submit({ data: parsed.data });
      if (res.ok) {
        setDoneId((res as any).mfnId ?? `#${res.id.slice(0, 8).toUpperCase()}`);
        if (draftId && !commerce?.quote) await removeDraft({ data: { draft_id: draftId } }).catch(() => undefined);
        setForm(emptyDelivery);
      } else toast.error(res.error);
    } catch {
      toast.error("Something went wrong. Please try again or call us.");
    } finally {
      setSubmitting(false);
    }
  }

  if (doneId) {
    return (
      <div role="status" className="rounded-ds-lg bg-ds-sky p-8 text-center">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-ds-accent-active">Request {doneId}</p>
        <h2 className="ds-section-title uppercase text-ds-primary">Delivery request received</h2>
        <p className="ds-body-lg mx-auto mt-4 max-w-[40rem]">
          Your medical delivery request was received for review. Submitting does not guarantee availability or acceptance. We'll contact you using the details you provided.
        </p>
        <Link to={portal ? "/portal/requests" : "/"} className="ds-button-text mt-6 inline-flex min-h-12 items-center rounded-ds-sm bg-ds-primary px-6 uppercase text-ds-on-primary hover:bg-ds-primary-hover">{portal ? "View my requests" : "Back to home"}</Link>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} aria-label="Medical delivery request" className="space-y-10 rounded-ds-sm border border-ds-border bg-ds-surface p-4 sm:p-6">
      {portal && <LinkedPatientSelector value={form.patientWorkspaceId} onChange={id => upd('patientWorkspaceId', id)}/>}
      {initialDraft && <div className="flex flex-wrap items-center justify-between gap-3"><p className="ds-caption break-all">Draft ID: {commerce?.draftId ?? draftId}</p><DsButton type="button" variant="ghost" onClick={()=>window.history.back()}>Cancel</DsButton></div>}
      <div className="rounded-ds-sm bg-ds-membership p-4 text-ds-primary">
        <p className="ds-body"><strong>Medical Delivery</strong> moves items, not passengers. Please don't include diagnoses, medication names or patient medical details.</p>
      </div>

      <fieldset className="space-y-6">
        <legend className="mb-2 text-sm font-bold uppercase tracking-widest text-ds-primary">Your contact information</legend>
        <div className="grid gap-6 md:grid-cols-2">
          <Field label="First name" required error={errors.contactFirstName}><input className={inputCls} autoComplete="given-name" value={form.contactFirstName} onChange={(e) => upd("contactFirstName", e.target.value)} maxLength={80} /></Field>
          <Field label="Last name" required error={errors.contactLastName}><input className={inputCls} autoComplete="family-name" value={form.contactLastName} onChange={(e) => upd("contactLastName", e.target.value)} maxLength={80} /></Field>
          <Field label="Phone" required error={errors.contactPhone}><input type="tel" className={inputCls} autoComplete="tel" value={form.contactPhone} onChange={(e) => upd("contactPhone", e.target.value)} maxLength={30} /></Field>
          <Field label="Email" error={errors.contactEmail}><input type="email" className={inputCls} autoComplete="email" value={form.contactEmail} onChange={(e) => upd("contactEmail", e.target.value)} maxLength={200} /></Field>
        </div>
      </fieldset>

      <fieldset className="space-y-6">
        <legend className="mb-2 text-sm font-bold uppercase tracking-widest text-ds-primary">Pickup location</legend>
        <RegionalAddressFields value={form} side="pickup" onChange={fields=>setForm(f=>({...f,...fields}) as DeliveryRequestInput)}/>
        <Field label="Pickup address" required error={errors.pickupAddress}><input className={inputCls} value={form.pickupAddress} onChange={(e) => upd("pickupAddress", e.target.value)} maxLength={300} /></Field>
        <div className="grid gap-6 md:grid-cols-2">
          <Field label="City" required error={errors.pickupCity}><input className={inputCls} list="fl-cities-delivery" value={form.pickupCity} onChange={(e) => upd("pickupCity", e.target.value)} maxLength={100} /></Field>
          <Field label="Suite, building or entrance" error={errors.pickupAddressDetails}><input className={inputCls} value={form.pickupAddressDetails} onChange={(e) => upd("pickupAddressDetails", e.target.value)} maxLength={200} /></Field>
        </div>
      </fieldset>

      <fieldset className="space-y-6">
        <legend className="mb-2 text-sm font-bold uppercase tracking-widest text-ds-primary">Delivery destination</legend>
        <RegionalAddressFields value={form} side="dropoff" onChange={fields=>setForm(f=>({...f,...fields}) as DeliveryRequestInput)}/>
        <Field label="Delivery address" required error={errors.dropoffAddress}><input className={inputCls} value={form.dropoffAddress} onChange={(e) => upd("dropoffAddress", e.target.value)} maxLength={300} /></Field>
        <Field label="City" required error={errors.dropoffCity}><input className={inputCls} list="fl-cities-delivery" value={form.dropoffCity} onChange={(e) => upd("dropoffCity", e.target.value)} maxLength={100} /></Field>
      </fieldset>

      <fieldset className="space-y-6">
        <legend className="mb-2 text-sm font-bold uppercase tracking-widest text-ds-primary">Timing and Items</legend>
        <div className="grid gap-6 md:grid-cols-2">
          <Field label="Requested date" required error={errors.requestedDate}><input type="date" className={inputCls} value={form.requestedDate} onChange={(e) => upd("requestedDate", e.target.value)} /></Field>
          <Field label="Requested pickup time" required error={errors.requestedTime}><input type="time" step={60} aria-label="Requested pickup time" className={inputCls} value={form.requestedTime} onChange={(e) => upd("requestedTime", e.target.value)} /></Field>
        </div>
        <Field label="Delivery category" required error={errors.deliveryCategory}>
          <select className={inputCls} value={form.deliveryCategory} onChange={(e) => upd("deliveryCategory", e.target.value as DeliveryRequestInput["deliveryCategory"])}>
            <option value="">Choose a delivery category</option>
            {DELIVERY_CATEGORY_OPTIONS.map((o) => <option key={o} value={o}>{DELIVERY_CATEGORY_LABELS[o]}</option>)}
          </select>
        </Field>
        <Field label="Additional Information / handling instructions" error={errors.deliveryInstructions}>
          <textarea className={inputCls} rows={5} placeholder="For example: fragile, keep upright, deliver to front desk." value={form.deliveryInstructions} onChange={(e) => upd("deliveryInstructions", e.target.value)} />
        </Field>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={form.signatureRequired} onChange={(e) => upd("signatureRequired", e.target.checked)} />
          Signature required at delivery
        </label>
      </fieldset>

      {commerce?.invoiceSlot && <div data-delivery-invoice>{commerce.invoiceSlot}</div>}
      {commerce?.invoiceBottomSlot}

      <datalist id="fl-cities-delivery">{CITY_LIST.map((c) => <option key={c.slug} value={c.name} />)}</datalist>

      <div className="flex flex-wrap items-stretch gap-3">
        {portal && !onBehalf && (
          <DsButton type="button" variant="secondary" disabled={savingDraft || submitting} className="whitespace-nowrap" onClick={async () => {
            if (preview.active) { previewBlocked(); return; }
            setSavingDraft(true);
            try { const saved = await saveDraft({ data: { draft_id: commerce?.draftId ?? draftId, payload: { ...initialDraft?.payload, ...form, ...commerce?.draftExtras, requestCategory: "medical_delivery" }, autosaved: false } }); setDraftId(saved.id); commerce?.onDraftSaved?.(saved.id); toast.success("Draft saved securely."); }
            catch { toast.error("Could not save draft."); } finally { setSavingDraft(false); }
          }}>{savingDraft ? "Saving…" : "Save draft"}</DsButton>
        )}
        <DsButton type="submit" disabled={submitting} className="min-w-0 flex-1 whitespace-nowrap">{submitting ? "Submitting…" : "Submit delivery request"}</DsButton>
      </div>
      <p className="text-center text-xs text-ds-text-2">Submitting is a request for review, not a confirmed booking. Availability and acceptance are not guaranteed.</p>
    </form>
  );
}
