/**
 * Pure client-side helper that decides what a provider still owes before
 * their Provider Portal fully unlocks.
 *
 * Soft-access allows: New Trip, Reservations, Schedule (plus Onboarding,
 * Messages, and Account so they can actually finish setup / sign out).
 * Everything else is locked until every step below is done.
 */

export type OnboardingStepId =
  | "company"
  | "location"
  | "service_area"
  | "vehicles"
  | "drivers"
  | "medicaid";

export type OnboardingStep = {
  id: OnboardingStepId;
  label: string;
  description: string;
  done: boolean;
  targetTab: string;
};

export type OnboardingResult = {
  steps: OnboardingStep[];
  complete: boolean;
  percent: number;
  doneCount: number;
  total: number;
  remaining: number;
};

export function computeProviderOnboarding(input: {
  profile: any | null;
  vehiclesCount: number;
  driversCount: number;
}): OnboardingResult {
  const p = input.profile ?? {};
  const zips = Array.isArray(p.preferred_zip_codes) ? p.preferred_zip_codes : [];

  const steps: OnboardingStep[] = [
    {
      id: "company",
      label: "Company name, phone & dispatch email",
      description: "Basic business identity used on trip sheets and referrals.",
      done: Boolean(
        (p.company_name ?? "").toString().trim() &&
        (p.phone ?? "").toString().trim() &&
        (p.dispatch_email ?? "").toString().trim(),
      ),
      targetTab: "account",
    },
    {
      id: "location",
      label: "Business address, city, region & ZIP",
      description: "Where your dispatch is based — used for regional matching.",
      done: Boolean(
        (p.business_address ?? "").toString().trim() &&
        (p.city ?? "").toString().trim() &&
        (p.region ?? "").toString().trim() &&
        (p.postal_code ?? "").toString().trim(),
      ),
      targetTab: "account",
    },
    {
      id: "service_area",
      label: "Service ZIP codes",
      description: "At least one ZIP so referrals can be matched to your area.",
      done: zips.length > 0,
      targetTab: "account",
    },
    {
      id: "vehicles",
      label: "Add at least one vehicle",
      description: "Insurance & registration expiry are checked on assignment.",
      done: input.vehiclesCount > 0,
      targetTab: "vehicles",
    },
    {
      id: "drivers",
      label: "Add at least one driver",
      description: "License expiry is checked on assignment.",
      done: input.driversCount > 0,
      targetTab: "vehicles",
    },
    {
      id: "medicaid",
      label: "Enter your Medicaid Provider Number",
      description: "Required to run Medicaid-funded trips. No certificate upload needed.",
      done: Boolean((p.medicaid_number ?? "").toString().trim()),
      targetTab: "medicaid",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const total = steps.length;
  return {
    steps,
    doneCount,
    total,
    remaining: total - doneCount,
    complete: doneCount === total,
    percent: Math.round((doneCount / total) * 100),
  };
}

/** Tabs a soft-access provider can open. Everything else shows a lock overlay. */
export const SOFT_ACCESS_TABS = [
  "onboarding",
  "new",
  "reservations",
  "schedule",
  "messages",
  "account",
  // Required onboarding destinations — must stay unlocked so providers can
  // actually complete the checklist (add vehicles/drivers, enter Medicaid #).
  "vehicles",
  "medicaid",
] as const;

export type SoftAccessTab = (typeof SOFT_ACCESS_TABS)[number];
