import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Google Places (New) address autocomplete.
 * Uses the AutocompleteSuggestion API through the browser Maps JS library,
 * then fetches address components + geometry with a single Place.fetchFields call.
 *
 * Falls back to a plain text input if the browser key is not configured.
 */

const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const CHANNEL = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

let mapsPromise: Promise<any> | null = null;
function loadMaps(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no_window"));
  if ((window as any).google?.maps) return Promise.resolve((window as any).google);
  if (mapsPromise) return mapsPromise;
  if (!BROWSER_KEY) return Promise.reject(new Error("no_key"));
  mapsPromise = new Promise((resolve, reject) => {
    (window as any).__initFLNemtMap = () => resolve((window as any).google);
    const s = document.createElement("script");
    const channel = CHANNEL ? `&channel=${encodeURIComponent(CHANNEL)}` : "";
    s.src = `https://maps.googleapis.com/maps/api/js?key=${BROWSER_KEY}&loading=async&libraries=places,geometry&callback=__initFLNemtMap${channel}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => { mapsPromise = null; reject(new Error("script_error")); };
    document.head.appendChild(s);
  });
  return mapsPromise;
}

export type AddressSelection = {
  address: string;         // "123 Main St" (street number + route, no city/state)
  fullAddress: string;     // Google's formatted address
  city: string;
  state: string;           // 2-letter
  zip: string;
  county: string;
  country: string;
  lat: number | null;
  lng: number | null;
  placeId: string;
};

function componentValue(components: any[], type: string, useShort = false): string {
  const c = components.find((x) => x.types?.includes(type));
  if (!c) return "";
  return (useShort ? c.short_name ?? c.shortText : c.long_name ?? c.longText) ?? "";
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Start typing an address…",
  className = "w-full border border-border rounded-sm px-3 py-2 bg-background",
  inputId,
  disabled,
  countries = ["us"],
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (s: AddressSelection) => void;
  placeholder?: string;
  className?: string;
  inputId?: string;
  disabled?: boolean;
  countries?: string[];
  required?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ placeId: string; text: string; secondary: string }>>([]);
  const [highlight, setHighlight] = useState(0);
  const [loadError, setLoadError] = useState<null | "no_key" | "script_error" | "referrer_blocked" | "places_api_disabled" | "request_denied" | "quota" | "unknown">(null);
  const sessionTokenRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const suppressNextFetchRef = useRef(false);

  useEffect(() => {
    let alive = true;
    loadMaps()
      .then(() => { if (alive) { setReady(true); setLoadError(null); } })
      .catch((err: Error) => {
        if (!alive) return;
        setReady(false);
        setLoadError(err?.message === "no_key" ? "no_key" : "script_error");
      });
    // Google Maps writes its own errors to console.error; intercept once to surface referrer / API-not-enabled failures.
    const origErr = console.error;
    console.error = (...args: unknown[]) => {
      try {
        const msg = args.map((a) => (typeof a === "string" ? a : (a as any)?.message ?? "")).join(" ");
        if (/RefererNotAllowedMapError|referer.*not.*allowed/i.test(msg)) setLoadError("referrer_blocked");
        else if (/Places API \(New\) has not been used|places\.googleapis\.com.*disabled|SERVICE_DISABLED/i.test(msg)) setLoadError("places_api_disabled");
        else if (/REQUEST_DENIED|ApiNotActivatedMapError|InvalidKeyMapError/i.test(msg)) setLoadError("request_denied");
        else if (/OverQuota|OVER_QUERY_LIMIT/i.test(msg)) setLoadError("quota");
      } catch { /* noop */ }
      origErr.apply(console, args as []);
    };
    return () => { alive = false; console.error = origErr; };
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const fetchSuggestions = useMemo(
    () => async (query: string) => {
      if (!ready || !query || query.length < 3) {
        setSuggestions([]);
        return;
      }
      try {
        const g: any = (window as any).google;
        const placesLib = await g.maps.importLibrary("places");
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
        }
        const { suggestions: sug } = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query,
          sessionToken: sessionTokenRef.current,
          includedRegionCodes: countries,
        });
        const rows = (sug ?? [])
          .map((s: any) => s.placePrediction)
          .filter(Boolean)
          .slice(0, 6)
          .map((p: any) => ({
            placeId: p.placeId,
            text: p.mainText?.text ?? p.text?.text ?? "",
            secondary: p.secondaryText?.text ?? "",
          }));
        setSuggestions(rows);
        setHighlight(0);
      } catch (err) {
        console.error("autocomplete_fetch_failed", err);
        setSuggestions([]);
      }
    },
    [ready, countries.join(",")],
  );

  useEffect(() => {
    if (suppressNextFetchRef.current) {
      suppressNextFetchRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 220);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value, fetchSuggestions]);

  async function pick(placeId: string) {
    try {
      const g: any = (window as any).google;
      const placesLib = await g.maps.importLibrary("places");
      const place = new placesLib.Place({ id: placeId });
      await place.fetchFields({
        fields: ["addressComponents", "formattedAddress", "location"],
      });
      const comps = (place.addressComponents ?? []).map((c: any) => ({
        long_name: c.longText,
        short_name: c.shortText,
        types: c.types,
      }));
      const streetNumber = componentValue(comps, "street_number");
      const route = componentValue(comps, "route");
      const streetAddress = [streetNumber, route].filter(Boolean).join(" ").trim();
      const city =
        componentValue(comps, "locality") ||
        componentValue(comps, "sublocality") ||
        componentValue(comps, "postal_town") ||
        componentValue(comps, "administrative_area_level_3");
      const state = componentValue(comps, "administrative_area_level_1", true);
      const zip = componentValue(comps, "postal_code");
      const county = componentValue(comps, "administrative_area_level_2");
      const country = componentValue(comps, "country", true);
      const loc = place.location;
      const lat = typeof loc?.lat === "function" ? loc.lat() : (loc?.lat ?? null);
      const lng = typeof loc?.lng === "function" ? loc.lng() : (loc?.lng ?? null);
      const fullAddress = place.formattedAddress ?? "";
      const address = streetAddress || fullAddress.split(",")[0] || "";
      const selection: AddressSelection = {
        address,
        fullAddress,
        city,
        state,
        zip,
        county,
        country,
        lat,
        lng,
        placeId,
      };
      suppressNextFetchRef.current = true;
      onChange(address);
      onSelect(selection);
      setSuggestions([]);
      setOpen(false);
      sessionTokenRef.current = null;
    } catch (err) {
      console.error("autocomplete_pick_failed", err);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const s = suggestions[highlight]; if (s) pick(s.placeId); }
    else if (e.key === "Escape") { setOpen(false); }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={ready ? placeholder : "Enter address…"}
        className={className}
        disabled={disabled}
        required={required}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-30 left-0 right-0 mt-1 bg-popover border border-border rounded-sm shadow-lg overflow-hidden max-h-80 overflow-y-auto"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.placeId}
              role="option"
              aria-selected={i === highlight}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(s.placeId); }}
              className={`px-3 py-2 text-sm cursor-pointer ${
                i === highlight ? "bg-secondary text-secondary-foreground" : "bg-popover text-foreground"
              }`}
            >
              <div className="font-semibold truncate">{s.text}</div>
              {s.secondary && <div className="text-xs text-muted-foreground truncate">{s.secondary}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
