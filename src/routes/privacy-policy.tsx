import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — My Florida NEMT" },
      {
        name: "description",
        content:
          "How My Florida NEMT collects, uses, protects, and shares information from patients, facilities, and transportation providers.",
      },
      { property: "og:title", content: "Privacy Policy — My Florida NEMT" },
      {
        property: "og:description",
        content:
          "Our commitments around patient PHI, provider data, payment processing with Stripe, and your privacy rights.",
      },
      { property: "og:url", content: "https://myfloridanemt.com/privacy-policy" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://myfloridanemt.com/privacy-policy" }],
  }),
  component: PrivacyPolicyPage,
});

const LAST_UPDATED = "July 27, 2026";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">{title}</h2>
      <div className="space-y-4 text-base leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function PrivacyPolicyPage() {
  return (
    <main className="bg-background">
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-6 py-16 md:py-20">
          <p className="text-xs font-mono uppercase tracking-widest text-primary mb-4">Legal</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
          <p className="mt-6 text-base text-muted-foreground max-w-2xl">
            This page is maintained by My Florida NEMT to explain how we collect, use,
            protect, and share information across our patient, facility, and provider
            portals at myfloridanemt.com. It is written in plain language and updated as
            our platform changes.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-14 md:py-20 space-y-14">
        <nav aria-label="On this page" className="rounded-md border border-border bg-card p-6">
          <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
            On this page
          </h2>
          <ol className="grid sm:grid-cols-2 gap-2 text-sm">
            {[
              ["who-we-are", "1. Who we are"],
              ["information-we-collect", "2. Information we collect"],
              ["how-we-use", "3. How we use information"],
              ["phi-hipaa", "4. Patient health information & HIPAA"],
              ["payments-stripe", "5. Payments & Stripe"],
              ["sharing", "6. How we share information"],
              ["subprocessors", "7. Service providers & subprocessors"],
              ["cookies", "8. Cookies & analytics"],
              ["retention", "9. Data retention & deletion"],
              ["security", "10. Security"],
              ["your-rights", "11. Your rights & choices"],
              ["children", "12. Children's privacy"],
              ["changes", "13. Changes to this policy"],
              ["contact", "14. Contact us"],
            ].map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="text-foreground hover:text-primary">
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <Section id="who-we-are" title="1. Who we are">
          <p>
            My Florida NEMT ("<strong>My Florida NEMT</strong>," "<strong>we</strong>,"
            "<strong>us</strong>") operates a non-emergency medical transportation
            technology platform connecting patients and healthcare facilities with
            approved transportation providers across Florida. This Privacy Policy applies
            to myfloridanemt.com, our patient, facility, provider, dispatch, and admin
            portals, and any related services (collectively, the "<strong>Service</strong>").
          </p>
        </Section>

        <Section id="information-we-collect" title="2. Information we collect">
          <p>We collect information you provide directly and information generated when you use the Service.</p>

          <h3 className="text-lg font-semibold text-foreground mt-4">Account &amp; contact information</h3>
          <p>
            Name, email address, phone number, mailing/service address, business name (for
            facilities and providers), role, and password credentials managed through our
            authentication provider.
          </p>

          <h3 className="text-lg font-semibold text-foreground mt-4">Trip &amp; ride request information</h3>
          <p>
            Pickup and drop-off addresses, appointment dates and times, service level
            (ambulatory, wheelchair, stretcher, medical delivery), mobility needs,
            passenger details, patient email for follow-up communications, notes to the
            driver, recurring schedule preferences, and round-trip return details.
          </p>

          <h3 className="text-lg font-semibold text-foreground mt-4">Provider &amp; driver information</h3>
          <p>
            Business licenses, insurance certificates, vehicle registration and
            inspection records, driver's license and background check documentation,
            training/course completion records, service areas, pricing preferences,
            payout account status, and compliance review notes.
          </p>

          <h3 className="text-lg font-semibold text-foreground mt-4">Payment information</h3>
          <p>
            Payment card details, bank/ACH information for payouts, and billing address
            are collected and processed by Stripe, our payment processor. See
            <a href="#payments-stripe" className="text-primary hover:underline"> Section 5</a>{" "}
            for details. We do not store full card numbers on our servers.
          </p>

          <h3 className="text-lg font-semibold text-foreground mt-4">Messages &amp; support content</h3>
          <p>
            Messages you send through in-app threads, contact forms, feedback
            submissions, and support emails, including attachments you choose to share.
          </p>

          <h3 className="text-lg font-semibold text-foreground mt-4">Usage &amp; device data</h3>
          <p>
            IP address, browser type, device identifiers, pages viewed, referring URLs,
            timestamps, and diagnostic logs used to keep the Service secure and reliable.
          </p>

          <h3 className="text-lg font-semibold text-foreground mt-4">Location information</h3>
          <p>
            Pickup/drop-off addresses and ZIP codes you enter, and — where applicable
            and with your permission — approximate location used to match dispatch
            zones and estimate mileage.
          </p>
        </Section>

        <Section id="how-we-use" title="3. How we use information">
          <ul className="list-disc pl-6 space-y-2">
            <li>Create and manage patient, facility, provider, and staff accounts.</li>
            <li>Schedule, route, dispatch, and complete trips and medical deliveries.</li>
            <li>Generate quotes, calculate fares, process payments, and issue payouts.</li>
            <li>Verify provider credentials, insurance, and Medicaid eligibility.</li>
            <li>Send trip confirmations, invoices, receipts, and status notifications by email and in-app messages.</li>
            <li>Provide customer support and respond to inquiries.</li>
            <li>Protect the Service against fraud, abuse, and unauthorized access.</li>
            <li>Comply with legal, regulatory, and contractual obligations.</li>
            <li>Improve reliability, safety, and user experience.</li>
          </ul>
        </Section>

        <Section id="phi-hipaa" title="4. Patient health information & HIPAA">
          <p>
            My Florida NEMT handles limited protected health information (PHI) — such
            as appointment locations, mobility needs, and Medicaid eligibility data —
            necessary to arrange non-emergency medical transportation. We treat this
            information with the confidentiality standards expected under HIPAA and
            related state laws.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Access to PHI is role-based and restricted through row-level security in our database.</li>
            <li>Providers and facilities acknowledge HIPAA obligations in their portal settings before handling patient data.</li>
            <li>PHI is shared only with the assigned provider, dispatcher, and administrative personnel who need it to complete the trip.</li>
            <li>Audit logs record administrative actions on sensitive records.</li>
          </ul>
          <p>
            If you are a covered entity or business associate and need a Business
            Associate Agreement, contact us at myfloridanemt@gmail.com.
          </p>
        </Section>

        <Section id="payments-stripe" title="5. Payments & Stripe">
          <p>
            Payments and provider payouts are processed by{" "}
            <a
              href="https://stripe.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Stripe, Inc.
            </a>{" "}
            When you pay for a trip, save a payment method, or receive a payout, your
            payment details are collected directly by Stripe and transmitted to Stripe's
            servers over an encrypted connection.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>What Stripe receives:</strong> card or bank account details, billing
              name and address, email, amount, currency, and information needed to detect
              fraud and comply with financial regulations.
            </li>
            <li>
              <strong>What we store:</strong> a Stripe customer ID, a reference to the
              saved payment method (last 4 digits and card brand), payment status,
              invoice/receipt records, payout status, and platform fee amounts tied to
              each trip. We do not store full card numbers, CVCs, or bank credentials.
            </li>
            <li>
              <strong>Provider payouts:</strong> providers who receive payouts complete
              Stripe Connect onboarding. Identity verification and banking information
              provided during that flow are held by Stripe.
            </li>
            <li>
              <strong>Payout timing:</strong> standard trips settle on a 48-hour hold;
              Medicaid trips settle on a Net-15 schedule. Financial records tied to a
              trip are protected against unauthorized edits.
            </li>
            <li>
              <strong>Stripe's own policies:</strong> your interactions with Stripe are
              subject to Stripe's{" "}
              <a
                href="https://stripe.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Privacy Policy
              </a>{" "}
              and{" "}
              <a
                href="https://stripe.com/legal"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Terms of Service
              </a>
              .
            </li>
          </ul>
        </Section>

        <Section id="sharing" title="6. How we share information">
          <p>We share information only as needed to operate the Service:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>With assigned providers and dispatchers</strong> — the trip details
              needed to safely complete a pickup, including passenger name, addresses,
              contact number, and mobility needs.
            </li>
            <li>
              <strong>With facilities</strong> that booked a trip on a patient's behalf —
              status updates and completion records for trips they scheduled.
            </li>
            <li>
              <strong>With service providers and subprocessors</strong> that help us run
              the platform (see Section 7).
            </li>
            <li>
              <strong>With payers, brokers, or Medicaid programs</strong> when required
              to authorize or bill a trip.
            </li>
            <li>
              <strong>For legal reasons</strong> — to comply with subpoenas, court
              orders, or applicable law, or to protect the rights, safety, or property of
              users, the public, or My Florida NEMT.
            </li>
            <li>
              <strong>In a business transfer</strong> — in the event of a merger,
              acquisition, or sale, with notice to affected users.
            </li>
          </ul>
          <p>We do not sell personal information. We do not use PHI for advertising.</p>
        </Section>

        <Section id="subprocessors" title="7. Service providers & subprocessors">
          <p>We use trusted third parties to operate the Service:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Supabase</strong> — hosted database, authentication, and file storage.</li>
            <li><strong>Stripe</strong> — payment processing and provider payouts.</li>
            <li><strong>Resend</strong> — transactional email delivery (confirmations, invoices, receipts).</li>
            <li><strong>Cloudflare</strong> — content delivery, DDoS protection, and edge hosting.</li>
            <li><strong>Google Maps / geocoding services</strong> — address lookup and mileage estimates.</li>
          </ul>
          <p>
            Each subprocessor is bound by contractual obligations to safeguard your
            information and use it only to provide services to us.
          </p>
        </Section>

        <Section id="cookies" title="8. Cookies & analytics">
          <p>
            We use cookies and similar technologies to keep you signed in, remember
            preferences, and measure how the Service is used. You can control cookies
            through your browser settings. Blocking essential cookies may prevent you
            from signing in or completing bookings.
          </p>
        </Section>

        <Section id="retention" title="9. Data retention & deletion">
          <p>
            We retain information for as long as your account is active and as needed to
            provide the Service, meet legal and tax obligations, resolve disputes, and
            enforce our agreements. Trip, payment, and payout records tied to financial
            or regulatory reporting are retained for the periods required by applicable
            law.
          </p>
          <p>
            Unconfirmed reservations that are never approved are automatically removed
            after 60 days. You may request deletion of your account information as
            described in Section 11.
          </p>
        </Section>

        <Section id="security" title="10. Security">
          <p>
            We use encryption in transit (HTTPS/TLS), encrypted storage at rest through
            our hosting provider, role-based access control, row-level security
            policies, restricted admin functions, audit logging, and periodic security
            reviews. No system is perfectly secure — please use a strong, unique
            password and notify us immediately if you suspect unauthorized access to
            your account.
          </p>
        </Section>

        <Section id="your-rights" title="11. Your rights & choices">
          <p>Depending on where you live, you may have rights to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Access the personal information we hold about you.</li>
            <li>Correct inaccurate information.</li>
            <li>Request deletion of your account and associated personal information, subject to legal retention requirements.</li>
            <li>Opt out of non-essential marketing emails (transactional emails required to operate a trip cannot be opted out of while an active booking exists).</li>
            <li>Request a copy of your data in a portable format.</li>
          </ul>
          <p>
            To exercise these rights, email us at myfloridanemt@gmail.com from the
            address on file. We may need to verify your identity before responding.
          </p>
        </Section>

        <Section id="children" title="12. Children's privacy">
          <p>
            The Service is not directed to children under 13, and we do not knowingly
            collect personal information from children under 13 except as needed to
            arrange transportation for a minor patient booked by a parent, guardian, or
            authorized facility. If you believe a child has provided information without
            proper authorization, contact us and we will delete it.
          </p>
        </Section>

        <Section id="changes" title="13. Changes to this policy">
          <p>
            We update this Privacy Policy as our platform evolves. Material changes will
            be posted on this page with a new "Last updated" date and, where
            appropriate, communicated by email or in-app notification.
          </p>
        </Section>

        <Section id="contact" title="14. Contact us">
          <p>
            Questions or concerns about this policy or your information? Reach out
            anytime:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Email: <a href="mailto:myfloridanemt@gmail.com" className="text-primary hover:underline">myfloridanemt@gmail.com</a></li>
            <li>Website: <Link to="/contact" className="text-primary hover:underline">myfloridanemt.com/contact</Link></li>
          </ul>
        </Section>
      </div>
    </main>
  );
}
