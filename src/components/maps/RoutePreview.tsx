import { useEffect, useRef, useState } from "react";

const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const CHANNEL = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

let mapsPromise: Promise<any> | null = null;
const authFailureListeners = new Set<() => void>();

function loadMaps(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if ((window as any).google?.maps) return Promise.resolve((window as any).google);
  if (mapsPromise) return mapsPromise;
  if (!BROWSER_KEY) return Promise.reject(new Error("Google Maps browser key not configured"));
  mapsPromise = new Promise((resolve, reject) => {
    (window as any).__initFLNemtMap = () => resolve((window as any).google);
    // Google calls this global on auth/referrer failures instead of firing script.onerror
    (window as any).gm_authFailure = () => {
      mapsPromise = null;
      authFailureListeners.forEach((fn) => fn());
      reject(new Error("auth_failure"));
    };
    const s = document.createElement("script");
    const channel = CHANNEL ? `&channel=${encodeURIComponent(CHANNEL)}` : "";
    s.src = `https://maps.googleapis.com/maps/api/js?key=${BROWSER_KEY}&loading=async&libraries=geometry&callback=__initFLNemtMap${channel}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => {
      mapsPromise = null;
      reject(new Error("script_error"));
    };
    document.head.appendChild(s);
  });
  return mapsPromise;
}

export type RoutePreviewProps = {
  polyline?: string | null;
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  pickupLabel?: string;
  dropoffLabel?: string;
  height?: number;
  className?: string;
};

export function RoutePreview({
  polyline,
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  pickupLabel = "Pickup",
  dropoffLabel = "Drop-off",
  height = 260,
  className,
}: RoutePreviewProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const hasPoints =
    typeof pickupLat === "number" &&
    typeof pickupLng === "number" &&
    typeof dropoffLat === "number" &&
    typeof dropoffLng === "number";

  useEffect(() => {
    if (!ref.current || !hasPoints) return;
    let disposed = false;
    (async () => {
      try {
        const g = await loadMaps();
        if (disposed || !ref.current) return;
        const map = new g.maps.Map(ref.current, {
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "cooperative",
          center: { lat: (pickupLat! + dropoffLat!) / 2, lng: (pickupLng! + dropoffLng!) / 2 },
          zoom: 10,
        });

        new g.maps.Marker({ position: { lat: pickupLat!, lng: pickupLng! }, map, label: "A", title: pickupLabel });
        new g.maps.Marker({ position: { lat: dropoffLat!, lng: dropoffLng! }, map, label: "B", title: dropoffLabel });

        const bounds = new g.maps.LatLngBounds();
        bounds.extend({ lat: pickupLat!, lng: pickupLng! });
        bounds.extend({ lat: dropoffLat!, lng: dropoffLng! });

        if (polyline && g.maps.geometry?.encoding) {
          const path = g.maps.geometry.encoding.decodePath(polyline);
          new g.maps.Polyline({
            path,
            map,
            strokeColor: "#0b1d3a",
            strokeOpacity: 0.9,
            strokeWeight: 4,
          });
          path.forEach((p: any) => bounds.extend(p));
        } else {
          new g.maps.Polyline({
            path: [
              { lat: pickupLat!, lng: pickupLng! },
              { lat: dropoffLat!, lng: dropoffLng! },
            ],
            map,
            strokeColor: "#0b1d3a",
            strokeOpacity: 0.6,
            strokeWeight: 3,
          });
        }

        map.fitBounds(bounds, 32);
      } catch (e: any) {
        if (!disposed) setErr(e?.message ?? "Map failed to load");
      }
    })();
    return () => {
      disposed = true;
    };
  }, [polyline, pickupLat, pickupLng, dropoffLat, dropoffLng, pickupLabel, dropoffLabel, hasPoints]);

  if (!hasPoints) {
    return (
      <div
        className={`bg-secondary border border-border rounded-sm text-xs text-muted-foreground grid place-items-center ${className ?? ""}`}
        style={{ height }}
      >
        Route preview will appear once the addresses are geocoded.
      </div>
    );
  }

  return (
    <div className={className}>
      <div ref={ref} className="w-full rounded-sm border border-border overflow-hidden" style={{ height }} />
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
    </div>
  );
}

export function googleRouteUrl(
  pickupLat?: number | null,
  pickupLng?: number | null,
  dropoffLat?: number | null,
  dropoffLng?: number | null,
  pickupText?: string | null,
  dropoffText?: string | null,
): string {
  const origin =
    typeof pickupLat === "number" && typeof pickupLng === "number"
      ? `${pickupLat},${pickupLng}`
      : pickupText ?? "";
  const destination =
    typeof dropoffLat === "number" && typeof dropoffLng === "number"
      ? `${dropoffLat},${dropoffLng}`
      : dropoffText ?? "";
  const p = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: "driving",
  });
  return `https://www.google.com/maps/dir/?${p.toString()}`;
}

export function formatMinutes(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "—";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
