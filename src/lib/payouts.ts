// Platform fee charged on every payment we process for providers.
// Update PLATFORM_FEE_PCT in one place; all UI and billing math reads it from here.
export const PLATFORM_FEE_PCT = 0.04;

export function formatUsd(cents: number | null | undefined): string {
  const n = (cents ?? 0) / 100;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function platformFeeCents(grossCents: number): number {
  return Math.round(grossCents * PLATFORM_FEE_PCT);
}

export function providerPayoutCents(grossCents: number): number {
  return grossCents - platformFeeCents(grossCents);
}
