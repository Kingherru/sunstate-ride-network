import { createFileRoute } from "@tanstack/react-router";
import { CalendarPlus, Network, UserPlus } from "lucide-react";
import { PublicPage } from "@/components/public/PublicPage";
import { CtaBand, PageHero, Reveal, SectionHead, ldScript, pageHead } from "@/components/public/page-kit";
import { FAQ_ITEMS } from "@/lib/faq";
import { LINKS } from "@/lib/site-config";

const DESC = "Answers about Florida NEMT trip requests, accounts for patients and facilities, and joining the NEMT provider network.";
const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

export const Route = createFileRoute("/frequently-asked-questions")({
  head: () => {
    const h = pageHead("/frequently-asked-questions", "People Also Ask — Florida NEMT Questions | MY FLORIDA NEMT", DESC, "People Also Ask");
    return { ...h, scripts: [...h.scripts, ldScript(faqLd)] };
  },
  component: FaqPage,
});

const GROUPS = Array.from(new Set(FAQ_ITEMS.map((f) => f.group)));

function FaqPage() {
  return (
    <PublicPage>
      <PageHero crumb="People Also Ask" title="People also ask" intro={<p>Clear answers about requesting Florida non-emergency medical transportation and joining the provider network.</p>} />
      {GROUPS.map((g, gi) => (
        <section key={g} aria-labelledby={`faq-${gi}`} className={`mfn-section ${gi % 2 ? "bg-ds-sky" : "bg-ds-bg"}`}>
          <div className="mfn-container mx-auto max-w-3xl">
            <Reveal><SectionHead id={`faq-${gi}`} title={g} /></Reveal>
            <div className="mt-8 divide-y divide-ds-border">
              {FAQ_ITEMS.filter((f) => f.group === g).map((f) => (
                <div key={f.q} className="py-5">
                  <h3 className="ds-subheading text-ds-primary">{f.q}</h3>
                  <p className="ds-body-lg mt-2 text-ds-text-2">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}
      <CtaBand
        title="Still deciding?"
        text="Request a trip, create an account or join the provider network."
        actions={[
          { label: "Submit Trip Request", to: LINKS.book, icon: CalendarPlus },
          { label: "Create an Account", to: LINKS.createAccount, icon: UserPlus },
          { label: "Join the Provider Network", to: LINKS.join, icon: Network },
        ]}
      />
    </PublicPage>
  );
}
