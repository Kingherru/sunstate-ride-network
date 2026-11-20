/** Existing invoices default visible; only explicit provider false hides customer copies. */
export function linkedInvoiceVisible(value: boolean | null | undefined): boolean {
  return value !== false;
}