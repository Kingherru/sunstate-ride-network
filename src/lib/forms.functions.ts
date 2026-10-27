import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { signEnrichmentToken } from "@/lib/enrichment-token.server";

import {
  rideRequestSchema,
  deliveryRequestSchema,
} from "@/lib/request-schemas";
export * from "@/lib/request-schemas";


const GENERIC_SUBMIT_ERROR = "We could not submit your request. Please try again or call us.";

export const submitRideRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => rideRequestSchema.parse(input))
  .handler(async ({ data }) => {
    const svc = await import("@/lib/requests/request-service.server");
    const requester = await svc.resolveRequester();
    const r = await svc.insertPassengerRequest(data, {
      requesterUserId: requester.userId, actorUserId: requester.userId,
      workspaceId: requester.workspaceId, submittedVia: requester.isAdmin ? "portal" : requester.submittedVia,
    });
    if (!r.ok) return { ok: false as const, error: GENERIC_SUBMIT_ERROR };
    return { ok: true as const, id: r.id, mfnId: r.mfnId, enrichmentToken: signEnrichmentToken(r.id) };
  });

// ---------- Medical Delivery ----------

export const submitDeliveryRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => deliveryRequestSchema.parse(input))
  .handler(async ({ data }) => {
    const svc = await import("@/lib/requests/request-service.server");
    const requester = await svc.resolveRequester();
    const r = await svc.insertDeliveryRequest(data, {
      requesterUserId: requester.userId, actorUserId: requester.userId,
      workspaceId: requester.workspaceId, submittedVia: requester.isAdmin ? "portal" : requester.submittedVia,
    });
    if (!r.ok) return { ok: false as const, error: GENERIC_SUBMIT_ERROR };
    return { ok: true as const, id: r.id, mfnId: r.mfnId };
  });

export const CONTACT_CATEGORIES = ["business_inquiry", "website_problem", "general_question"] as const;
export const contactSchema = z.object({
  category: z.enum(CONTACT_CATEGORIES),
  name: z.string().trim().min(1).max(120),
  businessName: z.string().trim().max(160).optional().or(z.literal("")),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(30).regex(/^[0-9+().\-\s]*$/).optional().or(z.literal("")),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(5).max(2000),
  website: z.string().max(0).optional().or(z.literal("")), // honeypot: must stay empty
});
export type ContactInput = z.infer<typeof contactSchema>;
const CONTACT_GENERIC_OK = { ok: true as const };
const CONTACT_GENERIC_ERR = { ok: false as const, error: "Could not send your message. Please try again later." };

export const submitContact = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const r = contactSchema.safeParse(input);
    if (!r.success) throw new Error("Please check the form and try again.");
    return r.data;
  })
  .handler(async ({ data }) => {
    if (data.website) return CONTACT_GENERIC_OK; // bots get a silent success
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const ipRaw = getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    const digest = ipRaw ? Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ipRaw)))).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32) : null;
    const since = new Date(Date.now() - 3600_000).toISOString();
    const orFilter = digest ? `email.eq.${data.email},ip_address.eq.${digest}` : `email.eq.${data.email}`;
    const { count } = await supabaseAdmin.from("contact_messages").select("id", { count: "exact", head: true }).gte("created_at", since).or(orFilter);
    if ((count ?? 0) >= 3) return CONTACT_GENERIC_ERR;
    const { error } = await supabaseAdmin.from("contact_messages").insert({
      category: data.category, name: data.name, business_name: data.businessName || null,
      email: data.email, phone: data.phone || null, subject: data.subject, message: data.message,
      source: "public_contact_form", ip_address: digest,
    });
    if (error) { console.error("submitContact error", error.code); return CONTACT_GENERIC_ERR; }
    return CONTACT_GENERIC_OK;
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
