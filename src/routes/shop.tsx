import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listPublicCourses } from "@/lib/courses.functions";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Award, Clock, ShoppingBag } from "lucide-react";

const coursesQO = queryOptions({ queryKey: ["shop", "courses"], queryFn: () => listPublicCourses() });

export const Route = createFileRoute("/shop")({
  loader: ({ context }) => context.queryClient.ensureQueryData(coursesQO),
  head: () => ({
    meta: [
      { title: "Training Shop — HIPAA & NEMT Certification | MyFloridaNemt.com" },
      { name: "description", content: "Buy online HIPAA training and NEMT certification courses. Complete the exam and get a printable certificate." },
      { property: "og:title", content: "Training Shop — HIPAA & NEMT Certification" },
      { property: "og:description", content: "Certification courses for NEMT drivers, dispatchers, and staff." },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "https://myfloridanemt.com/shop" }],
  }),
  component: ShopIndex,
});

function ShopIndex() {
  const { data: courses } = useSuspenseQuery(coursesQO);
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1">
        <section className="bg-primary text-primary-foreground py-14">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-center gap-3 mb-3"><ShoppingBag className="w-6 h-6" /><span className="uppercase tracking-wider text-sm">Training Shop</span></div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3">HIPAA & NEMT Certification Courses</h1>
            <p className="text-lg opacity-90 max-w-2xl">Online training for drivers, dispatchers, and NEMT staff. Purchase, complete the modules, pass the exam, and download your certificate.</p>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 py-12">
          {courses.length === 0 ? (
            <p className="text-muted-foreground">No courses available right now — check back soon.</p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((c) => (
                <Link key={c.id} to="/shop/$slug" params={{ slug: c.slug }} className="group border border-border rounded-lg overflow-hidden bg-card hover:border-primary transition flex flex-col">
                  <div className="h-40 bg-primary" />
                  <div className="p-5 flex-1 flex flex-col">
                    <h2 className="text-xl font-bold mb-2 group-hover:text-primary transition">{c.title}</h2>
                    <p className="text-sm text-muted-foreground mb-4 flex-1">{c.summary}</p>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{c.duration_min} min</span>
                        <span className="flex items-center gap-1"><Award className="w-4 h-4" />Cert</span>
                      </div>
                      <span className="font-bold text-lg">${(c.price_cents / 100).toFixed(2)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
