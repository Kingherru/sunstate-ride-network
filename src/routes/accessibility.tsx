import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/public/LegalPage";
import { pageHead } from "@/components/public/page-kit";
import { PUBLIC_EMAIL } from "@/lib/site-config";

const DESC = "My Florida NEMT’s commitment to an accessible website, the WCAG 2.2 AA target we design toward and how to report an accessibility problem.";

export const Route = createFileRoute("/accessibility")({
  head: () => pageHead("/accessibility", "Accessibility Statement | My Florida NEMT", DESC, "Accessibility Statement"),
  component: () => (
    <LegalPage
      crumb="Accessibility Statement"
      title="Accessibility Statement"
      intro="We want everyone, including people with disabilities, to be able to use MY FLORIDA NEMT to request transportation, join the network and learn."
      dateLabel="Last reviewed"
      date="October 1, 2026"
      sections={[
        { id: "commitment", h: "Our commitment", body: <p>MY FLORIDA NEMT is committed to making this website usable for people with disabilities. Accessibility is an ongoing effort, and we keep improving it as the platform grows.</p> },
        { id: "standard", h: "Our target", body: <p>We design and develop toward the Web Content Accessibility Guidelines (WCAG) 2.2, Level AA.</p> },
        { id: "measures", h: "What we do", body: <ul>
          <li>Keyboard support for navigation, menus, tabs and map controls.</li>
          <li>A clearly visible focus outline when navigating by keyboard.</li>
          <li>Readable color contrast for text and buttons.</li>
          <li>Meaningful headings and page structure.</li>
          <li>Labels on form fields and accessible names on icon buttons.</li>
          <li>Descriptive alternative text for meaningful images.</li>
          <li>Layouts that adapt to phones, tablets and desktops.</li>
          <li>Reduced motion for people who turn it on in their device settings.</li>
        </ul> },
        { id: "map", h: "Known limitation", body: <p>Counties on the Florida coverage map can be clicked with a mouse or touch. Keyboard and screen-reader users can choose any county, region, city or ZIP code using the menus next to the map instead.</p> },
        { id: "report", h: "Report a problem", body: <>
          <p>If something on the website is hard to use, please email <a className="text-ds-link underline underline-offset-4 hover:text-ds-link-hover" href={`mailto:${PUBLIC_EMAIL}`}>{PUBLIC_EMAIL}</a>. It helps us to know:</p>
          <ul>
            <li>The page or feature involved.</li>
            <li>What happened and what you expected.</li>
            <li>The assistive technology and browser you use, if you are comfortable sharing.</li>
          </ul>
        </> },
      ]}
    />
  ),
});
