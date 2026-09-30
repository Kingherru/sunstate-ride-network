import { Link } from "@tanstack/react-router";
import { PublicPage } from "./PublicPage";
import { PUBLIC_EMAIL, PUBLIC_PHONE, phoneHref } from "@/lib/site-config";
import { btnPrimary } from "@/components/home/sections";

/** Honest temporary destination until the real flow is rebuilt. TODO(booking/provider phase). */
export function TempDestination({ title, intro, subject }: { title: string; intro: string; subject: string }) {
  return (
    <PublicPage>
      <section className="mx-auto max-w-2xl px-4 py-20 sm:px-6 sm:py-28">
        <h1 className="ds-page-title text-ds-primary">{title}</h1>
        <p className="ds-body-lg mt-4 text-ds-text-2">{intro}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href={`mailto:${PUBLIC_EMAIL}?subject=${encodeURIComponent(subject)}`} className={btnPrimary}>Email {PUBLIC_EMAIL}</a>
          {PUBLIC_PHONE && <a href={phoneHref(PUBLIC_PHONE)} className={btnPrimary}>Call {PUBLIC_PHONE}</a>}
        </div>
        <p className="ds-body mt-10"><Link to="/" className="text-ds-link underline underline-offset-4">Back to the homepage</Link></p>
      </section>
    </PublicPage>
  );
}
