import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/public/LegalPage";
import { pageHead } from "@/components/public/page-kit";
import { PUBLIC_EMAIL } from "@/lib/site-config";

const DESC = "How My Florida NEMT collects, uses and shares information when you request trips, join the provider network, buy training or use the website.";

export const Route = createFileRoute("/privacy")({
  head: () => pageHead("/privacy", "Privacy Policy | My Florida NEMT", DESC, "Privacy Policy"),
  component: () => (
    <LegalPage
      crumb="Privacy Policy"
      title="Privacy Policy"
      intro="This policy explains, in plain language, what information MY FLORIDA NEMT collects, why we use it and who we share it with."
      dateLabel="Last updated"
      date="October 1, 2026"
      sections={[
        { id: "collect", h: "Information we collect", body: <>
          <p>We collect only the information needed to run the website and network features you use:</p>
          <ul>
            <li>Account and contact information, such as name, email address and phone number.</li>
            <li>Customer, passenger, payer and authorized-contact information entered for a trip.</li>
            <li>Pickup and destination addresses, trip dates and times, and transportation requirements.</li>
            <li>Mobility and accessibility information you choose to provide for a trip.</li>
            <li>Facility-account and authorized-user information.</li>
            <li>Provider business profiles, service areas, vehicles and operating information.</li>
            <li>Training purchases, course progress and certificate information.</li>
            <li>Payment transaction information, which is handled through our payment processor.</li>
            <li>Technical, device, usage and security information, such as browser type and sign-in activity.</li>
            <li>Messages and support requests you send us.</li>
          </ul>
        </> },
        { id: "use", h: "How we use information", body: <ul>
          <li>To operate accounts and platform features.</li>
          <li>To process trip requests and connect requesters with participating providers.</li>
          <li>To process payments.</li>
          <li>To support training purchases and course access.</li>
          <li>To communicate with you about accounts, trips and services.</li>
          <li>To protect the platform and prevent misuse.</li>
          <li>To meet legal obligations.</li>
        </ul> },
        { id: "share", h: "How we share information", body: <>
          <p>We share information only as needed to provide the service:</p>
          <ul>
            <li>With participating transportation providers who need it to review or perform a requested trip.</li>
            <li>With authorized users of a facility account.</li>
            <li>With payment processors that handle transactions.</li>
            <li>With hosting, database, authentication, communication and other technical-service providers that help run the platform.</li>
            <li>With legal authorities when the law requires it.</li>
             <li>As part of a business transfer if the ownership or operation of MY FLORIDA NEMT changes.</li>
          </ul>
        </> },
        { id: "retention", h: "How long we keep information", body: <p>We keep information for as long as it is needed to provide the service, maintain trip, payment and training records, resolve disputes and meet legal obligations. When it is no longer needed, we delete or de-identify it.</p> },
        { id: "security", h: "Security", body: <p>We use reasonable administrative and technical safeguards, such as encrypted connections and access controls, to protect information. No online service can guarantee absolute security.</p> },
        { id: "choices", h: "Your choices", body: <p>You can review and update account information when you are signed in, or contact us to ask for a correction. You may also ask us to close your account, subject to records we must keep.</p> },
        { id: "storage", h: "Cookies and local storage", body: <p>The website uses your browser’s local storage to keep you signed in and remember basic session settings. Our payment processor may set its own cookies during checkout to process payments and prevent fraud.</p> },
        { id: "children", h: "Children’s privacy", body: <p>The website is not directed to children under 13, and we do not knowingly collect their personal information directly from them. A parent, guardian or authorized contact may provide a minor’s information when arranging that minor’s trip.</p> },
        { id: "changes", h: "Changes to this policy", body: <p>We may update this policy as the platform changes. We will change the “last updated” date above when we do.</p> },
        { id: "contact", h: "Contact us", body: <p>Questions about this policy can be sent to <a className="text-ds-link underline underline-offset-4 hover:text-ds-link-hover" href={`mailto:${PUBLIC_EMAIL}`}>{PUBLIC_EMAIL}</a>.</p> },
      ]}
    />
  ),
});
