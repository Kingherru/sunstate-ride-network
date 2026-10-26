import { describe, expect, test } from "bun:test";
import { parseNoteShortcodes, normalizeDate, normalizeTime, splitAddress } from "../src/lib/note-shortcodes";
import { rideRequestSchema } from "../src/lib/request-schemas";


/** The example the owner supplied, typed the way they wrote it. */
const EXAMPLE = [
  "RT",
  "DATE: 11/05/2026",
  "RIDER: Sample Rider",
  "WC",
  "PU: 123 Sample Street, Jacksonville, FL",
  "PUT: 10:30 AM",
  "DO: 456 Medical Center Drive, Jacksonville, FL",
  "APT: 12:00 PM",
  "RET: 2:00 PM",
  "ESCORT: One family member",
  "NOTES: Call the contact upon arrival",
].join("\n");

describe("smart note shortcodes", () => {
  test("maps the supplied example onto real trip-form fields", () => {
    const { payload } = parseNoteShortcodes(EXAMPLE);
    expect(payload.tripType).toBe("round_trip");
    expect(payload.roundTrip).toBe(true);
    expect(payload.pickupDate).toBe("2026-11-05");
    expect(payload.patientFirstName).toBe("Sample");
    expect(payload.patientLastName).toBe("Rider");
    expect(payload.transportType).toBe("wheelchair");
    expect(payload.pickupAddress).toBe("123 Sample Street");
    expect(payload.pickupCity).toBe("Jacksonville");
    expect(payload.pickupTime).toBe("10:30");
    expect(payload.dropoffAddress).toBe("456 Medical Center Drive");
    expect(payload.dropoffCity).toBe("Jacksonville");
    expect(payload.appointmentTime).toBe("12:00");
    expect(payload.returnPickupTime).toBe("14:00");
    const special = String(payload.specialInstructions);
    expect(special).toContain("Escort or attendant: One family member");
    expect(special).toContain("Additional instructions: Call the contact upon arrival");
  });

  test("is case-insensitive and accepts a space instead of a colon", () => {
    const { payload } = parseNoteShortcodes("rt\nDATE 2026-11-05\nPU 12 Main St, Ocala, FL\nput 8:15 pm\nwc");
    expect(payload.tripType).toBe("round_trip");
    expect(payload.pickupDate).toBe("2026-11-05");
    expect(payload.pickupAddress).toBe("12 Main St");
    expect(payload.pickupCity).toBe("Ocala");
    expect(payload.pickupTime).toBe("20:15");
    expect(payload.transportType).toBe("wheelchair");
  });

  test("keeps a US state suffix in the address instead of reading it as a code", () => {
    const { payload, held } = parseNoteShortcodes("PU: 123 Main St, Annapolis, MD");
    expect(payload.pickupAddress).toBe("123 Main St");
    expect(payload.pickupCity).toBe("Annapolis");
    // ", MD" is Maryland here — it must not flip the note into a medical delivery.
    expect(held.join(" ")).not.toContain("Medical delivery");
    expect(String(payload.specialInstructions ?? "")).not.toContain("Medical delivery");
  });


  test("does not read an ordinary sentence as a drop-off address", () => {
    const { payload, held } = parseNoteShortcodes("do not call before arrival");
    expect(payload.dropoffAddress).toBeUndefined();
    expect(held.join(" ")).toContain("do not call before arrival");
  });

  test("never guesses: an unparseable value is reported, not invented", () => {
    const { payload, unreadable } = parseNoteShortcodes("DATE: someday\nPUT: whenever\nPHONE: call me");
    expect(payload.pickupDate).toBeUndefined();
    expect(payload.pickupTime).toBeUndefined();
    expect(payload.patientPhone).toBeUndefined();
    expect(unreadable).toEqual(["DATE: someday", "PUT: whenever", "PHONE: call me"]);
  });

  test("keeps plain notes as additional information without filling fields", () => {
    const { payload } = parseNoteShortcodes("Remember to confirm the lift");
    expect(payload.pickupDate).toBeUndefined();
    expect(payload.pickupAddress).toBeUndefined();
    expect(payload.specialInstructions).toBe("Remember to confirm the lift");
  });

  test("collects stops in order and never assigns a driver or vehicle", () => {
    const { payload } = parseNoteShortcodes(
      "MS\nSTOP: 5 Elm St, Tampa, FL\nSTOP2: 9 Oak Ave, Tampa, FL\nDRIVER: Maria\nVEH: Van 4",
    );
    const stops = payload.additionalStops as { address: string }[];
    expect(stops.map((s) => s.address)).toEqual(["5 Elm St", "9 Oak Ave"]);
    expect(payload.tripType).toBe("multi_trip");
    const special = String(payload.specialInstructions);
    expect(special).toContain("Preferred driver: Maria");
    expect(special).toContain("Preferred vehicle: Van 4");
    expect(JSON.stringify(payload)).not.toContain("driverId");
  });

  test("recurrence needs a real frequency before it is placed", () => {
    expect(parseNoteShortcodes("REC\nFREQ: weekly").payload.recurrence).toBe("weekly");
    const noFreq = parseNoteShortcodes("REC");
    expect(noFreq.payload.recurrence).toBeUndefined();
    expect(noFreq.unreadable.join(" ")).toContain("needs a frequency");
  });

  test("normalizes dates, times and addresses", () => {
    expect(normalizeDate("11/5/26")).toBe("2026-11-05");
    expect(normalizeDate("2026-11-05")).toBe("2026-11-05");
    expect(normalizeDate("13/45/2026")).toBeNull();
    expect(normalizeTime("9.05 AM")).toBe("09:05");
    expect(normalizeTime("2:00 pm")).toBe("14:00");
    expect(normalizeTime("25:00")).toBeNull();
    expect(splitAddress("123 Main St, Jacksonville, FL")).toEqual({ address: "123 Main St", city: "Jacksonville" });
    expect(splitAddress("123 Main St")).toEqual({ address: "123 Main St", city: "" });
  });

  test("only ever writes fields the New Trip form actually restores", () => {

    const formFields = new Set(Object.keys(rideRequestSchema.shape));
    const { payload } = parseNoteShortcodes(
      [EXAMPLE, "REC", "FREQ: weekly", "END: 12/31/2026", "PUZIP: 32201", "STOP: 5 Elm St, Tampa, FL"].join("\n"),
    );
    const written = Object.keys(payload);
    expect(written.length).toBeGreaterThan(10);
    for (const key of written) expect(formFields.has(key)).toBe(true);
  });
});

