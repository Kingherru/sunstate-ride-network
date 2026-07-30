import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Saved trip drafts.
 *
 * A draft is an unsubmitted New Trip form. Providers get one autosaved as soon
 * as they start typing; patients and facilities can save one explicitly from
 * the "Save trip" button. Drafts are NOT trips — nothing is dispatched, quoted,
 * or billed until the draft is submitted through `createTrip`.
 */

type DraftPayload = Record<string, any>;

const draftPayload = z.record(z.string(), z.any());

function summarize(p: DraftPayload): string {
  const name = [p.patient_first_name, p.patient_last_name].filter(Boolean).join(" ").trim();
  const route = [p.pickup_city, p.dropoff_city].filter(Boolean).join(" → ");
  const when = [p.pickup_date, p.pickup_time].filter(Boolean).join(" ");
  return [name || "Unnamed passenger", route, when].filter(Boolean).join(" · ").slice(0, 240);
}

export const listTripDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("trip_drafts")
      .select("id, payload, summary, autosaved, created_at, updated_at")
      .eq("user_id", userId)
      .is("submitted_trip_id", null)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data ?? []) as Array<{
      id: string;
      payload: DraftPayload;
      summary: string | null;
      autosaved: boolean;
      created_at: string;
      updated_at: string;
    }>;
  });

export const saveTripDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        draft_id: z.string().uuid().nullable().optional(),
        payload: draftPayload,
        autosaved: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const summary = summarize(data.payload);

    if (data.draft_id) {
      const { data: row, error } = await supabase
        .from("trip_drafts")
        .update({ payload: data.payload as never, summary, autosaved: data.autosaved ?? true })
        .eq("id", data.draft_id)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (row) return { id: row.id as string };
      // Draft was deleted elsewhere — fall through and create a fresh one.
    }

    const { data: created, error: insErr } = await supabase
      .from("trip_drafts")
      .insert({ user_id: userId, payload: data.payload as never, summary, autosaved: data.autosaved ?? true })
      .select("id")
      .single();
    if (insErr) throw insErr;
    return { id: created.id as string };
  });

export const deleteTripDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ draft_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("trip_drafts")
      .delete()
      .eq("id", data.draft_id)
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });

/** Marks a draft as submitted once its trip has been created. */
export const markTripDraftSubmitted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ draft_id: z.string().uuid(), trip_id: z.string().uuid().nullable().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("trip_drafts")
      .update({ submitted_trip_id: data.trip_id ?? null })
      .eq("id", data.draft_id)
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });
