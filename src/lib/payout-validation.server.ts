// Server-only payout validation window helpers.
// Completed trips are NOT immediately payable: they sit in a validation
// window so MFN can verify trip details, payment capture and documentation.

/** Standard validation period for completed trips, in days. */
export const PAYOUT_VALIDATION_DAYS = 7;
/** Medicaid trips settle on Net-15 from validation. */
export const PAYOUT_MEDICAID_NET_DAYS = 15;

function isMedicaid(t: any): boolean {
  return (
    (t.payer ?? "").toLowerCase().includes("medicaid") ||
    !!t.medicaid_number || !!t.medicaid_plan || !!t.is_medicaid_patient
  );
}

/**
 * Put a completed trip into "pending validation". Providers cannot be paid
 * until the window elapses AND payment has been captured/validated.
 * Idempotent — never shortens an existing window, never touches released payouts.
 */
export async function startPayoutValidationWindow(tripId: string): Promise<{
  ok: boolean; eligibleAt?: string; days?: number; error?: string;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: trip } = await supabaseAdmin
    .from("trips")
    .select("id, payout_status, payout_eligible_at, payer, medicaid_number, medicaid_plan, is_medicaid_patient, completed_at")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) return { ok: false, error: "Trip not found" };
  if ((trip as any).payout_status === "released") return { ok: true, error: "already_released" };

  const medicaid = isMedicaid(trip);
  const days = medicaid ? PAYOUT_MEDICAID_NET_DAYS : PAYOUT_VALIDATION_DAYS;
  const from = (trip as any).completed_at ? Date.parse((trip as any).completed_at) : Date.now();
  const base = Number.isFinite(from) ? from : Date.now();
  const candidate = new Date(base + days * 24 * 3600 * 1000).toISOString();

  const existing = (trip as any).payout_eligible_at;
  const eligibleAt = existing && Date.parse(existing) > Date.parse(candidate) ? existing : candidate;

  await supabaseAdmin
    .from("trips")
    .update({
      payout_is_medicaid: medicaid,
      payout_eligible_at: eligibleAt,
      payout_status: "pending",
    } as never)
    .eq("id", tripId);

  return { ok: true, eligibleAt, days };
}
