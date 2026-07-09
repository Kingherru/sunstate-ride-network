import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listEmbedTokens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("provider_embed_tokens")
      .select("id, token, created_at, revoked_at")
      .eq("provider_user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

function randomToken(len = 24) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) out += chars[buf[i] % chars.length];
  return out;
}

export const createEmbedToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const token = randomToken();
    const { data, error } = await supabase
      .from("provider_embed_tokens")
      .insert({ provider_user_id: userId, token })
      .select("id, token, created_at, revoked_at")
      .single();
    if (error) throw error;
    return data;
  });

export const revokeEmbedToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("provider_embed_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("provider_user_id", userId);
    if (error) throw error;
    return { ok: true };
  });

// Anonymous lookup — used by the embed page to validate a token before rendering.
export const resolveEmbedToken = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(6).max(64) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("provider_embed_tokens")
      .select("id, provider_user_id, revoked_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!row || row.revoked_at) return { ok: false as const };
    const { data: profile } = await supabaseAdmin
      .from("member_profiles")
      .select("business_name, first_name, last_name")
      .eq("user_id", row.provider_user_id)
      .maybeSingle();
    const name =
      profile?.business_name?.trim() ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
      "your provider";
    return { ok: true as const, providerName: name };
  });
