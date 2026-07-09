import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const RECURRENCE_OPTIONS = ["none", "daily", "weekdays", "weekly", "biweekly", "monthly"] as const;
export type RecurrenceOption = (typeof RECURRENCE_OPTIONS)[number];

export const TRIP_TYPE_OPTIONS = ["one_way", "round_trip", "multi_trip"] as const;
export type TripTypeOption = (typeof TRIP_TYPE_OPTIONS)[number];

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

export const rideRequestSchema = z.object({
  patientFirstName: z.string().trim().min(1).max(80),
  patientLastName: z.string().trim().min(1).max(80),
  patientPhone: z.string().trim().min(7).max(30),
  patientEmail: z.string().trim().email().max(200).optional().or(z.literal("")),
  pickupAddress: z.string().trim().min(3).max(300),
  pickupAddressDetails: z.string().trim().max(200).optional().or(z.literal("")),
  pickupCity: z.string().trim().min(1).max(100),
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pickupTime: z.string().regex(/^\d{2}:\d{2}$/),
  appointmentTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  dropoffAddress: z.string().trim().min(3).max(300),
  dropoffCity: z.string().trim().min(1).max(100),
  transportType: z.enum(["ambulatory", "wheelchair", "gurney"]),
  tripType: z.enum(TRIP_TYPE_OPTIONS).default("one_way"),
  roundTrip: z.boolean().default(false),
  returnPickupTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  returnDropoffTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  additionalStops: z.array(additionalStopSchema).max(10).default([]),
  mobilityNotes: z.string().trim().max(1000).optional().or(z.literal("")),
  specialInstructions: z.string().trim().max(1000).optional().or(z.literal("")),
  recurrence: z.enum(RECURRENCE_OPTIONS).default("none"),
  recurrenceEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  embedToken: z.string().trim().min(6).max(64).optional().or(z.literal("")),
  billingSource: z.enum(["account", "saved", "custom"]).default("account"),
  billingContact: billingContactSchema.optional(),
}).superRefine((data, ctx) => {
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

export const submitRideRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => rideRequestSchema.parse(input))
  .handler(async ({ data }) => {
    // If the caller is signed in, tag the request with their user id so they can see it in /requests.
    let requesterUserId: string | null = null;
    try {
      const { getRequestHeader } = await import("@tanstack/react-start/server");
      const authHeader = getRequestHeader("authorization");
      const token = authHeader?.replace(/^Bearer\s+/i, "");
      if (token) {
        const { data: userData } = await supabaseAdmin.auth.getUser(token);
        requesterUserId = userData.user?.id ?? null;
      }
    } catch {
      // anonymous submission is fine
    }

    // Resolve optional embed token to attribute the request to the provider whose website hosted the form.
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

    const { error, data: row } = await supabaseAdmin
      .from("ride_requests")
      .insert({
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
        round_trip: data.tripType === "round_trip" || data.roundTrip,
        return_pickup_time: data.returnPickupTime || null,
        return_dropoff_time: data.returnDropoffTime || null,

        additional_stops: data.additionalStops ?? [],
        mobility_notes: data.mobilityNotes || null,
        special_instructions: data.specialInstructions || null,
        requester_user_id: requesterUserId,
        recurrence_rule: data.recurrence && data.recurrence !== "none" ? data.recurrence : null,
        recurrence_end_date: data.recurrenceEndDate || null,
        embed_provider_id: embedProviderId,
        embed_token: embedTokenStored,
      })
      .select("id")
      .single();


    if (error) {
      console.error("submitRideRequest error", error);
      return { ok: false as const, error: "Could not submit your request. Please call (800) 555-0199." };
    }
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
    const { error } = await supabaseAdmin.from("provider_applications").insert({
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
    });
    if (error) {
      console.error("submitProviderApplication error", error);
      return { ok: false as const, error: "Could not submit your application. Please try again." };
    }
    return { ok: true as const };
  });
