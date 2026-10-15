import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCapabilities } from "@/lib/permissions";

const inputCls = "w-full border border-border rounded-sm px-3 py-2 text-sm bg-background";
const labelCls = "text-xs font-bold uppercase tracking-wide text-muted-foreground block mb-1";

export function useDispatcherProfile(userId: string | null) {
  return useQuery({
    queryKey: ["dispatcher-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_profiles")
        .select("user_id, first_name, last_name, phone, dispatch_email, company_name")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });
}

export function DispatcherAccountPanel() {
  const caps = useCapabilities();
  const qc = useQueryClient();
  const profileQ = useDispatcherProfile(caps.userId ?? null);
  const p: any = profileQ.data ?? {};

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    dispatch_email: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profileQ.isSuccess) return;
    setForm({
      first_name: p.first_name ?? "",
      last_name: p.last_name ?? "",
      phone: p.phone ?? "",
      dispatch_email: p.dispatch_email ?? caps.email ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileQ.isSuccess, profileQ.dataUpdatedAt]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!caps.userId) return;
    if (!form.first_name.trim() || !form.last_name.trim()) return toast.error("First and last name are required");
    if (!form.dispatch_email.trim()) return toast.error("Notification email is required");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.dispatch_email.trim())) return toast.error("Enter a valid email address");
    setBusy(true);
    try {
      const patch = {
        user_id: caps.userId,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim() || null,
        dispatch_email: form.dispatch_email.trim(),
      };
      const { error } = await supabase
        .from("member_profiles")
        .upsert(patch as any, { onConflict: "user_id" });
      if (error) throw error;
      toast.success("Account information saved");
      qc.invalidateQueries({ queryKey: ["dispatcher-profile"] });
      qc.invalidateQueries({ queryKey: ["member-profile"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save account information");
    } finally {
      setBusy(false);
    }
  }

  if (profileQ.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading your account…</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="text-lg font-extrabold tracking-tight mb-1">Dispatcher account</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Keep your contact details current — dispatch notifications and trip alerts are sent to the
          email and phone number below.
        </p>

        <form onSubmit={save} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>First name *</label>
              <input
                className={inputCls}
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className={labelCls}>Last name *</label>
              <input
                className={inputCls}
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Notification email *</label>
              <input
                type="email"
                className={inputCls}
                value={form.dispatch_email}
                onChange={(e) => setForm({ ...form, dispatch_email: e.target.value })}
                required
              />
            </div>
            <div>
              <label className={labelCls}>Phone number</label>
              <input
                type="tel"
                className={inputCls}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(555) 555-5555"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="bg-primary text-primary-foreground text-sm font-bold px-5 py-2.5 rounded-sm disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save account information"}
          </button>
        </form>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 text-sm">
        <h3 className="font-extrabold tracking-tight mb-3">Account details</h3>
        <dl className="grid sm:grid-cols-2 gap-3">
          <div>
            <dt className={labelCls}>Sign-in email</dt>
            <dd className="text-foreground">{caps.email ?? "—"}</dd>
          </div>
          <div>
            <dt className={labelCls}>Roles</dt>
            <dd className="text-foreground capitalize">
              {caps.roles.map((r) => r.replace("_", " ")).join(", ") || "—"}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground mt-4">
          Your sign-in email can't be changed here. Contact an administrator if it needs to be updated.
        </p>
      </div>
    </div>
  );
}
