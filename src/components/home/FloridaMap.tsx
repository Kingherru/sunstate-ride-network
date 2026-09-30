import { useMemo, useState } from "react";
import { Building2, Hash, Layers, Map as MapIcon, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { FL_COUNTY_PATHS, FL_VIEWBOX, project } from "@/lib/florida-counties";

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

// City coordinates (approximate) and county.
const CITY_LL: Record<string, [number, number, string]> = {
  Pensacola: [30.42, -87.22, "Escambia"], "Panama City": [30.16, -85.66, "Bay"], Tallahassee: [30.44, -84.28, "Leon"],
  Jacksonville: [30.33, -81.66, "Duval"], "St. Augustine": [29.9, -81.31, "St. Johns"], "Palm Coast": [29.58, -81.21, "Flagler"],
  Gainesville: [29.65, -82.32, "Alachua"], Ocala: [29.19, -82.14, "Marion"], Inverness: [28.84, -82.33, "Citrus"],
  Orlando: [28.54, -81.38, "Orange"], "Daytona Beach": [29.21, -81.02, "Volusia"], Melbourne: [28.08, -80.61, "Brevard"], Lakeland: [28.04, -81.95, "Polk"],
  Tampa: [27.95, -82.46, "Hillsborough"], "St. Petersburg": [27.77, -82.64, "Pinellas"], Sarasota: [27.34, -82.53, "Sarasota"],
  "Fort Myers": [26.64, -81.87, "Lee"], Naples: [26.14, -81.79, "Collier"], "Port Charlotte": [26.98, -82.09, "Charlotte"],
  Miami: [25.76, -80.19, "Miami-Dade"], "Fort Lauderdale": [26.12, -80.14, "Broward"], "West Palm Beach": [26.72, -80.05, "Palm Beach"],
  "Port St. Lucie": [27.27, -80.35, "St. Lucie"], "Key West": [24.56, -81.78, "Monroe"],
};

// Approximate 3-digit ZIP prefixes → region + rough location (demonstration only).
const ZIP3: Record<string, [RegionId, number, number]> = {
  "320": ["northeast", 30.2, -82.0], "321": ["central", 29.2, -81.1], "322": ["northeast", 30.33, -81.66], "323": ["panhandle", 30.44, -84.28],
  "324": ["panhandle", 30.16, -85.66], "325": ["panhandle", 30.42, -87.22], "326": ["north-central", 29.65, -82.32], "327": ["central", 28.7, -81.4],
  "328": ["central", 28.54, -81.38], "329": ["central", 28.08, -80.61], "330": ["southeast", 25.6, -80.4], "331": ["southeast", 25.76, -80.19],
  "332": ["southeast", 25.8, -80.2], "333": ["southeast", 26.12, -80.14], "334": ["southeast", 26.72, -80.05], "335": ["tampa-bay", 28.0, -82.3],
  "336": ["tampa-bay", 27.95, -82.46], "337": ["tampa-bay", 27.77, -82.64], "338": ["central", 28.04, -81.95], "339": ["southwest", 26.64, -81.87],
  "341": ["southwest", 26.14, -81.79], "342": ["tampa-bay", 27.34, -82.53], "344": ["north-central", 29.19, -82.14], "346": ["tampa-bay", 28.3, -82.6],
  "347": ["central", 28.4, -81.4], "349": ["southeast", 27.27, -80.35],
};
const COUNTY_REGION: Record<string, RegionId> = Object.fromEntries(ALL_COUNTIES.map((x) => [x.c, x.r]));

type Mode = "region" | "county" | "city" | "zip";
const MODES: { id: Mode; label: string }[] = [
  { id: "region", label: "Region" }, { id: "county", label: "County" }, { id: "city", label: "City" }, { id: "zip", label: "ZIP code" },
];

export function FloridaMap() {
  const [mode, setMode] = useState<Mode>("region");
  const [region, setRegion] = useState<RegionId>("central");
  const [zip, setZip] = useState("");
  const [zipMsg, setZipMsg] = useState<string | null>(null);
  const [county, setCounty] = useState<string | null>(null);
  const [marker, setMarker] = useState<{ ll: [number, number]; label: string } | null>(null);
  const sel = useMemo(() => REGIONS.find((r) => r.id === region)!, [region]);

  const onZip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{5}$/.test(zip)) return setZipMsg("Enter a 5-digit ZIP code.");
    const z = ZIP3[zip.slice(0, 3)];
    if (!z) return setZipMsg("That ZIP code doesn’t look like a Florida ZIP.");
    const [r, lat, lon] = z;
    setRegion(r); setCounty(null); setMarker({ ll: [lon, lat], label: `ZIP ${zip} (approximate)` });
    setZipMsg(`${zip} is in the ${REGIONS.find((x) => x.id === r)!.name} region. Location is approximate; service availability varies.`);
  };

  const fieldCls = "ds-body-lg w-full min-h-13 rounded-ds-sm border border-ds-border bg-ds-surface px-3 text-ds-on-surface focus-visible:outline-none focus-visible:border-ds-focus focus-visible:ring-2 focus-visible:ring-ds-focus/30";

  return (
    <section id="coverage" aria-labelledby="map-title" className="mfn-section bg-ds-sky scroll-mt-20">
      <div className="mfn-container-wide grid gap-12 lg:grid-cols-[45fr_55fr] lg:gap-12 lg:items-center">
        <div className="text-ds-on-soft">
          <p className="ds-label text-ds-accent-active">Florida network</p>
          <h2 id="map-title" className="ds-page-title mt-2 text-ds-primary">Connections across Florida start here.</h2>
          <p className="ds-body-lg mt-4">My Florida NEMT is being built around all 67 Florida counties, helping customers, facilities and providers find the right place to begin.</p>

          <div role="radiogroup" aria-label="Explore by" className="mt-8 flex flex-wrap gap-2">
            {MODES.map((m) => { const MIcon = { region: MapIcon, county: Layers, city: Building2, zip: Hash }[m.id]; return (
              <button key={m.id} role="radio" aria-checked={mode === m.id} onClick={() => { setMode(m.id); setCounty(null); setMarker(null); }}
                className={cn("ds-button-text ds-transition min-h-12 rounded-ds-sm px-6 text-[1.0625rem] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus",
                  mode === m.id ? "bg-ds-primary text-ds-on-primary" : "bg-ds-surface text-ds-primary hover:bg-ds-hover")}>
                <span className="inline-flex items-center gap-2"><MIcon className="size-5" aria-hidden />{m.label}</span>
              </button>
            ); })}
          </div>

          <div className="mt-6 max-w-xl">
            {mode === "region" && (
              <label className="block"><span className="ds-label">Choose a region</span>
                <select className={cn(fieldCls, "mt-1.5")} value={region} onChange={(e) => { setRegion(e.target.value as RegionId); setCounty(null); }}>
                  {REGIONS.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select></label>
            )}
            {mode === "county" && (
              <label className="block"><span className="ds-label">Choose one of 67 counties</span>
                <select className={cn(fieldCls, "mt-1.5")} defaultValue="" onChange={(e) => { const f = ALL_COUNTIES.find((x) => x.c === e.target.value); if (f) { setRegion(f.r); setCounty(f.c); } }}>
                  <option value="" disabled>Select a county</option>
                  {ALL_COUNTIES.map((x) => <option key={x.c} value={x.c}>{x.c} County</option>)}
                </select></label>
            )}
            {mode === "city" && (
              <label className="block"><span className="ds-label">Choose a city</span>
                <select className={cn(fieldCls, "mt-1.5")} defaultValue="" onChange={(e) => { const f = ALL_CITIES.find((x) => x.c === e.target.value); const ll = f && CITY_LL[f.c]; if (f && ll) { setRegion(f.r); setCounty(ll[2]); setMarker({ ll: [ll[1], ll[0]], label: f.c }); } }}>
                  <option value="" disabled>Select a city</option>
                  {ALL_CITIES.map((x) => <option key={x.c} value={x.c}>{x.c}</option>)}
                </select></label>
            )}
            {mode === "zip" && (
              <form onSubmit={onZip} className="flex items-end gap-2">
                <label className="block flex-1"><span className="ds-label">Florida ZIP code</span>
                  <input inputMode="numeric" maxLength={5} value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))} className={cn(fieldCls, "mt-1.5")} placeholder="e.g. 32801" aria-describedby="zip-msg" /></label>
                <button className="ds-button-text min-h-13 rounded-ds-sm bg-ds-primary px-6 text-ds-on-primary hover:bg-ds-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-focus focus-visible:ring-offset-2">Find</button>
              </form>
            )}
            <p id="zip-msg" aria-live="polite" className="ds-support mt-2 min-h-6">{mode === "zip" ? zipMsg : null}</p>
          </div>

          <div className="mt-2 rounded-ds bg-ds-surface p-6 text-ds-on-surface shadow-ds" aria-live="polite">
            {county && <p className="ds-label text-ds-accent-active">{county} County · provider participation information is not yet available</p>}
            <p className="ds-section-title text-ds-primary">{sel.name}</p>
            <p className="ds-body-lg mt-1 text-ds-text-2">{sel.counties.length} counties · including {sel.cities.join(", ")}</p>
            <p className="ds-body mt-4">{sel.counties.join(" · ")}</p>
          </div>
          <p className="ds-subheading mt-6 text-[1.125rem]">Provider participation and service availability vary by location and trip requirements.</p>
        </div>

        <div className="relative">
          <svg viewBox={FL_VIEWBOX} role="img" aria-label={`Map of Florida's 67 counties with ${county ? county + " County" : sel.name} highlighted`} className="mx-auto h-auto max-h-[40rem] w-full">
            {Object.entries(FL_COUNTY_PATHS).map(([name, d]) => {
              const inRegion = COUNTY_REGION[name] === region;
              const isCounty = county === name;
              return (
                <path key={name} d={d} strokeWidth={isCounty ? 1.6 : 0.6} strokeLinejoin="round"
                  fill={isCounty ? "var(--ds-accent)" : inRegion ? (county ? "var(--ds-peach)" : "var(--ds-accent)") : "var(--ds-surface)"}
                  stroke="var(--ds-primary)" strokeOpacity={isCounty ? 1 : 0.45}
                  className="ds-transition cursor-pointer hover:opacity-80"
                  onClick={() => { setRegion(COUNTY_REGION[name]); setCounty(name); setMarker(null); }}>
                  <title>{`${name} County`}</title>
                </path>
              );
            })}
            {marker && (() => { const [x, y] = project(marker.ll[0], marker.ll[1]); return (
              <g aria-hidden><circle className="ds-circle" cx={x} cy={y} r={9} fill="var(--ds-primary)" fillOpacity={0.15} /><circle className="ds-circle" cx={x} cy={y} r={4} fill="var(--ds-primary)" stroke="var(--ds-surface)" strokeWidth={1.5} /></g>
            ); })()}
          </svg>
          {marker && <p className="ds-support mt-1 text-center">{marker.label}</p>}
          <p className="ds-caption mt-2 flex items-center gap-1.5"><MapPin className="size-3.5" aria-hidden /> County boundaries: US Census Bureau (public domain). Region groupings and locations are approximate.</p>
        </div>
      </div>
    </section>
  );
}
