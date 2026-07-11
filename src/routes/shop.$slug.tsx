import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getPublicCourse } from "@/lib/courses.functions";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Award, CheckCircle2, Clock, ArrowLeft } from "lucide-react";
import { useEffect } from "react";

const qo = (slug: string) => queryOptions({ queryKey: ["shop", "course", slug], queryFn: () => getPublicCourse({ data: { slug } }) });

export const Route = createFileRoute("/shop/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(qo(params.slug)),
  head: ({ loaderData }) => {
    const c = loaderData?.course;
    return {
      meta: [
        { title: c ? `${c.title} — Training Shop | My Florida NEMT` : "Course — Training Shop" },
        { name: "description", content: c?.summary ?? "NEMT certification training course." },
        { property: "og:title", content: c?.title ?? "Training Course" },
        { property: "og:description", content: c?.summary ?? "" },
      ],
      scripts: c
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Course",
                name: c.title,
                description: c.summary,
                provider: {
                  "@type": "Organization",
                  name: "My Florida NEMT",
                  sameAs: "https://myfloridanemt.com",
                },
                offers: {
                  "@type": "Offer",
                  price: (c.price_cents / 100).toFixed(2),
                  priceCurrency: "USD",
                  category: "Paid",
                },
              }),
            },
          ]
        : [],
    };
  },
  component: CourseDetail,
});

function CourseDetail() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(qo(slug));
  const [checkout, setCheckout] = useState(false);
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [userId, setUserId] = useState<string | undefined>();
  

  useEffect(() => { supabase.auth.getUser().then(({ data }) => { setUserEmail(data.user?.email); setUserId(data.user?.id); }); }, []);

  if (!data) {
    return (
      <main className="flex-1 max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold mb-2">Course not found</h1>
        <Link to="/shop" className="text-primary underline">Back to shop</Link>
      </main>
    );
  }
  const { course, modules, question_count } = data;
  const returnUrl = typeof window !== "undefined"
    ? `${window.location.origin}/shop/return?session_id={CHECKOUT_SESSION_ID}&course=${course.slug}`
    : undefined;

  return (
    <>
      <PaymentTestModeBanner />
      <main className="flex-1 max-w-5xl mx-auto px-4 py-10 w-full">
        <Link to="/shop" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"><ArrowLeft className="w-4 h-4" />Back to shop</Link>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">{course.title}</h1>
            <p className="text-lg text-muted-foreground mb-6">{course.summary}</p>
            <div className="prose prose-sm max-w-none whitespace-pre-line mb-8">{course.description}</div>

            <h2 className="text-xl font-bold mb-3">What you'll learn</h2>
            <ul className="space-y-2 mb-8">
              {modules.map((m) => (
                <li key={m.id} className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" /><span>{m.title}</span></li>
              ))}
            </ul>

            <h2 className="text-xl font-bold mb-3">Exam & Certificate</h2>
            <p className="text-muted-foreground">
              {question_count}-question exam. Passing score {course.passing_score}%. Printable certificate valid for {course.cert_validity_months} months.
            </p>
          </div>

          <aside className="md:col-span-1">
            <div className="border border-border rounded-lg p-6 bg-card sticky top-24">
              <div className="text-3xl font-extrabold mb-1">${(course.price_cents / 100).toFixed(2)}</div>
              <div className="text-sm text-muted-foreground mb-4">One-time purchase</div>
              <div className="space-y-2 text-sm mb-5">
                <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-muted-foreground" />{course.duration_min} minutes</div>
                <div className="flex items-center gap-2"><Award className="w-4 h-4 text-muted-foreground" />{course.cert_validity_months}-month certificate</div>
              </div>
              {!checkout ? (
                <Button className="w-full" onClick={() => setCheckout(true)}>
                  {userId ? "Enroll now" : "Buy now (guest checkout)"}
                </Button>
              ) : null}
              {!userId && (
                <p className="text-xs text-muted-foreground mt-3">
                  Recommended: <Link to="/auth" className="underline">create a free account</Link> so your purchase, progress, and certificate are saved to your profile.
                </p>
              )}
              <p className="text-[11px] text-muted-foreground mt-3 italic">Pricing subject to change at any time.</p>
            </div>
          </aside>
        </div>

        {checkout && returnUrl && (
          <div className="mt-10 border border-border rounded-lg p-4 bg-background">
            <StripeEmbeddedCheckout
              priceId={course.price_id!}
              customerEmail={userEmail}
              userId={userId}
              returnUrl={returnUrl}
              metadata={{ course_slug: course.slug }}
            />
          </div>
        )}
      </main>
    </>
  );
}
