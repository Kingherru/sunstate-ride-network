import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listNonPatientUsers } from "@/lib/admin-users.functions";

export function AdminUsersPanel() {
  const fetchUsers = useServerFn(listNonPatientUsers);
  const [filter, setFilter] = useState<"all" | "provider" | "facility">("all");
  const [q, setQ] = useState("");

  const usersQ = useQuery({
    queryKey: ["admin", "non-patient-users"],
    queryFn: () => fetchUsers(),
  });

  const rows = (usersQ.data ?? []).filter((u: any) => {
    if (filter !== "all" && u.portal !== filter) return false;
    if (q) {
      const t = q.toLowerCase();
      if (
        !(u.email ?? "").toLowerCase().includes(t) &&
        !(u.company_name ?? "").toLowerCase().includes(t) &&
        !(u.city ?? "").toLowerCase().includes(t)
      )
        return false;
    }
    return true;
  });

  const counts = (usersQ.data ?? []).reduce(
    (acc: any, u: any) => {
      acc[u.portal] = (acc[u.portal] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="bg-card border border-border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight">All users — providers &amp; facilities</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Patient accounts are intentionally hidden from admin to protect PHI confidentiality.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          {(["all", "provider", "facility"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-3 py-1.5 border ${filter === k ? "bg-primary text-white border-primary" : "bg-background border-border"}`}
            >
              {k === "all" ? `All (${(usersQ.data ?? []).length})` : `${k} (${counts[k] ?? 0})`}
            </button>
          ))}
        </div>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search email, company, or city"
        className="w-full mb-3 px-3 py-2 border border-border text-sm bg-background"
      />

      {usersQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading users…</p>
      ) : usersQ.error ? (
        <p className="text-sm text-red-600">Could not load users: {(usersQ.error as any).message}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
              <tr>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Portal</th>
                <th className="py-2 pr-3">Company / Facility</th>
                <th className="py-2 pr-3">City</th>
                <th className="py-2 pr-3">Region</th>
                <th className="py-2 pr-3">Membership</th>
                <th className="py-2 pr-3">Last sign-in</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u: any) => (
                <tr key={u.id} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-mono text-xs">{u.email ?? "—"}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase ${
                        u.portal === "provider"
                          ? "bg-accent/15 text-accent"
                          : u.portal === "facility"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted/20 text-muted-foreground"
                      }`}
                    >
                      {u.portal}
                    </span>
                  </td>
                  <td className="py-2 pr-3">{u.company_name ?? "—"}</td>
                  <td className="py-2 pr-3">{u.city ?? "—"}</td>
                  <td className="py-2 pr-3">{u.region ?? "—"}</td>
                  <td className="py-2 pr-3">
                    {u.membership_tier ?? "—"}{u.membership_status ? ` · ${u.membership_status}` : ""}
                  </td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">
                    {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "never"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-sm text-muted-foreground">No matching users.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground mt-3">
        Passwords are stored as one-way hashes and are <strong>not</strong> retrievable — not by admins, not by us.
        Use the "Send password reset" flow if a user is locked out.
      </p>
    </div>
  );
}
