import { createFileRoute } from "@tanstack/react-router";
import { BedDouble } from "lucide-react";
import { ServiceLayout } from "./services.ambulatory";

const TITLE = "Stretcher & Gurney Transportation in Florida | My Florida NEMT";
const DESCRIPTION =
  "Non-emergency stretcher and gurney transportation across Florida. Safe, comfortable bed-to-bed transport for hospital discharges, dialysis, and rehab — 24/7 dispatch, insurance-friendly.";
const URL = "https://myfloridanemt.com/services/stretcher";

export const Route = createFileRoute("/services/stretcher")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          serviceType: "Stretcher & Gurney Non-Emergency Medical Transportation",
          provider: {
            "@type": "Organization",
            name: "My Florida NEMT",
            url: "https://myfloridanemt.com",
          },
          areaServed: { "@type": "State", name: "Florida" },
          description: DESCRIPTION,
        }),
      },
    ],
  }),
  component: StretcherPage,
});

function StretcherPage() {
  return (
    <ServiceLayout
      eyebrow="Bed-to-bed · Non-emergency"
      title="Stretcher & Gurney Transportation"
      lede="Stretcher NEMT is for patients who can't safely sit up during transport. It's the right service for hospital discharges, inter-facility transfers, and rehab admissions — a lower-cost, more flexible alternative to an ambulance when the patient is stable but bed-confined."
      icon={<BedDouble size={28} />}
      bullets={[
        "Trained two-person crews for safe lift-and-transfer at both ends",
        "More affordable and flexibly scheduled than ambulance service",
        "Covered by most Medicaid, MCO, and private insurance plans",
        "24/7 dispatch — same-day discharge, standing recurring transports",
      ]}
      useCases={[
        { h: "Hospital discharge", p: "Bed-to-bed transport home or to a skilled nursing facility." },
        { h: "Inter-facility transfer", p: "Between hospitals, rehab centers, and long-term care." },
        { h: "Dialysis for bed-bound patients", p: "Recurring stretcher transports on a standing schedule." },
        { h: "Wound care & specialty visits", p: "For patients who can't tolerate sitting upright." },
      ]}
    />
  );
}
