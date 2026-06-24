import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const rideRequestSchema = z.object({
  patientFirstName: z.string().trim().min(1).max(80),
  patientLastName: z.string().trim().min(1).max(80),
  patientPhone: z.string().trim().min(7).max(30),
  patientEmail: z.string().trim().email().max(200).optional().or(z.literal("")),
  pickupAddress: z.string().trim().min(3).max(300),
  pickupCity: z.string().trim().min(1).max(100),
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pickupTime: z.string().regex(/^\d{2}:\d{2}$/),
  dropoffAddress: z.string().trim().min(3).max(300),
  dropoffCity: z.string().trim().min(1).max(100),
  transportType: z.enum(["ambulatory", "wheelchair", "gurney"]),
  roundTrip: z.boolean().default(false),
  mobilityNotes: z.string().trim().max(1000).optional().or(z.literal("")),
  specialInstructions: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type RideRequestInput = z.infer<typeof rideRequestSchema>;

export const submitRideRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => rideRequestSchema.parse(input))
  .handler(async ({ data }) => {
    const { error, data: row } = await supabaseAdmin
      .from("ride_requests")
      .insert({
        patient_first_name: data.patientFirstName,
        patient_last_name: data.patientLastName,
        patient_phone: data.patientPhone,
        patient_email: data.patientEmail || null,
        pickup_address: data.pickupAddress,
        pickup_city: data.pickupCity,
        pickup_date: data.pickupDate,
        pickup_time: data.pickupTime,
        dropoff_address: data.dropoffAddress,
        dropoff_city: data.dropoffCity,
        transport_type: data.transportType,
        round_trip: data.roundTrip,
        mobility_notes: data.mobilityNotes || null,
        special_instructions: data.specialInstructions || null,
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
