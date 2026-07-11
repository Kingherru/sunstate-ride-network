import { createFileRoute } from "@tanstack/react-router";
import { BedDouble } from "lucide-react";
import { buildServiceSchema } from "@/lib/schema";
import { ServiceLayout } from "./services.ambulatory";

const TITLE = "Gurney and Stretcher Transportation Services in Florida | NEMT";
const DESCRIPTION =
  "Specialized gurney and stretcher transportation services throughout Florida for patients who require additional mobility support. Connect with professional NEMT providers trained to provide safe and dependable medical transportation.";
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
        children: JSON.stringify(
          buildServiceSchema({
            name: "Gurney and Stretcher Transportation Services",
            serviceType: "Stretcher & Gurney Non-Emergency Medical Transportation",
            description: DESCRIPTION,
            url: URL,
          })
        ),
      },
    ],
  }),
  component: StretcherPage,
});

function StretcherPage() {
  return (
    <ServiceLayout
      eyebrow="Bed-to-bed · Non-emergency"
      title="Gurney & Stretcher Transportation"
      lede="Gurney and stretcher transportation provides specialized non-emergency medical transportation for passengers who cannot safely travel in a standard seated position. Florida NEMT providers offer trained assistance and specialized vehicles designed to transport patients safely to medical appointments, facilities, and healthcare services."
      icon={<BedDouble size={28} />}
      bullets={[
        "Specialized vehicles built for safe transport of bed-confined patients",
        "Trained two-person crews for safe lift-and-transfer at both ends",
        "Dependable transport to medical appointments, facilities, and healthcare services",
        "24/7 dispatch — same-day hospital discharge and recurring standing rides",
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

