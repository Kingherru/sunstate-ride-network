/** Client-safe request validation shared by the public form and server functions. */
import { z } from "zod";

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
  selectedProviderWorkspaceId: z.string().uuid().optional().nullable(),
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
