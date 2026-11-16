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