import { createFileRoute } from "@tanstack/react-router";
import { Accessibility } from "lucide-react";
import { ServiceLayout } from "./services.ambulatory";

const TITLE = "Wheelchair Transportation in Florida | My Florida NEMT";
const DESCRIPTION =
  "ADA-compliant wheelchair transportation across Florida. Hydraulic lifts, secured tie-downs, and certified drivers for safe manual & power chair transport, including bariatric and dialysis rides.";
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
      lede="Wheelchair NEMT is a vital service for patients with mobility limitations. Our lift- and ramp-equipped vans, certified drivers, and 4-point tie-down systems make sure every rider — manual chair, power chair, or bariatric — gets to their appointment safely and with dignity."
      icon={<Accessibility size={28} />}
      bullets={[
        "Independence — get to appointments without relying on family or friends",
        "Increased mobility for work, school, dialysis, and social outings",
        "Improved quality of life through consistent access to care",
        "ADA-compliant vehicles with 4-point tie-downs and trained attendants",
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
