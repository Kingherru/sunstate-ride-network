import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Award, Clock, GraduationCap, ShieldCheck } from "lucide-react";
import { PublicPage } from "@/components/public/PublicPage";
import { CtaBand, PageHero, Reveal, SectionHead, ldScript, pageHead, SITE, btnAction } from "@/components/public/page-kit";
import { listPublicCourses } from "@/lib/courses.functions";
import { LINKS } from "@/lib/site-config";

const coursesQO = queryOptions({ queryKey: ["shop", "courses"], queryFn: () => listPublicCourses() });

export const Route = createFileRoute("/training")({
  loader: ({ context }) => context.queryClient.ensureQueryData(coursesQO),
  head: ({ loaderData }) => {
    const h = pageHead("/training", "NEMT Training — HIPAA & Florida Basic NEMT Test | MY FLORIDA NEMT",
      "Online training for Florida NEMT drivers and staff: HIPAA Training for NEMT and the Florida Basic NEMT Test, each with an exam and printable certificate.", "Training");
    const courses = (loaderData ?? []).map((c) => ldScript({ "@context": "https://schema.org", "@type": "Course", name: c.title, description: c.summary ?? c.title,
      url: `${SITE}/shop/${c.slug}`, provider: { "@type": "Organization", name: "MY FLORIDA NEMT", url: `${SITE}/` } }));
    return { ...h, scripts: [...h.scripts, ...courses] };
  },
  component: TrainingPage,
});

function TrainingPage() {
  const { data: courses } = useSuspenseQuery(coursesQO);
  return (
    <PublicPage>
      <PageHero crumb="Training" title="NEMT training" intro={<p>Online courses for NEMT drivers, dispatchers and staff. Complete the lessons, pass the exam and download a printable certificate.</p>} />
      <section aria-labelledby="courses" className="mfn-section bg-ds-bg">
        <div className="mfn-container">
          <Reveal><SectionHead id="courses" title="Two courses" intro="Each course is purchased separately. Creating an account is recommended so your progress and certificate are saved." /></Reveal>
          <ul className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-2">
            {courses.map((c, i) => (
              <li key={c.id}><Reveal delay={i * 80} className="h-full">
                <div className="flex h-full flex-col rounded-ds-lg bg-ds-sky p-7 sm:p-9">
                  <span className="flex size-12 items-center justify-center rounded-ds-sm bg-ds-primary text-ds-on-primary">{i === 0 ? <ShieldCheck className="size-6" aria-hidden /> : <GraduationCap className="size-6" aria-hidden />}</span>
                  <h3 className="ds-section-title mt-5 uppercase text-ds-primary">{c.title}</h3>
                  <p className="ds-body-lg mt-3 flex-1">{c.summary}</p>
                  <div className="ds-body mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-ds-text-2">
                    <span className="inline-flex items-center gap-1.5"><Clock className="size-4" aria-hidden />About {c.duration_min} min</span>
                    <span className="inline-flex items-center gap-1.5"><Award className="size-4" aria-hidden />Printable certificate</span>
                    <span className="ds-subheading text-ds-primary">${(c.price_cents / 100).toFixed(2)}</span>
                  </div>
                  <a href={`/shop/${c.slug}`} className={`${btnAction} mt-6 self-start`}>View course</a>
                </div>
              </Reveal></li>
            ))}
          </ul>
          <p className="ds-body mt-8 text-center text-ds-text-2">Already purchased? <a href="/learn" className="text-ds-link underline underline-offset-4">Go to my courses</a> · Pricing is subject to change.</p>
        </div>
      </section>
      <CtaBand title="Training for your whole team" text="Running an NEMT business? Join the provider network and keep your team's training in one place." actions={[{ label: "Join the Provider Network", to: LINKS.join, icon: GraduationCap }]} />
    </PublicPage>
  );
}
