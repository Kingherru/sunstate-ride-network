import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

type RegionId = "panhandle" | "northeast" | "north-central" | "central" | "tampa-bay" | "southwest" | "southeast";

const REGIONS: { id: RegionId; name: string; x: number; y: number; cities: string[]; counties: string[] }[] = [
  { id: "panhandle", name: "Panhandle & Big Bend", x: 120, y: 72, cities: ["Pensacola", "Panama City", "Tallahassee"], counties: ["Escambia", "Santa Rosa", "Okaloosa", "Walton", "Holmes", "Washington", "Bay", "Jackson", "Calhoun", "Gulf", "Liberty", "Franklin", "Gadsden", "Leon", "Wakulla", "Jefferson", "Madison", "Taylor"] },
  { id: "northeast", name: "Northeast", x: 318, y: 84, cities: ["Jacksonville", "St. Augustine", "Palm Coast"], counties: ["Hamilton", "Suwannee", "Lafayette", "Dixie", "Columbia", "Baker", "Union", "Bradford", "Nassau", "Duval", "Clay", "St. Johns", "Putnam", "Flagler"] },
  { id: "north-central", name: "North Central", x: 282, y: 140, cities: ["Gainesville", "Ocala", "Inverness"], counties: ["Gilchrist", "Alachua", "Levy", "Marion", "Citrus", "Hernando"] },
  { id: "central", name: "Central", x: 350, y: 196, cities: ["Orlando", "Daytona Beach", "Melbourne", "Lakeland"], counties: ["Volusia", "Lake", "Sumter", "Seminole", "Orange", "Osceola", "Brevard", "Polk"] },
  { id: "tampa-bay", name: "Tampa Bay", x: 298, y: 244, cities: ["Tampa", "St. Petersburg", "Sarasota"], counties: ["Pasco", "Pinellas", "Hillsborough", "Manatee", "Sarasota", "Hardee", "DeSoto", "Highlands"] },
  { id: "southwest", name: "Southwest", x: 330, y: 320, cities: ["Fort Myers", "Naples", "Port Charlotte"], counties: ["Charlotte", "Lee", "Collier", "Glades", "Hendry"] },
  { id: "southeast", name: "Southeast & Treasure Coast", x: 398, y: 300, cities: ["Miami", "Fort Lauderdale", "West Palm Beach", "Port St. Lucie", "Key West"], counties: ["Indian River", "St. Lucie", "Okeechobee", "Martin", "Palm Beach", "Broward", "Miami-Dade", "Monroe"] },
];
const ALL_COUNTIES = REGIONS.flatMap((r) => r.counties.map((c) => ({ c, r: r.id }))).sort((a, b) => a.c.localeCompare(b.c));
const ALL_CITIES = REGIONS.flatMap((r) => r.cities.map((c) => ({ c, r: r.id }))).sort((a, b) => a.c.localeCompare(b.c));

// Approximate 3-digit ZIP prefixes → region (demonstration only).
const ZIP3: Record<string, RegionId> = {
  "320": "northeast", "321": "central", "322": "northeast", "323": "panhandle", "324": "panhandle", "325": "panhandle",
  "326": "north-central", "327": "central", "328": "central", "329": "central", "330": "southeast", "331": "southeast",
  "332": "southeast", "333": "southeast", "334": "southeast", "335": "tampa-bay", "336": "tampa-bay", "337": "tampa-bay",
  "338": "central", "339": "southwest", "341": "southwest", "342": "tampa-bay", "344": "north-central", "346": "tampa-bay",
  "347": "central", "349": "southeast",
};

const OUTLINE = "M 10 44 L 150 40 L 228 44 L 262 54 L 336 56 L 342 90 L 350 124 L 364 164 L 382 206 L 400 254 L 414 300 L 420 342 L 414 376 L 398 392 L 372 394 L 352 380 L 334 348 L 318 312 L 302 272 L 290 236 L 282 202 L 268 168 L 250 134 L 228 114 L 200 104 L 182 114 L 160 102 L 120 92 L 70 84 L 22 80 Z";

type Mode = "region" | "county" | "city" | "zip";
const MODES: { id: Mode; label: string }[] = [
  { id: "region", label: "Region" }, { id: "county", label: "County" }, { id: "city", label: "City" }, { id: "zip", label: "ZIP code" },
];

export function FloridaMap() {
  const [mode, setMode] = useState<Mode>("region");
  const [region, setRegion] = useState<RegionId>("central");
  const [zip, setZip] = useState("");
  const [zipMsg, setZipMsg] = useState<string | null>(null);
  const sel = useMemo(() => REGIONS.find((r) => r.id === region)!, [region]);

  const onZip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{5}$/.test(zip)) return setZipMsg("Enter a 5-digit ZIP code.");
    const r = ZIP3[zip.slice(0, 3)];
    if (!r) return setZipMsg("That ZIP code doesn’t look like a Florida ZIP.");
    setRegion(r);
    setZipMsg(`${zip} is in the ${REGIONS.find((x) => x.id === r)!.name} region.`);
  };

  const fieldCls = "ds-body-lg w-full min-h-13 border border-ds-border bg-ds-surface px-3 text-ds-on-surface focus-visible:outline-none focus-visible:border-ds-focus focus-visible:ring-2 focus-visible:ring-ds-focus/30";

  return (
    <section id="coverage" aria-labelledby="map-title" className="bg-ds-sky py-20 sm:py-28 scroll-mt-20">
      <div className="mfn-container-wide grid gap-12 lg:grid-cols-[45fr_55fr] lg:gap-16 lg:items-center">
        <div className="text-ds-on-soft">
          <p className="ds-label text-ds-accent-active">Florida network</p>
          <h2 id="map-title" className="ds-page-title mt-2 text-ds-primary">Connections across Florida start here.</h2>
          <p className="ds-body-lg mt-4">My Florida NEMT is being built around all 67 Florida counties, helping customers, facilities and providers find the right place to begin.</p>

          <div role="radiogroup" aria-label="Explore by" className="mt-8 flex flex-wrap gap-2">
            {MODES.map((m) => (
              <button key={m.id} role="radio" aria-checked={mode === m.id} onClick={() => setMode(m.id)}
                className={cn("ds-button-text ds-transition min-h-12 px-6 text-[1.0625rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-focus",
                  mode === m.id ? "bg-ds-primary text-ds-on-primary" : "bg-ds-surface text-ds-primary hover:bg-ds-hover")}>
                {m.label}
              </button>
            ))}
          </div>

          <div className="mt-6 max-w-xl">
            {mode === "region" && (
              <label className="block"><span className="ds-label">Choose a region</span>
                <select className={cn(fieldCls, "mt-1.5")} value={region} onChange={(e) => setRegion(e.target.value as RegionId)}>
                  {REGIONS.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select></label>
            )}
            {mode === "county" && (
              <label className="block"><span className="ds-label">Choose one of 67 counties</span>
                <select className={cn(fieldCls, "mt-1.5")} defaultValue="" onChange={(e) => { const f = ALL_COUNTIES.find((x) => x.c === e.target.value); if (f) setRegion(f.r); }}>
                  <option value="" disabled>Select a county</option>
                  {ALL_COUNTIES.map((x) => <option key={x.c} value={x.c}>{x.c} County</option>)}
                </select></label>
            )}
            {mode === "city" && (
              <label className="block"><span className="ds-label">Choose a city</span>
                <select className={cn(fieldCls, "mt-1.5")} defaultValue="" onChange={(e) => { const f = ALL_CITIES.find((x) => x.c === e.target.value); if (f) setRegion(f.r); }}>
                  <option value="" disabled>Select a city</option>
                  {ALL_CITIES.map((x) => <option key={x.c} value={x.c}>{x.c}</option>)}
                </select></label>
            )}
            {mode === "zip" && (
              <form onSubmit={onZip} className="flex items-end gap-2">
                <label className="block flex-1"><span className="ds-label">Florida ZIP code</span>
                  <input inputMode="numeric" maxLength={5} value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))} className={cn(fieldCls, "mt-1.5")} placeholder="e.g. 32801" aria-describedby="zip-msg" /></label>
                <button className="ds-button-text min-h-13 bg-ds-primary px-6 text-ds-on-primary hover:bg-ds-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-focus focus-visible:ring-offset-2">Find</button>
              </form>
            )}
            <p id="zip-msg" aria-live="polite" className="ds-support mt-2 min-h-6">{mode === "zip" ? zipMsg : null}</p>
          </div>

          <div className="mt-2 bg-ds-surface p-7 text-ds-on-surface" aria-live="polite">
            <p className="ds-section-title text-ds-primary">{sel.name}</p>
            <p className="ds-body-lg mt-1 text-ds-text-2">{sel.counties.length} counties · including {sel.cities.join(", ")}</p>
            <p className="ds-body mt-4">{sel.counties.join(" · ")}</p>
          </div>
          <p className="ds-subheading mt-6 text-[1.125rem]">Provider participation and service availability vary by location and trip requirements.</p>
        </div>

        <div className="relative">
          <svg viewBox="0 0 430 410" role="img" aria-label={`Simplified map of Florida with ${sel.name} highlighted`} className="h-auto w-full">
            <path d={OUTLINE} fill="var(--ds-surface)" stroke="var(--ds-primary)" strokeOpacity="0.25" strokeWidth="2" strokeLinejoin="round" />
            {/* subtle road connections */}
            <g fill="none" stroke="var(--ds-primary)" strokeOpacity="0.14" strokeWidth="1" strokeLinecap="round">
              <path d="M 40 70 L 120 72 L 222 80 L 318 84" />
              <path d="M 318 84 L 350 196 L 398 300" />
              <path d="M 282 140 L 298 244 L 330 320 L 398 300" />
              <path d="M 282 140 L 350 196" />
              <path d="M 298 244 L 350 196" />
            </g>
            {REGIONS.map((r) => {
              const on = r.id === region;
              return (
                <g key={r.id} role="button" tabIndex={0} aria-label={`Show ${r.name}`} aria-pressed={on}
                  onClick={() => setRegion(r.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setRegion(r.id); } }}
                  className="cursor-pointer outline-none [&:focus-visible>circle:first-child]:stroke-[var(--ds-focus)]">
                  <circle cx={r.x} cy={r.y} r={on ? 12 : 9} fill="var(--ds-primary)" fillOpacity={on ? 0.12 : 0.0001} stroke="transparent" strokeWidth="3" className="ds-transition" />
                  <circle cx={r.x} cy={r.y} r={on ? 5 : 3.5} fill={on ? "var(--ds-accent)" : "var(--ds-primary)"} />
                </g>
              );
            })}
          </svg>
          <p className="ds-caption mt-2 flex items-center gap-1.5"><MapPin className="size-3.5" aria-hidden /> Simplified illustration. Region groupings are approximate.</p>
        </div>
      </div>
    </section>
  );
}
