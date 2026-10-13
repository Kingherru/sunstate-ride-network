import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { signEnrichmentToken } from "@/lib/enrichment-token.server";

export const RECURRENCE_OPTIONS = ["none", "daily", "weekdays", "weekly", "biweekly", "monthly"] as const;
export type RecurrenceOption = (typeof RECURRENCE_OPTIONS)[number];

export const TRIP_TYPE_OPTIONS = ["one_way", "round_trip", "multi_trip"] as const;
export type TripTypeOption = (typeof TRIP_TYPE_OPTIONS)[number];

export const BLACK_TIE_VEHICLE_OPTIONS = [
  "black_suv",
  "executive_sedan",
  "luxury_sprinter_van",
  "executive_shuttle_van",
  "party_bus",
  "mini_coach",
  "motor_coach",
  "charter_bus",
  "limousine",
] as const;
export type BlackTieVehicleOption = (typeof BLACK_TIE_VEHICLE_OPTIONS)[number];

export const BLACK_TIE_VEHICLE_LABELS: Record<BlackTieVehicleOption, string> = {
  black_suv: "Black SUV",
  executive_sedan: "Executive Sedan",
  luxury_sprinter_van: "Luxury Sprinter Van",
  executive_shuttle_van: "Executive Shuttle Van",
  party_bus: "Party Bus",
  mini_coach: "Mini Coach",
  motor_coach: "Motor Coach",
  charter_bus: "Charter Bus",
  limousine: "Limousine",
};

export const BLACK_TIE_QUOTE_STATUSES = [
  "awaiting_quote",
  "quote_sent",
  "quote_accepted",
  "quote_declined",
] as const;
export type BlackTieQuoteStatus = (typeof BLACK_TIE_QUOTE_STATUSES)[number];

export const additionalStopSchema = z.object({
  address: z.string().trim().min(3).max(300),
  city: z.string().trim().min(1).max(100),
  pickupTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});
export type AdditionalStop = z.infer<typeof additionalStopSchema>;

export const billingContactSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(7).max(30),
});
export type BillingContact = z.infer<typeof billingContactSchema>;

/** A real calendar date (YYYY-MM-DD) from today (UTC-1 day tolerance) up to 2 years ahead. */
export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return false;
    const now = Date.now();
    return d.getTime() >= now - 2 * 86400000 && d.getTime() <= now + 730 * 86400000;
  }, "Choose a valid date.");

export const REQUEST_CATEGORIES = ["passenger_transport", "medical_delivery"] as const;

export const rideRequestSchema = z.object({
  requestCategory: z.literal("passenger_transport").optional(),
  patientFirstName: z.string().trim().min(1).max(80),
  patientLastName: z.string().trim().min(1).max(80),
  patientPhone: z.string().trim().min(7).max(30),
  patientEmail: z.string().trim().email().max(200).optional().or(z.literal("")),
  pickupAddress: z.string().trim().min(3).max(300),
  pickupAddressDetails: z.string().trim().max(200).optional().or(z.literal("")),
  pickupCity: z.string().trim().min(1).max(100),
  pickupDate: dateString,
  pickupTime: z.string().regex(/^\d{2}:\d{2}$/),
  appointmentTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  dropoffAddress: z.string().trim().min(3).max(300),
  dropoffCity: z.string().trim().min(1).max(100),
  transportType: z.enum(["ambulatory", "wheelchair", "gurney"]),
  tripType: z.enum(TRIP_TYPE_OPTIONS).default("one_way"),
  roundTrip: z.boolean().default(false),
  returnPickupTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  returnDropoffTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  returnPickupBuilding: z.string().trim().max(120).optional().or(z.literal("")),
  returnPickupDoctor: z.string().trim().max(120).optional().or(z.literal("")),
  returnPickupSuite: z.string().trim().max(60).optional().or(z.literal("")),
  additionalStops: z.array(additionalStopSchema).max(10).default([]),
  mobilityNotes: z.string().trim().max(1000).optional().or(z.literal("")),
  specialInstructions: z.string().trim().max(1000).optional().or(z.literal("")),
  recurrence: z.enum(RECURRENCE_OPTIONS).default("none"),
  recurrenceEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  embedToken: z.string().trim().min(6).max(64).optional().or(z.literal("")),
  billingSource: z.enum(["account", "saved", "custom"]).default("account"),
  billingContact: billingContactSchema.optional(),
  createAccount: z.boolean().optional().default(false),
  // Black Tie was retired; accepted only as false for backwards compatibility.
  blackTie: z.literal(false).default(false),
}).strict().superRefine((data, ctx) => {
  if ((data.billingSource === "custom" || data.billingSource === "saved") && !data.billingContact) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["billingContact"],
      message: "Billing contact is required.",
    });
  }

  if (data.tripType === "round_trip" && !data.returnPickupTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["returnPickupTime"],
      message: "Return pickup time is required for round trips.",
    });
  }
  if (data.tripType === "multi_trip") {
    if (!data.additionalStops || data.additionalStops.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["additionalStops"],
        message: "Add at least one stop for a multi-stop trip.",
      });
    }
    data.additionalStops?.forEach((stop, i) => {
      if (!stop.pickupTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["additionalStops", i, "pickupTime"],
          message: "Pickup time is required for each stop.",
        });
      }
    });
  }
});



export type RideRequestInput = z.infer<typeof rideRequestSchema>;

const GENERIC_SUBMIT_ERROR = "We could not submit your request. Please try again or call us.";

export const submitRideRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => rideRequestSchema.parse(input))
  .handler(async ({ data }) => {
    const { resolveRequester, notifyNewRequest } = await import("@/lib/requests/request-service.server");
    const requester = await resolveRequester();

    let embedProviderId: string | null = null;
    let embedTokenStored: string | null = null;
    if (data.embedToken) {
      const { data: tok } = await supabaseAdmin
        .from("provider_embed_tokens")
        .select("provider_user_id, revoked_at")
        .eq("token", data.embedToken)
        .maybeSingle();
      if (tok && !tok.revoked_at) {
        embedProviderId = tok.provider_user_id;
        embedTokenStored = data.embedToken;
      }
    }

    const isRound = data.tripType === "round_trip" || data.roundTrip;
    const { error, data: row } = await supabaseAdmin
      .from("ride_requests")
      .insert({
        trip_kind: "passenger",
        patient_first_name: data.patientFirstName,
        patient_last_name: data.patientLastName,
        patient_phone: data.patientPhone,
        patient_email: data.patientEmail || null,
        pickup_address: data.pickupAddress,
        pickup_address_details: data.pickupAddressDetails || null,
        pickup_city: data.pickupCity,
        pickup_date: data.pickupDate,
        pickup_time: data.pickupTime,
        appointment_time: data.appointmentTime || null,
        dropoff_address: data.dropoffAddress,
        dropoff_city: data.dropoffCity,
        transport_type: data.transportType,
        trip_type: data.tripType,
        round_trip: isRound,
        return_pickup_time: data.returnPickupTime || null,
        return_dropoff_time: data.returnDropoffTime || null,
        return_pickup_building: data.returnPickupBuilding || null,
        return_pickup_doctor: data.returnPickupDoctor || null,
        return_pickup_suite: data.returnPickupSuite || null,
        return_date: isRound ? (data.returnDate || data.pickupDate) : null,
        additional_stops: data.additionalStops ?? [],
        mobility_notes: data.mobilityNotes || null,
        special_instructions: data.specialInstructions || null,
        requester_user_id: requester.userId,
        workspace_id: requester.workspaceId,
        recurrence_rule: data.recurrence && data.recurrence !== "none" ? data.recurrence : null,
        recurrence_end_date: data.recurrenceEndDate || null,
        embed_provider_id: embedProviderId,
        embed_token: embedTokenStored,
        trip_billing_source: data.billingSource,
        trip_billing_first_name: data.billingContact?.firstName ?? null,
        trip_billing_last_name: data.billingContact?.lastName ?? null,
        trip_billing_email: data.billingContact?.email ?? null,
        trip_billing_phone: data.billingContact?.phone ?? null,
      })
      .select("id")
      .single();

    if (error || !row) {
      console.error("submitRideRequest insert failed", error?.code ?? "unknown");
      return { ok: false as const, error: GENERIC_SUBMIT_ERROR };
    }

    await notifyNewRequest({
      id: row.id,
      category: "passenger_transport",
      requesterEmail: data.patientEmail || null,
      embedProviderId,
    });

    return { ok: true as const, id: row.id, enrichmentToken: signEnrichmentToken(row.id) };
  });

// ---------- Medical Delivery ----------

/** Delivery categories offered publicly. Prescription and lab-specimen
 *  categories exist in the schema but are NOT offered until approved. */
export const DELIVERY_CATEGORY_OPTIONS = ["medical_supplies", "equipment", "dme", "other"] as const;
export const DELIVERY_CATEGORY_LABELS: Record<(typeof DELIVERY_CATEGORY_OPTIONS)[number], string> = {
  medical_supplies: "Medical supplies",
  equipment: "Medical equipment",
  dme: "Durable medical equipment (DME)",
  other: "Other non-urgent medical items",
};

export const deliveryRequestSchema = z
  .object({
    requestCategory: z.literal("medical_delivery"),
    contactFirstName: z.string().trim().min(1).max(80),
    contactLastName: z.string().trim().min(1).max(80),
    contactPhone: z.string().trim().min(7).max(30),
    contactEmail: z.string().trim().email().max(200).optional().or(z.literal("")),
    pickupAddress: z.string().trim().min(3).max(300),
    pickupAddressDetails: z.string().trim().max(200).optional().or(z.literal("")),
    pickupCity: z.string().trim().min(1).max(100),
    dropoffAddress: z.string().trim().min(3).max(300),
    dropoffCity: z.string().trim().min(1).max(100),
    requestedDate: dateString,
    requestedTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    deliveryCategory: z.enum(DELIVERY_CATEGORY_OPTIONS),
    deliveryInstructions: z.string().trim().max(500).optional().or(z.literal("")),
    signatureRequired: z.boolean().default(false),
  })
  .strict();
export type DeliveryRequestInput = z.infer<typeof deliveryRequestSchema>;

export const submitDeliveryRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => deliveryRequestSchema.parse(input))
  .handler(async ({ data }) => {
    const { resolveRequester, notifyNewRequest } = await import("@/lib/requests/request-service.server");
    const requester = await resolveRequester();

    const { error, data: row } = await supabaseAdmin
      .from("ride_requests")
      .insert({
        trip_kind: "medical_delivery",
        transport_type: "delivery",
        trip_type: "one_way",
        round_trip: false,
        // Legacy column names: hold the requester CONTACT for delivery rows.
        patient_first_name: data.contactFirstName,
        patient_last_name: data.contactLastName,
        patient_phone: data.contactPhone,
        patient_email: data.contactEmail || null,
        requester_phone: data.contactPhone,
        requester_email: data.contactEmail || null,
        pickup_address: data.pickupAddress,
        pickup_address_details: data.pickupAddressDetails || null,
        pickup_city: data.pickupCity,
        pickup_date: data.requestedDate,
        pickup_time: data.requestedTime,
        dropoff_address: data.dropoffAddress,
        dropoff_city: data.dropoffCity,
        delivery_item_type: data.deliveryCategory,
        delivery_instructions: data.deliveryInstructions || null,
        delivery_signature_required: data.signatureRequired,
        requester_user_id: requester.userId,
        workspace_id: requester.workspaceId,
      })
      .select("id")
      .single();

    if (error || !row) {
      console.error("submitDeliveryRequest insert failed", error?.code ?? "unknown");
      return { ok: false as const, error: GENERIC_SUBMIT_ERROR };
    }

    await notifyNewRequest({ id: row.id, category: "medical_delivery", requesterEmail: data.contactEmail || null });
    return { ok: true as const, id: row.id };
  });

export const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  subject: z.string().trim().max(200).optional().or(z.literal("")),
  message: z.string().trim().min(5).max(2000),
});
export type ContactInput = z.infer<typeof contactSchema>;

export const submitContact = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => contactSchema.parse(input))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("contact_messages").insert({
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      subject: data.subject || null,
      message: data.message,
    });
    if (error) {
      console.error("submitContact error", error);
      return { ok: false as const, error: "Could not send your message. Please try again." };
    }
    return { ok: true as const };
  });

export const REGION_BY_CITY: Record<string, string> = {
  jacksonville: "Northeast Florida",
  orlando: "Central Florida",
  tampa: "Gulf Coast",
  miami: "South Florida",
  tallahassee: "Florida Panhandle",
  "fort-lauderdale": "Broward County",
  "fort lauderdale": "Broward County",
  gainesville: "North Central Florida",
  "daytona-beach": "Central Florida",
  "daytona beach": "Central Florida",
  daytona: "Central Florida",
  "southwest-florida": "Southwest Florida",
  "southwest florida": "Southwest Florida",
  "fort myers": "Southwest Florida",
  "fort-myers": "Southwest Florida",
  naples: "Southwest Florida",
  "cape coral": "Southwest Florida",
};

function regionFor(city: string): string {
  const k = city.trim().toLowerCase();
  return REGION_BY_CITY[k] ?? REGION_BY_CITY[k.replace(/\s/g, "-")] ?? "Statewide Florida";
}

export const PROVIDER_DOC_KINDS = [
  "drivers_license",
  "insurance",
  "w9",
  "ein_letter",
  "npi",
  "business_license",
  "vehicle_registration",
  "vehicle_vin",
  "non_compete",
  "nda",
  "hipaa",
  "driver_photo",
  "vehicle_photo_front",
  "vehicle_photo_rear",
  "vehicle_photo_left",
  "other",
] as const;

const docSchema = z.object({
  kind: z.enum(PROVIDER_DOC_KINDS),
  path: z.string().min(1).max(500),
  filename: z.string().min(1).max(255),
  size: z.number().int().min(0).max(25_000_000),
});

const zipListSchema = z
  .array(z.string().trim().regex(/^\d{5}$/, "ZIP must be 5 digits"))
  .max(40)
  .default([]);

export const providerApplicationSchema = z.object({
  // Basic info
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200),
  dispatchEmail: z.string().trim().email().max(200).optional().or(z.literal("")),
  phone: z.string().trim().min(7).max(30),
  // Company
  companyName: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(100),
  county: z.string().trim().max(100).optional().or(z.literal("")),
  zipCode: z.string().trim().regex(/^\d{5}$/, "ZIP must be 5 digits"),
  preferredZipCodes: zipListSchema,
  serviceTypes: z.array(z.enum(["ambulatory", "wheelchair", "gurney"])).min(1),
  fleetSize: z.number().int().min(0).max(10000).optional(),
  // Credentials
  ein: z.string().trim().max(20).optional().or(z.literal("")),
  npi: z.string().trim().max(20).optional().or(z.literal("")),
  driverLicenseNumber: z.string().trim().max(50).optional().or(z.literal("")),
  insuranceCarrier: z.string().trim().max(200).optional().or(z.literal("")),
  insurancePolicyNumber: z.string().trim().max(100).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  documents: z.array(docSchema).max(30).default([]),
});
export type ProviderApplicationInput = z.infer<typeof providerApplicationSchema>;
export type ProviderDoc = z.infer<typeof docSchema>;

export const submitProviderApplication = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => providerApplicationSchema.parse(input))
  .handler(async ({ data }) => {
    const contactName = `${data.firstName} ${data.lastName}`.trim();
    const row = {
      company_name: data.companyName,
      contact_name: contactName,
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      dispatch_email: data.dispatchEmail || null,
      phone: data.phone,
      city: data.city,
      county: data.county || null,
      zip_code: data.zipCode,
      preferred_zip_codes: data.preferredZipCodes,
      region: regionFor(data.city),
      service_types: data.serviceTypes,
      fleet_size: data.fleetSize ?? null,
      ein: data.ein || null,
      npi: data.npi || null,
      driver_license_number: data.driverLicenseNumber || null,
      insurance_carrier: data.insuranceCarrier || null,
      insurance_policy_number: data.insurancePolicyNumber || null,
      notes: data.notes || null,
      documents: data.documents,
    };

    // Dedupe: check for an existing application on this email so re-submits
    // don't pile up duplicate rows in provider_applications.
    const { data: existing, error: lookupErr } = await supabaseAdmin
      .from("provider_applications")
      .select("id, status")
      .eq("email", data.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupErr) {
      console.error("submitProviderApplication lookup error", lookupErr);
      return { ok: false as const, error: "Could not submit your application. Please try again." };
    }

    if (existing) {
      const status = String(existing.status ?? "pending").toLowerCase();
      if (status === "approved") {
        return {
          ok: false as const,
          error:
            "An approved provider account already exists for this email. Please sign in instead of re-submitting.",
        };
      }
      if (status === "denied") {
        return {
          ok: false as const,
          error:
            "A previous application for this email was denied. Please contact support before re-applying.",
        };
      }
      // pending / under_review → update in place instead of inserting a duplicate
      const { error: updateErr } = await supabaseAdmin
        .from("provider_applications")
        .update(row)
        .eq("id", existing.id);
      if (updateErr) {
        console.error("submitProviderApplication update error", updateErr);
        return { ok: false as const, error: "Could not update your application. Please try again." };
      }
      return { ok: true as const, updated: true as const };
    }

    const { error } = await supabaseAdmin.from("provider_applications").insert(row);
    if (error) {
      console.error("submitProviderApplication insert error", error);
      return { ok: false as const, error: "Could not submit your application. Please try again." };
    }
    return { ok: true as const };
  });
