import { createFileRoute } from "@tanstack/react-router";
import { Accessibility } from "lucide-react";
import { ServiceLayout } from "./ambulatory";

const TITLE = "Wheelchair Transportation Services in Florida | NEMT Wheelchair Rides";
const DESCRIPTION =
  "Professional wheelchair transportation services across Florida for passengers who require wheelchair assistance. Our NEMT network connects patients with trained providers offering safe, comfortable, and dependable medical transportation.";
const URL = "https://myfloridanemt.com/services/wheelchair";

export const Route = createFileRoute("/services/wheelchair")({
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
          serviceType: "Wheelchair Non-Emergency Medical Transportation",
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
  component: WheelchairPage,
});

function WheelchairPage() {
  return (
    <ServiceLayout
      eyebrow="ADA-compliant · Lift-equipped"
      title="Wheelchair Transportation"
      lede="Wheelchair transportation provides safe non-emergency medical transportation for passengers who remain in their wheelchair during travel. Florida NEMT providers offer secure wheelchair transport for medical appointments, healthcare facilities, therapy visits, and other essential destinations while prioritizing passenger safety and comfort."
      icon={<Accessibility size={28} />}
      bullets={[
        "Passengers stay seated in their own wheelchair for the entire ride",
        "ADA-compliant vehicles with hydraulic lifts, ramps, and 4-point tie-downs",
        "Trained providers focused on passenger safety, comfort, and dignity",
        "Dependable rides to medical appointments, therapy, dialysis, and healthcare facilities",
      ]}
      useCases={[
        { h: "Manual & power chairs", p: "Hydraulic lifts and low-floor ramps for every chair type." },
        { h: "Bariatric wheelchair", p: "Heavy-duty lifts and reinforced tie-downs up to 800 lbs." },
        { h: "Dialysis transport", p: "Standing recurring schedules so the chair moves with the patient." },
        { h: "Skilled nursing transfers", p: "Facility-to-facility moves and appointment shuttles." },
      ]}
    />
  );
}

