import { PublicPage } from "./PublicPage";
import { PageHero } from "./page-kit";

export type LegalSection = { id: string; h: string; body: React.ReactNode };

/** Readable policy layout: blue hero, sticky contents list, one reading column. */
export function LegalPage({ crumb, title, intro, dateLabel, date, sections }: { crumb: string; title: string; intro: React.ReactNode; dateLabel: string; date: string; sections: LegalSection[] }) {
  return (
    <PublicPage>
      <PageHero crumb={crumb} eyebrow="MY FLORIDA NEMT" title={title} intro={<><p>{intro}</p><p className="ds-label !text-ds-accent">{dateLabel}: {date}</p></>} />
      <div className="mfn-section bg-ds-bg">
        <div className="mfn-container grid gap-10 lg:grid-cols-[18rem_1fr] lg:gap-16">
          <nav aria-label="On this page" className="lg:sticky lg:top-28 lg:self-start">
            <h2 className="ds-label uppercase tracking-[0.08em] text-ds-accent-active">On this page</h2>
            <ol className="mt-3 space-y-2">
              {sections.map((s) => (
                <li key={s.id}><a href={`#${s.id}`} className="ds-body rounded-ds-sm text-ds-link hover:text-ds-link-hover hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus">{s.h}</a></li>
              ))}
            </ol>
          </nav>
          <div className="max-w-[46rem]">
            {sections.map((s) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-28 border-b border-ds-border py-8 first:pt-0 last:border-0">
                <h2 id={`${s.id}-h`} className="ds-section-title uppercase text-ds-primary">{s.h}</h2>
                <div className="ds-body-lg mt-3 space-y-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6">{s.body}</div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </PublicPage>
  );
}
