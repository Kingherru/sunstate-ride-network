import { useEffect } from 'react';
import { PORTAL_FORM_SELECTOR, increasedPadding } from './form-spacing-rules';

/** Preserve each field's authored/density/icon padding before adding the same delta. */
export function PortalFormSpacing() {
  useEffect(() => {
    let frame = 0;
    const controls = new Set<HTMLElement>();
    function measure() {
      frame = 0;
      document.querySelectorAll<HTMLElement>(PORTAL_FORM_SELECTOR).forEach(field => {
        if (!field.closest('.theme-portal')) return;
        field.removeAttribute('data-portal-form-spacing');
        const css = getComputedStyle(field);
        const padding = [css.paddingTop, css.paddingRight, css.paddingBottom, css.paddingLeft];
        // Reserve authored overlay icons/buttons before adding the existing +1px delta.
        const parent = field.parentElement;
        if (parent && field.matches('input')) {
          const rect = field.getBoundingClientRect();
          for (const sibling of Array.from(parent.children)) {
            if (!(sibling instanceof HTMLElement || sibling instanceof SVGElement) || sibling === field || !sibling.matches('svg,button,span')) continue;
            if (getComputedStyle(sibling).position !== 'absolute') continue;
            const icon = sibling.getBoundingClientRect();
            if (!icon.width || icon.bottom <= rect.top || icon.top >= rect.bottom) continue;
            if (icon.left >= rect.left && icon.right <= rect.left + rect.width / 2) padding[3] = `${Math.max(parseFloat(padding[3]), icon.right - rect.left + 12)}px`;
            else if (icon.right <= rect.right && icon.left >= rect.left + rect.width / 2) padding[1] = `${Math.max(parseFloat(padding[1]), rect.right - icon.left + 12)}px`;
          }
        }
        padding.forEach((value, index) => {
          const property = `--portal-field-padding-${index}`;
          const next = `${increasedPadding(value)}px`;
          if (field.style.getPropertyValue(property) !== next) field.style.setProperty(property, next);
        });
        field.setAttribute('data-portal-form-spacing', 'true');
        controls.add(field);
      });
      for (const field of controls) if (!field.isConnected) controls.delete(field);
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(measure); }
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-density', 'data-portal-density', 'data-portal-contrast'] });
    window.addEventListener('resize', schedule);
    measure();
    return () => {
      observer.disconnect(); window.removeEventListener('resize', schedule); cancelAnimationFrame(frame);
      controls.forEach(field => { field.removeAttribute('data-portal-form-spacing'); });
    };
  }, []);
  return null;
}