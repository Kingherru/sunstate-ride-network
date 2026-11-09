import { useEffect, useRef } from 'react';
import { useRouter, useRouterState } from '@tanstack/react-router';
import type { LucideIcon } from 'lucide-react';
import { DsButton } from '@/components/ds/controls';
import { tabIcon } from './tab-icons';

/** One controlled navigation surface; URL state is UI-only, never record data. */
export function SegTabs<T extends string>({ label, value, onChange, options, variant = 'horizontal', queryKey }: {
  label: string; value: T; onChange: (v: T) => void;
  options: { value: T; label: string; icon?: LucideIcon; badge?: React.ReactNode }[];
  variant?: 'horizontal' | 'rail'; queryKey?: string;
}) {
  const router = useRouter();
  const searchStr = useRouterState({ select: s => s.location.searchStr });
  const key = queryKey ?? `tabs-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const initial = useRef(value);
  const refs = useRef(new Map<T, HTMLButtonElement>());
  const selected = new URLSearchParams(searchStr).get(key);
  const valid = options.find(o => o.value === selected)?.value;
  useEffect(() => {
    const next = valid ?? initial.current;
    if (options.some(o => o.value === next) && next !== value) onChange(next);
  }, [searchStr, valid]); // URL/back/forward owns restoration; controlled updates remain immediate.
  function choose(next: T) {
    onChange(next);
    const params = Object.fromEntries(new URLSearchParams(searchStr));
    void router.navigate({ search: { ...params, [key]: next }, resetScroll: false });
  }
  return <div role="tablist" aria-label={label} className={`portal-tabs portal-tabs-${variant}`}>
    {options.map(o => {
      const Icon = o.icon ?? tabIcon(o.label);
      return <DsButton ref={node => { if (node) refs.current.set(o.value, node); else refs.current.delete(o.value); }} key={o.value}
        type="button" role="tab" aria-selected={value === o.value} tabIndex={value === o.value ? 0 : -1}
        variant={value === o.value ? 'secondary' : 'ghost'} className="portal-tab" onClick={() => choose(o.value)}
        onKeyDown={e => {
          const index = options.findIndex(item => item.value === o.value);
          let target = index;
          if (e.key === 'Home') target = 0;
          else if (e.key === 'End') target = options.length - 1;
          else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') target = (index + 1) % options.length;
          else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') target = (index - 1 + options.length) % options.length;
          else return;
          e.preventDefault(); const item = options[target]; if (!item) return;
          choose(item.value); refs.current.get(item.value)?.focus(); refs.current.get(item.value)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }}><Icon className="size-4 shrink-0" aria-hidden /><span className="whitespace-nowrap">{o.label}</span>{o.badge != null && <span className="portal-tab-badge">{o.badge}</span>}</DsButton>;
    })}
  </div>;
}
