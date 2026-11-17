import { StatusPill } from "@/components/ds/status";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listAllTripsAdmin, listAllReservationsAdmin } from "@/lib/admin-trips.functions";
import { AdminReservationDetailModal } from "./AdminReservationDetailModal";


import {RecordTable} from '@/components/portal/RecordTable';

const STATUS_OPTIONS = ["all", "pending", "assigned", "in_progress", "completed", "canceled", "no_show"];

function StatusBadge({ status }: { status: string | null | undefined }) {
  return <StatusPill status={status ?? "unknown"} />;
}

export function AdminTripsPanel() {
  const fetch = useServerFn(listAllTripsAdmin);
  const [status, setStatus] = useState("all");
  const q = useQuery({
    queryKey: ["admin-trips", status],
    queryFn: () => fetch({ data: { status } }),
  });

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-sm p-4 flex flex-wrap gap-3 items-center">
        <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="border border-border rounded-sm px-3 py-2 bg-background text-sm">
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        <span className="text-xs text-muted-foreground ml-auto">{q.data?.length ?? 0} trips</span>
      </div>

      <div className="bg-card border border-border rounded-sm overflow-x-auto">
        <RecordTable<any> tableId="admin-trips" rows={q.data ?? []} rowKey={t=>t.id} empty={q.isLoading?'Loading trips…':q.error?(q.error as Error).message:'No trips found.'} columns={[
          {id:'id',label:'Trip ID',render:t=>t.display_id ?? t.id.slice(0,8)},
          {id:'date',label:'Date / Time',width:230,render:t=>`${t.pickup_date} ${t.pickup_time?.slice(0,5) ?? ''}`},
          {id:'patient',label:'Patient',width:240,render:t=>`${t.patient_first_name} ${t.patient_last_name}`},
          {id:'route',label:'Route',width:250,render:t=>`${t.pickup_city} ${t.pickup_zip ?? ''} ↓ ${t.dropoff_city} ${t.dropoff_zip ?? ''}`},
          {id:'original',label:'Original provider',width:250,hideable:true,render:t=>t.original_provider_name ?? '—'},
          {id:'assigned',label:'Assigned provider',width:250,render:t=>t.assigned_provider_name ?? 'Unassigned'},
          {id:'source',label:'Source',hideable:true,render:t=>t.source ?? '—'},
          {id:'status',label:'Status',width:230,minWidth:210,wrap:true,render:t=><StatusBadge status={t.status}/>},
          {id:'payment',label:'Payment',width:230,minWidth:210,wrap:true,render:t=><StatusBadge status={t.payment_status}/>},
          {id:'charge',label:'Charge',render:t=>fmtUsd(t.cost_total,false)},
          {id:'referral',label:'Referral fee',hideable:true,render:t=>fmtUsd(t.referral_fee_cents,true)},
          {id:'fee',label:'Platform fee',hideable:true,render:t=>fmtUsd(t.platform_fee_cents,true)},
          {id:'net',label:'Provider net',render:t=>fmtUsd(t.provider_payout_cents,true)},
        ]}/>

      </div>
    </div>
  );
}

function fmtUsd(v: number | null | undefined, isCents: boolean): string {
  if (v == null) return "—";
  const n = isCents ? Number(v) / 100 : Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}


type ResvState = "unconfirmed" | "booked" | "past" | "history";
const RESV_TABS: { id: ResvState; label: string; blurb: string }[] = [
  { id: "unconfirmed", label: "Unconfirmed", blurb: "New reservations awaiting approval, payment, provider assignment, or dispatch review." },
  { id: "booked", label: "Booked", blurb: "Confirmed and assigned reservations ready to be completed." },
  { id: "past", label: "Past", blurb: "Completed or canceled reservations from the last 30 days." },
  { id: "history", label: "Trip History", blurb: "Permanent record of completed reservations older than 30 days." },
];

export function AdminReservationsPanel() {
  const fetch = useServerFn(listAllReservationsAdmin);
  const [state, setState] = useState<ResvState>("unconfirmed");
  const [status, setStatus] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["admin-reservations", state, status],
    queryFn: () => fetch({ data: { reservation_state: state, status } }),
  });

  const counts = useQuery({
    queryKey: ["admin-reservations", "counts"],
    queryFn: async () => {
      const [u, b, p, h] = await Promise.all([
        fetch({ data: { reservation_state: "unconfirmed" } }),
        fetch({ data: { reservation_state: "booked" } }),
        fetch({ data: { reservation_state: "past" } }),
        fetch({ data: { reservation_state: "history" } }),
      ]);
      return { unconfirmed: u.length, booked: b.length, past: p.length, history: h.length };
    },
  });

  const meta = RESV_TABS.find((t) => t.id === state) ?? RESV_TABS[0];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight">Reservations</h2>
        <p className="text-xs text-muted-foreground">
          Lifecycle: Create Trip → Unconfirmed → Booked → Completed (Trip History). Single source of truth per reservation.
        </p>
      </div>

      <div className="inline-flex bg-card border border-border rounded-sm p-1 flex-wrap">
        {RESV_TABS.map((t) => {
          const c = counts.data?.[t.id];
          const active = state === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setState(t.id)}
              className={`text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-sm inline-flex items-center gap-2 ${
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {t.label}
              {typeof c === "number" && (
                <span className={`inline-flex items-center justify-center min-w-[1.25rem] px-1 py-0.5 rounded-sm text-[10px] font-mono ${
                  active ? "bg-primary-foreground/20" : "bg-muted text-foreground"
                }`}>{c}</span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">{meta?.blurb}</p>

      <div className="bg-card border border-border rounded-sm p-4 flex flex-wrap gap-3 items-center">
        <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="border border-border rounded-sm px-3 py-2 bg-background text-sm">
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        <span className="text-xs text-muted-foreground ml-auto">{q.data?.length ?? 0} reservations</span>
      </div>

      <div className="bg-card border border-border rounded-sm overflow-x-auto">
        <RecordTable<any> tableId="admin-reservations" rows={q.data ?? []} rowKey={r=>r.id} onRowClick={r=>setOpenId(r.id)} rowLabel={r=>`Open reservation ${r.id.slice(0,8)}`} empty={q.isLoading?'Loading reservations…':q.error?(q.error as Error).message:'No reservations in this bucket.'} columns={[
          {id:'date',label:'Date / Time',width:230,render:r=>`${r.pickup_date} ${r.pickup_time?.slice(0,5) ?? ''}`},
          {id:'patient',label:'Patient',width:240,render:r=>`${r.patient_first_name} ${r.patient_last_name}`},
          {id:'pickup',label:'Pickup',width:240,render:r=>`${r.pickup_city} ${r.pickup_zip}`},
          {id:'dropoff',label:'Dropoff',width:240,render:r=>`${r.dropoff_city} ${r.dropoff_zip ?? ''}`},
          {id:'type',label:'Type',render:r=>r.transport_type ?? '—'},
          {id:'status',label:'Status',minWidth:210,width:230,wrap:true,render:r=><StatusBadge status={r.status}/>},
          {id:'assigned',label:'Assigned',render:r=>r.assigned_provider_id?'Yes':'—'},
          {id:'created',label:'Created',hideable:true,render:r=>r.created_at?new Date(r.created_at).toLocaleDateString():'—'},
        ]}/>

      </div>

      {openId && (
        <AdminReservationDetailModal reservationId={openId} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}


