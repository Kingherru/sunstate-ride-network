import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/public/LegalPage";
import { pageHead } from "@/components/public/page-kit";
import { PUBLIC_EMAIL } from "@/lib/site-config";

const DESC = "The terms for using MY FLORIDA NEMT: planned non-emergency transportation requests, the provider network, membership fees and training purchases.";

export const Route = createFileRoute("/terms")({
  head: () => pageHead("/terms", "Terms of Use | MY FLORIDA NEMT", DESC, "Terms of Use"),
  component: () => (
    <LegalPage
      crumb="Terms of Use"
      title="Terms of Use"
      intro="These terms explain how the MY FLORIDA NEMT website and network may be used. Please read them before creating an account or requesting a trip."
      dateLabel="Last updated"
      date="October 1, 2026"
      sections={[
        { id: "acceptance", h: "Acceptance of the terms", body: <p>By using the website, creating an account or submitting a request, you agree to these terms. If you do not agree, please do not use the service.</p> },
        { id: "eligibility", h: "Eligibility and accounts", body: <p>You must be at least 18 years old, or acting with the authority of a parent, guardian or organization, to create an account. You are responsible for keeping your sign-in details secure and for activity under your account.</p> },
        { id: "non-emergency", h: "Planned non-emergency transportation only", body: <p>MY FLORIDA NEMT is for planned, non-emergency transportation. It is not an emergency service. <strong>For a medical emergency, call 911.</strong></p> },
        { id: "role", h: "Our platform and network role", body: <p>MY FLORIDA NEMT is a network and technology platform. It helps customers and facilities request planned transportation, and helps providers connect with one another. MY FLORIDA NEMT does not directly operate every trip shown through the network.</p> },
        { id: "requesters", h: "Customer and facility responsibilities", body: <p>Customers and facility users agree to provide accurate trip information, have authority to share any passenger information they submit, and keep authorized-user access up to date.</p> },
        { id: "providers", h: "Provider responsibilities and independence", body: <p>Participating transportation providers are independent businesses. Each provider is responsible for its own licensing, insurance, vehicles, drivers, safety and legal compliance, and makes its own decisions about which trips to accept.</p> },
        { id: "accuracy", h: "Trip-request information", body: <p>Trip requests must be accurate and complete, including pickup, destination, timing and mobility needs. Inaccurate information may cause a provider to decline or be unable to complete a trip.</p> },
        { id: "availability", h: "Availability and no guarantee of acceptance", body: <p>Submitting a request does not guarantee that a provider will accept it. Availability depends on location, timing, equipment needs and participating providers.</p> },
        { id: "prices", h: "Prices, payments and provider terms", body: <p>Trip-specific pricing, payment timing and cancellation terms may vary by provider and trip. They should be presented to you before a booking is confirmed.</p> },
        { id: "membership", h: "Provider membership and platform fees", body: <ul>
          <li>Provider membership currently includes 30 days free, then $10 per month.</li>
          <li>A 2% platform fee applies to completed trips received through the provider network.</li>
          <li>Payment-processing fees may apply.</li>
        </ul> },
        { id: "training", h: "Training purchases and course access", body: <p>Training classes are purchased separately from membership. Purchasing a class gives you access to that course for your own use. Course materials may not be shared or resold.</p> },
        { id: "acceptable-use", h: "Acceptable use", body: <p>You agree not to misuse the platform, including by submitting false requests, accessing accounts that are not yours, interfering with the service, or using it for unlawful purposes.</p> },
        { id: "ip", h: "Intellectual property", body: <p>The website, its design, text and software belong to MY FLORIDA NEMT or its licensors. You may not copy or reuse them except as these terms allow.</p> },
        { id: "termination", h: "Suspension or termination", body: <p>We may suspend or close accounts that break these terms or put riders, providers or the platform at risk. You may stop using the service at any time.</p> },
        { id: "third-party", h: "Third-party services", body: <p>Some features rely on third-party services, such as payment processing. Those services are governed by their own terms.</p> },
        { id: "disclaimers", h: "Disclaimers", body: <p>The platform is provided “as is” and “as available.” We do not guarantee that the service will be uninterrupted or error-free, or that any trip will be accepted or completed.</p> },
        { id: "liability", h: "Limitation of liability", body: <p>To the extent the law allows, MY FLORIDA NEMT is not liable for indirect, incidental or consequential damages, or for the acts or omissions of independent providers, arising from use of the platform.</p> },
        { id: "law", h: "Governing law", body: <p>These terms are governed by the laws of the State of Florida.</p> },
        { id: "changes", h: "Changes to these terms", body: <p>We may update these terms as the platform changes. We will change the “last updated” date above when we do. Continued use means you accept the updated terms.</p> },
        { id: "contact", h: "Contact us", body: <p>Questions about these terms can be sent to <a className="text-ds-link underline underline-offset-4 hover:text-ds-link-hover" href={`mailto:${PUBLIC_EMAIL}`}>{PUBLIC_EMAIL}</a>.</p> },
      ]}
    />
  ),
});
