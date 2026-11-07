import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { TripInvoice } from './trip-invoice-rules';

/** Safe document projection only; never accepts private notes or Network economics. */
export async function renderTripInvoicePdf(invoice: TripInvoice) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  let page = document.addPage([612, 792]); let y = 740;
  const safe = (value: string) => value.replace(/[^\x20-\x7E]/g, ' ');
  function text(value: string, emphasis = false, size = 11) {
    const words = safe(value).split(/\s+/); let line = '';
    for (const word of words) { if ((line + word).length > 85) { draw(line); line = ''; } line += word + ' '; } if (line) draw(line);
    function draw(s: string) { if (y < 65) { page = document.addPage([612, 792]); y = 740; } page.drawText(s.trim(), { x: 48, y, size, font: emphasis ? bold : regular, color: rgb(0.075, 0.2, 0.35) }); y -= size + 9; }
  }
  const money = (c: number) => (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  text('MY FLORIDA NEMT', true, 18); text('INVOICE ' + invoice.mfnId, true, 14);
  text('Provider: ' + invoice.providerName); if (invoice.providerPhone) text('Business contact: ' + invoice.providerPhone);
  text('Bill to: ' + invoice.billTo); text('Trip/request: ' + invoice.requestNumber);
  text('Quote version: ' + invoice.quoteVersion + ' | Status: ' + invoice.status); text('Issued: ' + invoice.createdAt.slice(0, 10) + ' | Due: ' + (invoice.dueAt?.slice(0, 10) ?? 'Not provided'));
  y -= 12;
  for (const line of invoice.lines) { text(line.label + (line.quantity != null ? ' | Qty ' + line.quantity : '') + (line.rateCents != null ? ' @ ' + money(line.rateCents) : '') + ' | ' + money(line.cents)); if (line.reason) text('Reason: ' + line.reason); }
  y -= 12; text('TOTAL: ' + money(invoice.totalCents), true, 14); text('Amount paid: ' + money(invoice.paidCents)); text('Balance due: ' + money(invoice.balanceCents), true);
  if (invoice.terms) { y -= 15; text('Provider terms', true); text(invoice.terms); }
  text('Transportation is provided by the independent provider. Invoice payment does not itself confirm transportation.');
  return document.save();
}