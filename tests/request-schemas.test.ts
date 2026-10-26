import { describe, expect, test } from "bun:test";
import { rideRequestSchema, deliveryRequestSchema } from "../src/lib/request-schemas";

const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
const ride = {
  patientFirstName: "A", patientLastName: "B", patientPhone: "5555555555",
  pickupAddress: "123 Main St", pickupCity: "Orlando", pickupDate: future, pickupTime: "09:00",
  dropoffAddress: "400 Clinic Way", dropoffCity: "Orlando", transportType: "wheelchair",
};
const delivery = {
  requestCategory: "medical_delivery", contactFirstName: "A", contactLastName: "B", contactPhone: "5555555555",
  pickupAddress: "123 Main St", pickupCity: "Orlando", dropoffAddress: "400 Clinic Way", dropoffCity: "Orlando",
  requestedDate: future, requestedTime: "10:30", deliveryCategory: "equipment",
};

describe("passenger requests", () => {
  test("valid passenger request passes", () => expect(rideRequestSchema.safeParse(ride).success).toBe(true));
  test('selected provider is a workspace UUID, not a display MFN ID', () => {
    expect(rideRequestSchema.safeParse({ ...ride, selectedProviderWorkspaceId: '11111111-1111-4111-8111-111111111111' }).success).toBe(true);
    expect(rideRequestSchema.safeParse({ ...ride, selectedProviderWorkspaceId: 'MFN-A-000001' }).success).toBe(false);
  });
  test('no selection remains valid for platform review', () => expect(rideRequestSchema.safeParse({ ...ride, selectedProviderWorkspaceId: null }).success).toBe(true));
  test("unknown service type rejected", () => expect(rideRequestSchema.safeParse({ ...ride, transportType: "helicopter" }).success).toBe(false));
  test("delivery-only field rejected on passenger", () => expect(rideRequestSchema.safeParse({ ...ride, deliveryCategory: "equipment" }).success).toBe(false));
  test("wrong category rejected", () => expect(rideRequestSchema.safeParse({ ...ride, requestCategory: "medical_delivery" }).success).toBe(false));
  test("Black Tie rejected", () => expect(rideRequestSchema.safeParse({ ...ride, blackTie: true }).success).toBe(false));
  test("impossible date rejected", () => expect(rideRequestSchema.safeParse({ ...ride, pickupDate: "2026-02-31" }).success).toBe(false));
});

describe("medical delivery requests", () => {
  test("valid delivery passes", () => expect(deliveryRequestSchema.safeParse(delivery).success).toBe(true));
  test('patient provider targeting never leaks into delivery', () => expect(deliveryRequestSchema.safeParse({ ...delivery, selectedProviderWorkspaceId: '11111111-1111-4111-8111-111111111111' }).success).toBe(false));
  test("unknown category rejected", () => expect(deliveryRequestSchema.safeParse({ ...delivery, requestCategory: "freight" }).success).toBe(false));
  test("passenger-only field rejected", () => expect(deliveryRequestSchema.safeParse({ ...delivery, mobilityNotes: "x" }).success).toBe(false));
  test("unapproved lab specimen category rejected", () => expect(deliveryRequestSchema.safeParse({ ...delivery, deliveryCategory: "lab_sample" }).success).toBe(false));
  test("missing destination rejected", () => expect(deliveryRequestSchema.safeParse({ ...delivery, dropoffAddress: "" }).success).toBe(false));
  test("oversized instructions rejected", () => expect(deliveryRequestSchema.safeParse({ ...delivery, deliveryInstructions: "x".repeat(501) }).success).toBe(false));
});
