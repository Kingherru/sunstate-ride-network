# Pass 4M — exact activation blockers

No Stripe objects were created or inspected through Stripe in this pass. Existing lookup keys were preserved; existence and exact sandbox Stripe product/price IDs remain unverified, not declared missing.

## Owner decisions for Pass 4L
- Product-specific base/add-on/course/test/guide refund eligibility and cancellation rules.
- Provider customer-invoice charge model (direct, destination, or separate charges/transfers), merchant and fee responsibility.
- Legally approved processing-recovery and tax treatment for each payment purpose/payment method. No assumed processing fee or tax exemption.
- Authoritative Stripe billing timing for trial subscriptions combined with one-time purchases, later add-on proration and protected price effective-through enrollment.

## Secure configuration
- `STRIPE_CONNECT_SANDBOX_WEBHOOK_SECRET`: confirm presence and configure through the secure secret form only, never chat. No secret was changed here.
- Verify existing sandbox lookup keys: `nemt_provider_base_monthly` ($20/month), `nemt_network_addon_monthly` ($10/month), `course_hipaa_v2` ($50), `course_nemt_v2` ($50), `nemt_startup_guide_50` ($50). Preserve current internal catalog IDs.
- If a key truly has no sandbox product/price, request approval identifying that precise object and amount before creating it. Never create a variant ID or alter live mode.

## Unfinished foundations (remain OFF)
- Durable versioned Stripe mapping enrollment, full cart acceptance/idempotency reservation and future session creation binding.
- Workspace Connect uniqueness/storage refactor, future account/link creation contract and fully persisted capability evidence.
- Fully linked platform/referral event application, reversal/dispute freeze producers, transactional accounting append/reverse RPC, pre-execution funded-offer enforcement and server release computation.
- Populated authenticated combined-cart/invoice/referral readback and entitlement integration. Pure tests do not establish these flows.

This pass introduces read-only review and conservative preparation boundaries, not complete financial activation or a populated money ledger. Pass 4L remains next; 4O and 4P are not begun.