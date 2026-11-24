import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { estimateTripRouteSegments } from '@/lib/maps.functions';
import { usePortalPreview } from '@/components/portal/preview-data';

type RouteResult = Awaited<ReturnType<typeof estimateTripRouteSegments>>;
/** Keyed results prevent old routes flashing or pricing a newly edited address. */
export function useTripRoute(points: string[] | null, enabled: boolean) {
  const key = JSON.stringify(points);
  const preview = usePortalPreview();
  const read = useServerFn(estimateTripRouteSegments);
  const [result, setResult] = useState<{key: string; data: RouteResult | null} | null>(null);
  useEffect(() => {
    if (!enabled || preview.active || !points) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try { const data = await read({data: {points: JSON.parse(key) as string[]}}); if (!cancelled) setResult({key, data}); }
      catch { if (!cancelled) setResult({key, data: null}); }
    }, 700);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [key, enabled, preview.active, read]);
  const current = result?.key === key ? result : null;
  const status = !enabled || !points ? 'idle' : preview.active ? 'unavailable' : !current ? 'loading' : current.data?.ok ? 'ok' : 'unavailable';
  return {key, status, miles: status === 'ok' ? current?.data?.totalMiles ?? null : null,
    firstSeconds: current?.data?.firstDurationSeconds ?? null, totalSeconds: current?.data?.totalDurationSeconds ?? null} as const;
}