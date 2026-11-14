import { useEffect, useRef, useState } from 'react';
import { useRouter, useRouterState } from '@tanstack/react-router';
import type { LucideIcon } from 'lucide-react';
import { DsButton } from '@/components/ds/controls';
import { tabIcon } from './tab-icons';

/** One controlled navigation surface; URL state is UI-only, never record data. */
export function SegTabs<T extends string>({ label, value, onChange, options, variant = 'horizontal', queryKey, aliases }: {
  label: string; value: T; onChange: (v: T) => void;
  options: { value: T; label: string; icon?: LucideIcon; badge?: React.ReactNode }[];
  variant?: 'horizontal' | 'rail'; queryKey?: string; aliases?: Record<string, T>;
}) {
  const router = useRouter();
  const search = useRouterState({ select: s => s.location.search });
  const refs = useRef(new Map<T, HTMLButtonElement>());
  const listRef = useRef<HTMLDivElement>(null);
  const [vertical, setVertical] = useState(false);
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const update = () => setVertical(getComputedStyle(list).flexDirection === 'column');
    const observer = new ResizeObserver(update);
    observer.observe(list);
    update();
    return () => observer.disconnect();
  }, [variant]);
  // URL ownership is opt-in via queryKey; without it the parent owns navigation.
  const selected = queryKey ? (search as Record<string, unknown>)[queryKey] : null;
  const resolved = typeof selected === 'string' ? aliases?.[selected] ?? selected : selected;
  const valid = options.find(o => o.value === resolved)?.value;
  const initialValue = useRef(value);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const restored = valid ?? (selected == null && options.some(o => o.value === initialValue.current) ? initialValue.current : options[0]?.value);
  useEffect(() => {
    if (queryKey && restored && restored !== value) changeRef.current(restored);
  }, [queryKey, restored, value]);
  function choose(next: T) {
    if (queryKey) {
      void router.navigate({ to: '.', search: prev => ({ ...prev, [queryKey]: next }), resetScroll: false });
      return; // the effect above applies the change once the URL updates
    }
    onChange(next);
  }
  return <div ref={listRef} role="tablist" aria-label={label} aria-orientation={vertical ? 'vertical' : 'horizontal'} className={`portal-tabs portal-tabs-${variant}`}>
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
        }}><Icon className="size-4 shrink-0" aria-hidden /><span className="portal-tab-label">{o.label}</span>{o.badge != null && <span className="portal-tab-badge">{o.badge}</span>}</DsButton>;
    })}
  </div>;
}
