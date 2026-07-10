const RULES: { title: string; body: string }[] = [
  { title: "1. Never turn back an accepted trip", body: "Once you approve a request and it moves to Reservations, the patient is counting on you. Turn-backs after acceptance are tracked and repeated violations result in removal from the platform." },
  { title: "2. Be on time, every time", body: "Arrive at pickup within the 15-minute on-time window. Chronic late pickups are the #1 reason patients miss dialysis, chemo, and surgery appointments." },
  { title: "3. Complete every pickup", body: "No-shows from the provider side (failing to pick up an assigned patient) are a critical violation. If you cannot complete a trip, you must release it back at least 4 hours before pickup so it can be re-routed." },
  { title: "4. HIPAA — always", body: "Never share PHI (patient name, Medicaid #, diagnosis, address) outside the platform. Use the in-app trip sheet, do not text patient info, do not email it unencrypted." },
  { title: "5. Vehicles and drivers must be current", body: "Driver license, insurance, registration, and vehicle inspection must be current at all times. Expired credentials = automatic suspension from the dispatch network." },
  { title: "6. Honor your pricing", body: "The rates you set in Pricing are what you'll be paid. Do not bill the patient separately or accept side payments — this is grounds for permanent removal." },
  { title: "7. Respect wheelchair & assistance requirements", body: "If a trip is marked wheelchair, bed-to-bed, or requires sign-in assistance, you must meet that service level. Sending a sedan to a wheelchair trip is a no-show." },
  { title: "8. Communicate proactively", body: "If you'll be late, mark the trip 'En route' and let dispatch know. Silence is worse than a late arrival." },
];

const TRANSPARENCY: { title: string; body: string }[] = [
  {
    title: "T1. Patient loyalty — 2-hour priority offer",
    body: "Priority #1: if you have previously transported a patient, that patient is considered yours. On any new trip for that patient you receive a private 2-hour priority offer to accept or refuse before the trip is released to the open pool.",
  },
  {
    title: "T2. Balanced, transparent scoring",
    body: "Every open trip is scored against every eligible provider using: provider rating, competitive pricing, geographic service area coverage, vehicle capability for the trip type (wheelchair, stretcher, door-through-door), fleet size, and fair distribution of recent assignments.",
  },
  {
    title: "T3. Fleet size — capacity credit, not a monopoly",
    body: "Larger fleets receive reasonable capacity credit for their ability to cover more trips, but the credit is capped (diminishing returns). Independent owner-operators and small companies who meet the same quality standards compete on equal footing.",
  },
  {
    title: "T4. NEMT-specific matching",
    body: "Wheelchair, stretcher, bariatric, door-through-door, and other specialized requirements are enforced before scoring. A provider without the required vehicle or capability is never offered the trip, regardless of price or rating.",
  },
  {
    title: "T5. Fair distribution",
    body: "A rolling 14-day recent-assignment count reduces score temporarily so no single provider vacuums up every trip. As your load evens out, your fairness score recovers automatically.",
  },
  {
    title: "T6. Credential gating",
    body: "Expired insurance, registration, driver's license, or Medicaid credentials remove you from all assignment scoring — the algorithm cannot offer you trips until the credential is renewed.",
  },
];

const STRIKES = [
  "1st turn-back / late / no-show in a 30-day window: warning",
  "2nd violation: 7-day suspension from auto-routing",
  "3rd violation: permanent removal from the MyFloridaNemt.com platform",
];

export function RulesPanel() {
  return (
    <div className="max-w-6xl space-y-8">
      <div className="grid gap-8 md:grid-cols-2">
        {/* Rules of the Road */}
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">Rules of the Road</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Simple, non-negotiable. Patients depend on us — these rules keep the network reliable.
            </p>
          </div>
          <div className="space-y-3">
            {RULES.map((r) => (
              <div key={r.title} className="bg-card border border-border rounded-sm p-4">
                <div className="font-extrabold">{r.title}</div>
                <p className="text-sm text-muted-foreground mt-1">{r.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Transparency Rules — right side on desktop */}
        <section className="space-y-4">
          <div>
            <h3 className="text-2xl font-extrabold tracking-tight">Provider trip assignment transparency rules</h3>
            <p className="text-sm text-muted-foreground mt-1">
              How trips are offered and scored — published so you always know why you did or did not receive a trip.
            </p>
          </div>
          <div className="space-y-3">
            {TRANSPARENCY.map((r) => (
              <div key={r.title} className="bg-card border border-border rounded-sm p-4">
                <div className="font-extrabold">{r.title}</div>
                <p className="text-sm text-muted-foreground mt-1">{r.body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="bg-orange-50 border border-orange-200 rounded-sm p-5 max-w-3xl">
        <div className="font-extrabold text-orange-900 mb-2">Three-strike enforcement</div>
        <ul className="text-sm text-orange-900 space-y-1 list-disc list-inside">
          {STRIKES.map((s) => <li key={s}>{s}</li>)}
        </ul>
      </div>

      <p className="text-xs text-muted-foreground max-w-3xl">
        By accepting trips on this platform you agree to these rules. Updated rules will be announced before they take effect.
      </p>
    </div>
  );
}
