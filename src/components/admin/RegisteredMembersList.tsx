import { StatusPill } from "@/components/ds/status";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listNonPatientUsers, setMemberMembership } from "@/lib/admin-users.functions";
import { supabase } from "@/integrations/supabase/client";



import {RecordTable} from '@/components/portal/RecordTable';

/**
 * Shows every registered account for a portal (provider or facility) sourced
 * directly from auth.users + member_profiles. This is the single source of
 * truth in the Admin Portal — every account that exists anywhere in the
 * platform appears here in real time.
 */
export function RegisteredMembersList({
  portal,
  title,
}: {
  portal: "provider" | "facility";
  title: string;
}) {
  const fetchUsers = useServerFn(listNonPatientUsers);
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const usersQ = useQuery({
    queryKey: ["admin", "non-patient-users"],
    queryFn: () => fetchUsers(),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  // Real-time sync: refetch when member profiles, roles, or provider apps change
  useEffect(() => {
    const channel = supabase
      .channel(`admin-members-${portal}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "member_profiles" }, () => {
        qc.invalidateQueries({ queryKey: ["admin", "non-patient-users"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "provider_applications" }, () => {
        qc.invalidateQueries({ queryKey: ["admin", "non-patient-users"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [portal, qc]);


  const rows = useMemo(() => {
    const all = (usersQ.data ?? []).filter((u: any) => u.portal === portal);
    if (!q.trim()) return all;
    const t = q.toLowerCase();
    return all.filter(
      (u: any) =>
        (u.email ?? "").toLowerCase().includes(t) ||
        (u.company_name ?? "").toLowerCase().includes(t) ||
        (u.city ?? "").toLowerCase().includes(t),
    );
  }, [usersQ.data, portal, q]);

  return (
    <div className="bg-card border border-border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            All registered {portal} accounts — synced live from the platform. {rows.length} shown.
          </p>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search email, company, city…"
          className="min-w-0 w-full sm:w-64 px-3 py-2 border border-border text-sm bg-background"
        />
      </div>

      {usersQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : usersQ.error ? (
        <p className="text-sm text-red-600">Could not load: {(usersQ.error as any).message}</p>
      ) : (
        <RecordTable<any> tableId={`registered-${portal}-accounts`} rows={rows} rowKey={u=>u.id} empty={`No ${portal} accounts yet.`} columns={[
          {id:'email',label:'Email',width:280,render:u=>u.email ?? '—'},
          {id:'company',label:'Company / Facility',width:280,render:u=>u.company_name ?? '—'},
          {id:'city',label:'City',render:u=>u.city ?? '—'},
          {id:'state',label:'State',hideable:true,render:u=>u.state ?? '—'},
          {id:'zip',label:'ZIP',hideable:true,render:u=>u.postal_code ?? '—'},
          {id:'zone',label:'Dispatch Zone',width:240,hideable:true,render:u=>u.dispatch_zone_name?`${u.dispatch_zone_name}${u.dispatch_zone_code?` (${u.dispatch_zone_code})`:''}`:u.region ?? '—'},
          {id:'phone',label:'Phone',width:220,hideable:true,render:u=>u.phone ?? '—'},
          {id:'vehicles',label:'Vehicles',hideable:true,render:u=>u.vehicles_count ?? 0},
          {id:'drivers',label:'Drivers',hideable:true,render:u=>u.drivers_count ?? 0},
          {id:'status',label:'Status',minWidth:230,wrap:true,render:u=>u.application_status==='approved'?<StatusPill status="Approved"/>:u.application_status ?? '—'},
          {id:'membership',label:'Membership',width:300,minWidth:270,wrap:true,render:u=><MembershipControl user={u}/>},
          {id:'created',label:'Created',hideable:true,render:u=>u.created_at?new Date(u.created_at).toLocaleDateString():'—'},
        ]}/>

      )}
    </div>
  );
}

/**
 * Inline membership control: lets admins/ops grant or revoke a member's
 * membership tier. Writes go through the audited `setMemberMembership`
 * server action (regular members cannot change these fields themselves).
 */
function MembershipControl({ user }: { user: any }) {
  const qc = useQueryClient();
  const setMembership = useServerFn(setMemberMembership);
  const tier: string = user.membership_tier ?? "none";
  const status: string = user.membership_status ?? "inactive";

  const mutation = useMutation({
    mutationFn: (next: "none" | "free" | "paid") =>
      setMembership({ data: { user_id: user.id, tier: next } }),
    onSuccess: (_d, next) => {
      toast.success(
        next === "none"
          ? "Membership removed"
          : `Membership set to ${next === "paid" ? "Paid" : "Free"}`,
      );
      qc.invalidateQueries({ queryKey: ["admin", "non-patient-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update membership"),
  });

  return (
    <div className="flex items-center gap-2">
      <select
        value={tier}
        disabled={mutation.isPending}
        onChange={(e) => mutation.mutate(e.target.value as "none" | "free" | "paid")}
        className="text-xs font-semibold bg-background border border-border rounded-sm px-2 py-1 disabled:opacity-60"
        aria-label={`Membership for ${user.email ?? user.company_name ?? "member"}`}
      >
        <option value="none">None</option>
        <option value="free">Free</option>
        <option value="paid">Paid</option>
      </select>
      <span
        className={
          status === "active"
            ? "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-800"
            : "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground"
        }
      >
        {status}
      </span>
    </div>
  );
}
