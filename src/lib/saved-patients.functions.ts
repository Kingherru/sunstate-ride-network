import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const patientSchema = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal("")),
  phone: z.string().trim().max(40).optional().nullable().or(z.literal("")),
  email: z.string().trim().max(255).email().optional().nullable().or(z.literal("")),
  medicaid_id: z.string().trim().max(60).optional().nullable().or(z.literal("")),
  mobility: z.string().trim().max(60).optional().nullable().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().nullable().or(z.literal("")),
  default_pickup_address: z.string().trim().max(255).optional().nullable().or(z.literal("")),
  default_pickup_city: z.string().trim().max(120).optional().nullable().or(z.literal("")),
  default_dropoff_address: z.string().trim().max(255).optional().nullable().or(z.literal("")),
  default_dropoff_city: z.string().trim().max(120).optional().nullable().or(z.literal("")),
});

function clean(input: z.infer<typeof patientSchema>) {
  const out: Record<string, unknown> = { ...input };
  for (const k of Object.keys(out)) if (out[k] === "") out[k] = null;
  return out;
}

export const listSavedPatients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("saved_patients")
      .select("*")
      .eq("owner_id", context.userId)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createSavedPatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => patientSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: out, error } = await context.supabase
      .from("saved_patients")
      .insert({ ...(clean(data) as any), owner_id: context.userId })
      .select().single();

    if (error) throw new Error(error.message);
    return out;
  });

export const updateSavedPatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).and(patientSchema).parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { data: out, error } = await context.supabase
      .from("saved_patients")
      .update(clean(rest))
      .eq("id", id).eq("owner_id", context.userId)
      .select().single();
    if (error) throw new Error(error.message);
    return out;
  });

export const deleteSavedPatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("saved_patients")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
