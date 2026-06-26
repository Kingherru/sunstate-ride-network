import type { Database } from "@/integrations/supabase/types";
import type { PortalKind } from "@/routes/_authenticated/dashboard";

type Profile = Database["public"]["Tables"]["member_profiles"]["Row"];
type Trip = Database["public"]["Tables"]["trips"]["Row"];

const today = () => new Date();
const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
const dayOffset = (n: number) => {
  const d = today();
  d.setDate(d.getDate() + n);
  return fmtDate(d);
};

/** Synthetic profile so the admin sees the real portal UI without going through onboarding. */
export function demoProfile(portal: PortalKind, userId: string, email: string): Profile {
  const base: Partial<Profile> = {
    user_id: userId,
    dispatch_email: email,
    phone: "(904) 555-0142",
    city: "Jacksonville",
    region: "Northeast Florida",
    preferred_zip_codes: ["32202", "32204", "32207", "32216"],
    membership_status: portal === "provider" ? "active" : "active",
    membership_tier: portal === "provider" ? "paid" : "free",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (portal === "patient") {
    return {
      ...base,
      first_name: "Maria",
      last_name: "Alvarez (DEMO)",
      company_name: "Maria Alvarez",
      date_of_birth: "1962-04-18",
      medicaid_number: "DEMO-MD-00001",
      medicaid_plan: "Sunshine Health",
      emergency_contact_name: "Luis Alvarez",
      emergency_contact_phone: "(904) 555-0177",
      npi: null,
    } as Profile;
  }
  if (portal === "facility") {
    return {
      ...base,
      first_name: "Renee",
      last_name: "Booker",
      company_name: "Baptist Outpatient Center (DEMO)",
      npi: "1234567890",
    } as Profile;
  }
  // provider
  return {
    ...base,
    first_name: "Marcus",
    last_name: "Heideleberg",
    company_name: "Sunshine NEMT (DEMO)",
    npi: "9876543210",
  } as Profile;
}

const PATIENTS = [
  ["Maria", "Alvarez"],
  ["Jerome", "Washington"],
  ["Linda", "Nguyen"],
  ["Carl", "Patel"],
  ["Doris", "Whitfield"],
];

function demoTrip(
  i: number,
  overrides: Partial<Trip>,
  userId: string,
): Trip {
  const [pf, pl] = PATIENTS[i % PATIENTS.length];
  return {
    id: `demo-${i}-${overrides.status ?? "open"}`,
    created_by: userId,
    assigned_to: null,
    pickup_date: overrides.pickup_date ?? dayOffset(i - 1),
    pickup_time: ["08:30", "10:15", "13:00", "15:45"][i % 4],
    patient_first_name: pf,
    patient_last_name: `${pl} (DEMO)`,
    patient_phone: "(904) 555-0100",
    pickup_address: "1234 Riverside Ave",
    pickup_city: "Jacksonville",
    pickup_zip: "32204",
    dropoff_address: "800 Prudential Dr",
    dropoff_city: "Jacksonville",
    dropoff_zip: "32207",
    transport_type: i % 3 === 0 ? "wheelchair" : "ambulatory",
    service_level: "door_to_door",
    round_trip: i % 2 === 0,
    status: "open",
    payer: "Medicaid - Sunshine Health",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as unknown as Trip;
}

/** Demo trips visible to the admin in either Received or Sent. */
export function demoTrips(portal: PortalKind, userId: string): { sent: Trip[]; received: Trip[] } {
  if (portal === "patient") {
    return {
      sent: [
        demoTrip(0, { status: "assigned", pickup_date: dayOffset(1) }, userId),
        demoTrip(1, { status: "completed", pickup_date: dayOffset(-3) }, userId),
        demoTrip(2, { status: "open", pickup_date: dayOffset(4) }, userId),
      ],
      received: [],
    };
  }
  if (portal === "facility") {
    return {
      sent: [
        demoTrip(0, { status: "open", pickup_date: dayOffset(1) }, userId),
        demoTrip(1, { status: "assigned", pickup_date: dayOffset(2) }, userId),
        demoTrip(2, { status: "completed", pickup_date: dayOffset(-1) }, userId),
        demoTrip(3, { status: "completed", pickup_date: dayOffset(-5) }, userId),
      ],
      received: [],
    };
  }
  // provider
  return {
    sent: [
      demoTrip(4, { status: "open", pickup_date: dayOffset(2) }, userId),
      demoTrip(0, { status: "completed", pickup_date: dayOffset(-7) }, userId),
    ],
    received: [
      demoTrip(1, { status: "assigned", pickup_date: dayOffset(1), assigned_to: userId, created_by: "other" }, userId),
      demoTrip(2, { status: "assigned", pickup_date: dayOffset(0), assigned_to: userId, created_by: "other" }, userId),
      demoTrip(3, { status: "completed", pickup_date: dayOffset(-4), assigned_to: userId, created_by: "other" }, userId),
    ],
  };
}
