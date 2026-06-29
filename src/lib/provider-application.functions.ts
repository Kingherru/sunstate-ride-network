import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyProviderApplication = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Most recent application belonging to this account (matched by user_id or email)
    const email = context.user?.email ?? null;
    let query = context.supabase
      .from("provider_applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);

    // Some schemas use user_id, others key off email. Try user_id first.
    const { data: byUser } = await query.eq("user_id", context.userId).maybeSingle();
    if (byUser) return byUser;

    if (email) {
      const { data: byEmail } = await context.supabase
        .from("provider_applications")
        .select("*")
        .eq("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (byEmail) return byEmail;
    }
    return null;
  });
