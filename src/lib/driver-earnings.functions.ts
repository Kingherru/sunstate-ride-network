import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ------------ Types ------------ */
export type PayType = "hourly" | "daily_salary" | "per_trip" | "per_pickup_leg" | "per_mile" | "hybrid";

export interface EarningsInputRates {
  hourly_rate_cents?: number | null;
  daily_rate_cents?: number | null;
  per_trip_cents?: number | null;
  per_pickup_leg_cents?: number | null;
  per_mile_cents?: number | null;
  wait_time_per_hour_cents?: number | null;
  cancellation_fee_cents?: number | null;
}

export interface EarningsReport {
  driver: any;
  pay_type: PayType | null;
  rates: EarningsInputRates;
  range: { start: string; end: string };
  trips: {
    completed_count: number;
    canceled_count: number;
    total_miles: number;
    pickup_legs: number;
    wait_minutes: number;
    worked_hours: number;
    worked_days: number;
  };
  lines: Array<{ label: string; amount_cents: number }>;
  gross_cents: number;
  adjustments_cents: number;
  adjustments: any[];
  payments: any[];
  amount_paid_cents: number;
  outstanding_cents: number;
}

/* ------------ Compute helpers ------------ */

function hoursBetween(a?: string | null, b?: string | null): number {
  if (!a || !b) return 0;
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (!Number.isFinite(ta) || !Number.isFinite(tb) || tb <= ta) return 0;
  return (tb - ta) / 3_600_000;
}

/* ------------ Get driver earnings ------------ */

export const getDriverEarnings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { driver_id: string; start: string; end: string }) => input)
  .handler(async ({ data, context }): Promise<EarningsReport> => {
    const { supabase, userId } = context;

    const { data: driver, error: dErr } = await supabase
      .from("drivers").select("*")
      .eq("id", data.driver_id)
      .maybeSingle();
    if (dErr) throw dErr;
    if (!driver) throw new Error("Driver not found");
    // Providers see own drivers; drivers linked to a user_id see own record
    const ownerOk = (driver as any).owner_id === userId;
    const selfOk = (driver as any).user_id && (driver as any).user_id === userId;
    if (!ownerOk && !selfOk) throw new Error("Forbidden");

    const pricing = (driver as any).contractor_pricing ?? {};
    const rates: EarningsInputRates = {
      hourly_rate_cents: pricing.hourly_rate_cents ?? null,
      daily_rate_cents: pricing.daily_rate_cents ?? null,
      per_trip_cents: pricing.per_trip_cents ?? null,
      per_pickup_leg_cents: pricing.per_pickup_leg_cents ?? null,
      per_mile_cents: pricing.per_mile_cents ?? null,
      wait_time_per_hour_cents: pricing.wait_time_per_hour_cents ?? null,
      cancellation_fee_cents: pricing.cancellation_fee_cents ?? null,
    };
    const payType: PayType | null = (driver as any).pay_type ?? null;

    // Fetch trips in date range for this driver
    const { data: trips, error: tErr } = await supabase
      .from("trips")
      .select("id,status,pickup_date,round_trip,actual_miles,estimated_miles,wait_minutes,actual_pickup_at,actual_dropoff_at,scheduled_start_time,scheduled_end_time")
      .eq("driver_id", data.driver_id)
      .gte("pickup_date", data.start)
      .lte("pickup_date", data.end);
    if (tErr) throw tErr;

    let completed = 0;
    let canceled = 0;
    let totalMiles = 0;
    let pickupLegs = 0;
    let waitMinutes = 0;
    let workedHours = 0;
    const dayset = new Set<string>();

    for (const t of (trips ?? []) as any[]) {
      const status = String(t.status ?? "").toLowerCase();
      if (status === "canceled" || status === "cancelled" || status === "no_show") {
        canceled += 1;
        continue;
      }
      if (status !== "completed") continue;
      completed += 1;
      dayset.add(String(t.pickup_date));
      totalMiles += Number(t.actual_miles ?? t.estimated_miles ?? 0) || 0;
      pickupLegs += t.round_trip ? 2 : 1;
      waitMinutes += Number(t.wait_minutes ?? 0) || 0;
      const dur = hoursBetween(t.actual_pickup_at, t.actual_dropoff_at)
        || hoursBetween(t.scheduled_start_time, t.scheduled_end_time);
      workedHours += dur;
    }

    // Compute earnings lines
    const lines: Array<{ label: string; amount_cents: number }> = [];
    const cents = (n: number) => Math.round(n);
    const rate = (v: number | null | undefined) => Number(v ?? 0) || 0;

    const addLine = (label: string, amount: number) => {
      if (amount > 0) lines.push({ label, amount_cents: cents(amount) });
    };

    if (payType === "hourly" || payType === "hybrid") {
      addLine(`Hourly (${workedHours.toFixed(2)} hr × $${(rate(rates.hourly_rate_cents) / 100).toFixed(2)})`,
        workedHours * rate(rates.hourly_rate_cents));
    }
    if (payType === "daily_salary" || payType === "hybrid") {
      addLine(`Daily (${dayset.size} day${dayset.size === 1 ? "" : "s"} × $${(rate(rates.daily_rate_cents) / 100).toFixed(2)})`,
        dayset.size * rate(rates.daily_rate_cents));
    }
    if (payType === "per_trip" || payType === "hybrid") {
      addLine(`Per trip (${completed} × $${(rate(rates.per_trip_cents) / 100).toFixed(2)})`,
        completed * rate(rates.per_trip_cents));
    }
    if (payType === "per_pickup_leg" || payType === "hybrid") {
      addLine(`Per pickup leg (${pickupLegs} × $${(rate(rates.per_pickup_leg_cents) / 100).toFixed(2)})`,
        pickupLegs * rate(rates.per_pickup_leg_cents));
    }
    if (payType === "per_mile" || payType === "hybrid") {
      addLine(`Per mile (${totalMiles.toFixed(1)} mi × $${(rate(rates.per_mile_cents) / 100).toFixed(2)})`,
        totalMiles * rate(rates.per_mile_cents));
    }
    // Wait time & cancellation fees always add if a rate is set
    if (rate(rates.wait_time_per_hour_cents) > 0 && waitMinutes > 0) {
      const hrs = waitMinutes / 60;
      addLine(`Wait time (${hrs.toFixed(2)} hr × $${(rate(rates.wait_time_per_hour_cents) / 100).toFixed(2)})`,
        hrs * rate(rates.wait_time_per_hour_cents));
    }
    if (rate(rates.cancellation_fee_cents) > 0 && canceled > 0) {
      addLine(`Cancellation fees (${canceled} × $${(rate(rates.cancellation_fee_cents) / 100).toFixed(2)})`,
        canceled * rate(rates.cancellation_fee_cents));
    }

    const grossCents = lines.reduce((a, l) => a + l.amount_cents, 0);

    // Adjustments in range
    const { data: adjustments } = await (supabase as any)
      .from("driver_earning_adjustments")
      .select("*")
      .eq("driver_id", data.driver_id)
      .gte("applied_on", data.start).lte("applied_on", data.end)
      .order("applied_on", { ascending: false });
    const adjustmentsCents = ((adjustments ?? []) as any[]).reduce((a, r) => a + Number(r.amount_cents || 0), 0);

    // Payments overlapping range
    const { data: payments } = await (supabase as any)
      .from("driver_payments")
      .select("*")
      .eq("driver_id", data.driver_id)
      .or(`and(period_start.lte.${data.end},period_end.gte.${data.start}),and(period_start.is.null,period_end.is.null)`)
      .order("created_at", { ascending: false });
    const amountPaidCents = ((payments ?? []) as any[]).reduce((a, r) => a + Number(r.amount_paid_cents || 0), 0);

    const outstandingCents = grossCents + adjustmentsCents - amountPaidCents;

    return {
      driver,
      pay_type: payType,
      rates,
      range: { start: data.start, end: data.end },
      trips: {
        completed_count: completed,
        canceled_count: canceled,
        total_miles: +totalMiles.toFixed(2),
        pickup_legs: pickupLegs,
        wait_minutes: waitMinutes,
        worked_hours: +workedHours.toFixed(2),
        worked_days: dayset.size,
      },
      lines,
      gross_cents: grossCents,
      adjustments_cents: adjustmentsCents,
      adjustments: adjustments ?? [],
      payments: payments ?? [],
      amount_paid_cents: amountPaidCents,
      outstanding_cents: outstandingCents,
    };
  });

/* ------------ Adjustments CRUD ------------ */

export const upsertDriverAdjustment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string;
    driver_id: string;
    applied_on: string;
    amount_cents: number;
    reason?: string | null;
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row: any = { ...data, owner_id: userId, created_by: userId };
    const q = data.id
      ? (supabase as any).from("driver_earning_adjustments").update(row).eq("id", data.id).eq("owner_id", userId).select().single()
      : (supabase as any).from("driver_earning_adjustments").insert(row).select().single();
    const { data: out, error } = await q;
    if (error) throw error;
    return out;
  });

export const deleteDriverAdjustment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("driver_earning_adjustments").delete().eq("id", data.id).eq("owner_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

/* ------------ Payments CRUD ------------ */

export const upsertDriverPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string;
    driver_id: string;
    period_start?: string | null;
    period_end?: string | null;
    gross_cents?: number;
    amount_paid_cents?: number;
    status?: "paid" | "partial" | "unpaid";
    paid_at?: string | null;
    method?: string | null;
    reference?: string | null;
    notes?: string | null;
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row: any = { ...data, owner_id: userId, created_by: userId };
    // Auto-derive status if not provided
    if (!row.status) {
      const paid = Number(row.amount_paid_cents || 0);
      const gross = Number(row.gross_cents || 0);
      row.status = paid <= 0 ? "unpaid" : (gross > 0 && paid >= gross ? "paid" : "partial");
    }
    if (row.status === "paid" && !row.paid_at) row.paid_at = new Date().toISOString();
    const q = data.id
      ? (supabase as any).from("driver_payments").update(row).eq("id", data.id).eq("owner_id", userId).select().single()
      : (supabase as any).from("driver_payments").insert(row).select().single();
    const { data: out, error } = await q;
    if (error) throw error;
    return out;
  });

export const deleteDriverPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("driver_payments").delete().eq("id", data.id).eq("owner_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

/* ------------ Payment history for one driver ------------ */

export const listDriverPaymentHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { driver_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any)
      .from("driver_payments")
      .select("*")
      .eq("driver_id", data.driver_id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

/* ------------ Emailed earnings reports ------------ */

function usdStr(cents: number | null | undefined): string {
  return (Number(cents ?? 0) / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export const sendDriverEarningsReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    driver_id: string;
    period_start: string;
    period_end: string;
    period_label: string;
    recipient_email: string;
    sender_name?: string | null;
    sender_note?: string | null;
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify caller owns this driver
    const { data: driver, error: dErr } = await supabase
      .from("drivers").select("*").eq("id", data.driver_id).maybeSingle();
    if (dErr) throw dErr;
    if (!driver || (driver as any).owner_id !== userId) throw new Error("Forbidden");

    // Recompute the report server-side so the emailed numbers are trustworthy
    const report = await (getDriverEarnings as any)({
      data: {
        driver_id: data.driver_id,
        start: data.period_start,
        end: data.period_end,
      },
    });

    const driverName = `${(driver as any).first_name ?? ""} ${(driver as any).last_name ?? ""}`.trim() || "Driver";

    // Fire the transactional email via the internal send route.
    const authHeader = getRequestHeader("authorization") || getRequestHeader("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const req = (context as any).request as Request | undefined;
    const origin = req ? new URL(req.url).origin : (process.env.APP_ORIGIN || "");
    if (!origin) throw new Error("Could not resolve app origin");

    const sendRes = await fetch(`${origin}/lovable/email/transactional/send`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: authHeader,
      },
      body: JSON.stringify({
        templateName: "driver-earnings-report",
        recipientEmail: data.recipient_email,
        idempotencyKey: `driver-earnings-${data.driver_id}-${data.period_start}-${data.period_end}-${Date.now()}`,
        templateData: {
          driverName,
          periodLabel: data.period_label,
          senderName: data.sender_name ?? null,
          senderNote: data.sender_note ?? null,
          completedTrips: report.trips.completed_count,
          pickupLegs: report.trips.pickup_legs,
          totalMiles: report.trips.total_miles,
          waitMinutes: report.trips.wait_minutes,
          cancellations: report.trips.canceled_count,
          workedHours: report.trips.worked_hours,
          workedDays: report.trips.worked_days,
          grossUsd: usdStr(report.gross_cents),
          adjustmentsUsd: usdStr(report.adjustments_cents),
          amountPaidUsd: usdStr(report.amount_paid_cents),
          outstandingUsd: usdStr(report.outstanding_cents),
        },
      }),
    });

    const sendJson = await sendRes.json().catch(() => ({}));
    if (!sendRes.ok || sendJson?.success === false) {
      throw new Error(sendJson?.error || sendJson?.reason || `Email failed (${sendRes.status})`);
    }

    // Log to history
    const { data: row, error: insErr } = await (supabase as any)
      .from("driver_earnings_reports")
      .insert({
        owner_id: userId,
        driver_id: data.driver_id,
        period_start: data.period_start,
        period_end: data.period_end,
        recipient_email: data.recipient_email,
        sent_by: userId,
        status: "sent",
        notes: data.sender_note || null,
        snapshot: {
          period_label: data.period_label,
          trips: report.trips,
          lines: report.lines,
          gross_cents: report.gross_cents,
          adjustments_cents: report.adjustments_cents,
          amount_paid_cents: report.amount_paid_cents,
          outstanding_cents: report.outstanding_cents,
          pay_type: report.pay_type,
        },
      })
      .select()
      .single();
    if (insErr) throw insErr;
    return row;
  });

export const listDriverEarningsReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { driver_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any)
      .from("driver_earnings_reports")
      .select("*")
      .eq("driver_id", data.driver_id)
      .order("sent_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });
