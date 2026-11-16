export const PORTAL_FORM_SELECTOR = 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="hidden"]):not([type="color"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]),select,textarea,button[role="combobox"],input[role="combobox"]';
export const FORM_PADDING_INCREMENT = 1;
export function increasedPadding(value: string) {
  return (Number.parseFloat(value) || 0) + FORM_PADDING_INCREMENT;
}