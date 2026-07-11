import { useQuery } from "@tanstack/react-query";
import { getMyProviderApplication } from "@/lib/provider-application.functions";

export function BusinessInfoPanel() {
  const q = useQuery({
    queryKey: ["my-provider-application"],
    queryFn: () => getMyProviderApplication(),
  });

  const app = q.data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight">Business info</h2>
        <p className="text-sm text-muted-foreground">
          The business data and documents you submitted when applying to My Florida NEMT.
        </p>
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!q.isLoading && !app && (
        <div className="border border-border rounded-sm p-6 bg-card text-sm text-muted-foreground">
          We couldn’t find a provider application tied to this account.
        </div>
      )}

      {app && (
        <div className="grid sm:grid-cols-2 gap-4">
          <Card title="Company">
            <Row label="Company name" value={app.company_name} />
            <Row label="Contact name" value={app.contact_name ?? `${app.first_name ?? ""} ${app.last_name ?? ""}`.trim()} />
            <Row label="Email" value={app.email} />
            <Row label="Dispatch email" value={(app as any).dispatch_email} />
            <Row label="Phone" value={(app as any).phone} />
            <Row label="Status" value={(app as any).status} />
          </Card>

          <Card title="Service area">
            <Row label="City" value={app.city} />
            <Row label="County" value={(app as any).county} />
            <Row label="ZIP" value={(app as any).zip_code} />
            <Row label="Preferred ZIPs" value={Array.isArray((app as any).preferred_zip_codes) ? (app as any).preferred_zip_codes.join(", ") : (app as any).preferred_zip_codes} />
            <Row label="Fleet size" value={(app as any).fleet_size} />
          </Card>

          <Card title="Credentials">
            <Row label="EIN" value={(app as any).ein} />
            <Row label="NPI" value={(app as any).npi} />
            <Row label="Driver license #" value={(app as any).driver_license_number} />
            <Row label="Insurance carrier" value={(app as any).insurance_carrier} />
            <Row label="Insurance policy" value={(app as any).insurance_policy} />
          </Card>

          <Card title="Documents">
            {(() => {
              const docs = (app as any).documents;
              const entries = docs && typeof docs === "object" ? Object.entries(docs) : [];
              if (entries.length === 0) return <p className="text-sm text-muted-foreground">No documents uploaded.</p>;
              return (
                <ul className="space-y-1 text-sm">
                  {entries.map(([k, v]) => (
                    <li key={k} className="flex justify-between gap-3">
                      <span className="text-muted-foreground capitalize">{k.replaceAll("_", " ")}</span>
                      {typeof v === "string" ? (
                        <a className="text-primary font-bold hover:underline truncate max-w-[60%]" href={v} target="_blank" rel="noreferrer">View</a>
                      ) : (
                        <span className="font-bold">Saved</span>
                      )}
                    </li>
                  ))}
                </ul>
              );
            })()}
          </Card>
        </div>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card border border-border rounded-sm p-4 space-y-2">
      <h3 className="font-extrabold text-sm uppercase tracking-wide">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: unknown }) {
  const display = value === null || value === undefined || value === "" ? "—" : String(value);
  return (
    <div className="flex justify-between gap-3 text-sm py-1 border-b border-border/40 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold text-right truncate max-w-[60%]">{display}</span>
    </div>
  );
}
