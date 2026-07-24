import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FL_ZIP = /^3[2-4]\d{3}$/;

function parseZips(raw: string): string[] {
  const out = new Set<string>();
  for (const tok of raw.split(/[\s,;]+/)) {
    const z = tok.trim().padStart(5, "0").slice(0, 5);
    if (FL_ZIP.test(z)) out.add(z);
  }
  return Array.from(out).sort();
}

export const previewImportZips = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { raw: string }) => d)
  .handler(async ({ data, context }) => {
    const parsed = parseZips(data.raw);
    if (!parsed.length) return { parsed: [], existing: [], newZips: [], conflicts: [] };
    const { data: existing } = await context.supabase
      .from("dispatch_zone_zips")
      .select("zip, dispatch_zones!dispatch_zone_zips_zone_id_fkey(code,name)")
      .in("zip", parsed);
    const taken = new Set((existing ?? []).map((r) => r.zip));
    return {
      parsed,
      newZips: parsed.filter((z) => !taken.has(z)),
      conflicts: (existing ?? []).map((r) => ({
        zip: r.zip,
        zoneName: (r.dispatch_zones as { name: string }).name,
      })),
    };

  });

export const importZipsToZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { zoneId?: string; newZone?: { code: string; name: string }; raw: string; overrideConflicts?: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    const { data: isMgr } = await supabase.rpc("has_role", { _user_id: userId, _role: "app_manager" });
    if (!isAdmin && !isMgr) throw new Error("Forbidden");

    const zips = parseZips(data.raw);
    if (!zips.length) throw new Error("No valid Florida ZIPs found (expect 32000–34999).");

    let zoneId = data.zoneId;
    if (!zoneId && data.newZone) {
      const { data: z, error } = await supabase
        .from("dispatch_zones")
        .insert({ code: data.newZone.code, name: data.newZone.name })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      zoneId = z.id;
    }
    if (!zoneId) throw new Error("Pick a zone or create a new one.");

    let insertZips = zips;
    if (data.overrideConflicts) {
      await supabase.from("dispatch_zone_zips").delete().in("zip", zips);
    } else {
      const { data: existing } = await supabase.from("dispatch_zone_zips").select("zip").in("zip", zips);
      const taken = new Set((existing ?? []).map((r) => r.zip));
      insertZips = zips.filter((z) => !taken.has(z));
    }

    if (insertZips.length) {
      const { error } = await supabase
        .from("dispatch_zone_zips")
        .insert(insertZips.map((zip) => ({ zip, zone_id: zoneId! })));
      if (error) throw new Error(error.message);
    }
    return { inserted: insertZips.length, skipped: zips.length - insertZips.length, zoneId };
  });
