import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { COMPACT_TEXT_SELECTOR, isMultilineText, isTextClipped } from './overflow-text-rules';

/** Explicit opt-in for compact strings; legacy targets use the same controller. */
export function OverflowText({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span data-overflow-text className={`portal-overflow-text ${className}`}>{children}</span>;
}

type Disclosure = { node: HTMLElement; text: string; x: number; y: number; parent: HTMLElement };
/** Presentation-only: preserves DOM children, event handlers and control semantics. */
export function PortalOverflowTooltips() {
  const id = useId();
  const [shown, setShown] = useState<Disclosure | null>(null);
  useEffect(() => {
    const tracked = new Map<HTMLElement, { tab: string | null; addedTab: boolean }>();
    let frame = 0;
    let active: HTMLElement | null = null;
    let described: HTMLElement | null = null;
    let previousDescription: string | null = null;
    const text = (node: HTMLElement) => node instanceof HTMLSelectElement ? node.selectedOptions[0]?.textContent?.trim() ?? '' : node.textContent?.trim() ?? '';
    const control = (node: HTMLElement) => node.closest<HTMLElement>('button:not(:disabled),a[href],select:not(:disabled),input:not(:disabled),summary,[role="tab"],[role="button"]') ?? node;
    const restoreDescription = () => {
      if (described) {
        if (previousDescription === null) described.removeAttribute('aria-describedby');
        else described.setAttribute('aria-describedby', previousDescription);
      }
      described = null;
    };
    const close = () => { active = null; restoreDescription(); setShown(null); };
    const show = (node: HTMLElement) => {
      if (node.dataset.overflowClipped !== 'true') return;
      restoreDescription(); active = node;
      described = control(node); previousDescription = described.getAttribute('aria-describedby');
      described.setAttribute('aria-describedby', [previousDescription, id].filter(Boolean).join(' '));
      const r = node.getBoundingClientRect();
      setShown({ node, text: text(node), x: Math.max(8, Math.min(r.left, innerWidth - Math.min(360, innerWidth - 16) - 8)), y: Math.max(8, Math.min(r.bottom + 6, innerHeight - 110)), parent: node.closest<HTMLElement>('[role="dialog"]') ?? document.body });
    };
    const resize = new ResizeObserver(() => schedule());
    const scan = () => {
      frame = 0;
      for (const [node, state] of tracked) if (!node.isConnected) { resize.unobserve(node); tracked.delete(node); if (active === node) close(); }
      document.querySelectorAll<HTMLElement>('.theme-portal').forEach(root => root.querySelectorAll<HTMLElement>(COMPACT_TEXT_SELECTOR).forEach(node => {
        if (node.closest('[data-overflow-tooltip], [data-text-wrap], textarea, [role="alert"], .sr-only') || node.matches('input,textarea') || !text(node)) return;
        // Preserve dedicated address/instructions cells and prose-styled labels.
        const fieldLabel = node.tagName === 'DD' ? node.previousElementSibling?.textContent ?? node.parentElement?.querySelector('dt')?.textContent ?? '' : '';
        if (isMultilineText(fieldLabel) || node.matches('p.ds-label') && (isMultilineText(text(node)) || node.hasAttribute('role'))) return;
        // Never clip containers holding other controls or multiline content.
        if (node.querySelector('input,textarea,select,button,a[href],p,ul,ol,dl') || node.querySelector('[data-overflow-text]') && !node.hasAttribute('data-overflow-text')) return;
        node.classList.add('portal-overflow-text');
        if (!tracked.has(node)) { tracked.set(node, {tab: node.getAttribute('tabindex'), addedTab: false}); resize.observe(node); }
      }));
      for (const [node, state] of tracked) {
        let clipped = isTextClipped(node.scrollWidth, node.clientWidth);
        if (node instanceof HTMLSelectElement && node.clientWidth) {
          const style = getComputedStyle(node); const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
          if (ctx) { ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`; clipped = ctx.measureText(text(node)).width > node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight); }
        }
        node.dataset.overflowClipped = String(clipped);
        if (clipped && control(node) === node && !node.matches('button:not(:disabled),a[href],select:not(:disabled),[tabindex]')) { node.tabIndex = 0; state.addedTab = true; }
        else if (!clipped && state.addedTab) { if (state.tab === null) node.removeAttribute('tabindex'); else node.setAttribute('tabindex',state.tab); state.addedTab = false; }
        if (active === node) { if (clipped) show(node); else close(); }
      }
    };
    function schedule() { if (!frame) frame = requestAnimationFrame(scan); }
    const target = (event: Event) => {
      if (!(event.target instanceof Element)) return null;
      const closest = event.target.closest<HTMLElement>('[data-overflow-clipped="true"]');
      if (closest) return closest;
      return event.target.closest('button,a[href],[role="tab"]')?.querySelector<HTMLElement>('[data-overflow-clipped="true"]') ?? null;
    };
    const enter = (event: Event) => { const node = target(event); if (node) show(node); };
    const leave = (event: Event) => {
      const related = (event as MouseEvent | FocusEvent).relatedTarget;
      if (active && related instanceof Node && control(active).contains(related)) return;
      if (event.type === 'mouseout' && active && control(active).contains(document.activeElement)) return;
      close();
    };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    const observer = new MutationObserver(mutations => { if (mutations.some(m => !(m.target instanceof Element && m.target.closest('[data-overflow-tooltip]')))) schedule(); });
    observer.observe(document.body, {childList:true,subtree:true,characterData:true});
    document.addEventListener('mouseover',enter); document.addEventListener('focusin',enter);
    document.addEventListener('mouseout',leave); document.addEventListener('focusout',leave);
    document.addEventListener('change',schedule); document.addEventListener('keydown',key);
    window.addEventListener('resize',schedule); window.addEventListener('scroll',close,true);
    document.fonts.ready.then(schedule); schedule();
    return () => {
      observer.disconnect(); resize.disconnect(); cancelAnimationFrame(frame); restoreDescription();
      document.removeEventListener('mouseover',enter); document.removeEventListener('focusin',enter); document.removeEventListener('mouseout',leave); document.removeEventListener('focusout',leave); document.removeEventListener('change',schedule); document.removeEventListener('keydown',key); window.removeEventListener('resize',schedule); window.removeEventListener('scroll',close,true);
      for (const [node,state] of tracked) { node.classList.remove('portal-overflow-text'); delete node.dataset.overflowClipped; if (state.addedTab) { if (state.tab === null) node.removeAttribute('tabindex'); else node.setAttribute('tabindex',state.tab); } }
    };
  }, [id]);
  return shown ? createPortal(<div id={id} role="tooltip" data-overflow-tooltip className="portal-overflow-tooltip" style={{left:shown.x,top:shown.y}}>{shown.text}</div>, shown.parent) : null;
}