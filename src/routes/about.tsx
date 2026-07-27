import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Building2, Users, Truck, Stethoscope, HandshakeIcon } from "lucide-react";
import aboutImage from "@/assets/about-nemt.jpg";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About My Florida NEMT — NEMT Built Around People" },
      {
        name: "description",
        content:
          "My Florida NEMT connects patients, facilities, brokers, and Medicaid transportation providers across Florida with simple technology built around real workflows.",
      },
      { property: "og:title", content: "About My Florida NEMT" },
      { property: "og:description", content: "Simple non-emergency medical transportation technology built around people." },
      { property: "og:url", content: "https://myfloridanemt.com/about" },
    ],
    links: [{ rel: "canonical", href: "https://myfloridanemt.com/about" }],
  }),
  component: AboutPage,
});

const AUDIENCES = [
  { icon: Heart, title: "Patients", desc: "A clear, reliable ride to every appointment — from routine visits to dialysis, therapy, and ongoing care." },
  { icon: Building2, title: "Facilities", desc: "Hospitals, nursing homes, group homes, and clinics can request transportation without confusing steps." },
  { icon: HandshakeIcon, title: "Brokers", desc: "Coordinate trips across regions with a network of vetted, credentialed providers." },
  { icon: Stethoscope, title: "Medicaid Providers", desc: "Manage Medicaid transportation with tools that match the way you already work." },
  { icon: Truck, title: "Transportation Companies", desc: "Grow your business by connecting with facilities and patients who need dependable service." },
  { icon: Users, title: "Dispatch Teams", desc: "One unified dashboard for sending trips, receiving assignments, and tracking every ride." },
];

function AboutPage() {
  return (
    <div className="bg-background">
      {/* Hero */}
      <section className="py-20 lg:py-28 px-6">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <p className="font-mono text-xs font-bold text-accent uppercase tracking-[0.2em] mb-4">
              About My Florida NEMT
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tighter mb-6 leading-[1.05]">
              Simple Transportation Technology Built Around People
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8">
              At My Florida NEMT, our goal is to make non-emergency medical
              transportation easier for everyone involved. Transportation does
              not need to be complicated, and the software used to manage it
              should never become a burden.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/providers"
                className="px-6 py-3 bg-accent text-accent-foreground font-bold rounded-sm text-sm tracking-wide uppercase hover:bg-accent/90"
              >
                Join the network
              </Link>
              <Link
                to="/contact"
                className="px-6 py-3 border-2 border-primary/15 text-primary font-bold rounded-sm text-sm tracking-wide uppercase hover:bg-primary/5"
              >
                Contact us
              </Link>
            </div>
          </div>
          <div className="relative">
            <img
              src={aboutImage}
              alt="A caregiver helping an elderly patient into an accessible NEMT van"
              width={1024}
              height={1024}
              className="w-full h-auto rounded-sm shadow-xl object-cover aspect-square"
            />
            <div className="absolute -bottom-4 -left-4 bg-primary text-primary-foreground px-5 py-3 rounded-sm shadow-lg hidden md:block">
              <div className="text-xs uppercase tracking-widest text-primary-foreground/70">Serving</div>
              <div className="font-extrabold">All of Florida</div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Mission */}
      <section className="bg-primary/5 border-y border-border py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="font-mono text-xs font-bold text-accent uppercase tracking-[0.2em] mb-4">
            Our Mission
          </p>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-6">
            Technology should simplify transportation, not make it harder
          </h2>
          <div className="space-y-5 text-lg text-muted-foreground leading-relaxed text-left md:text-center">
            <p>
              Many scheduling and dispatch systems are powerful but difficult to
              learn, requiring unnecessary steps and creating frustration for
              providers, facilities, and patients.
            </p>
            <p>
              Our platform is designed with a focus on simplicity, efficiency,
              and real-world workflows. Providers should be able to manage trips
              easily, facilities should be able to request transportation
              without confusion, and patients should have a clear and reliable
              experience from start to finish.
            </p>
          </div>
        </div>
      </section>

      {/* Florida NEMT Network */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="font-mono text-xs font-bold text-accent uppercase tracking-[0.2em] mb-4">
            The Florida NEMT Network
          </p>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-6">
            Built for Florida's growing transportation needs
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            My Florida NEMT supports the state's growing need for reliable
            non-emergency medical transportation, including Medicaid
            transportation, healthcare facility transportation, broker
            coordination, and workers' compensation transportation. Our
            platform helps connect transportation providers with hospitals,
            nursing homes, group homes, rehabilitation centers, and other
            healthcare organizations that need dependable transportation
            solutions.
          </p>
        </div>
      </section>

      {/* Who we help */}
      <section className="bg-primary/5 border-y border-border py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="font-mono text-xs font-bold text-accent uppercase tracking-[0.2em] mb-4">
              Who we help
            </p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">
              One platform for everyone in the ride
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Every passenger has different needs — from routine appointments
              to cancer treatments, dialysis, and therapy visits. We connect
              the people who make transportation happen.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {AUDIENCES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-card border border-border rounded-sm p-6 hover:border-accent transition">
                <div className="size-11 rounded-sm bg-accent/10 flex items-center justify-center mb-4">
                  <Icon className="size-5 text-accent" />
                </div>
                <h3 className="font-bold text-lg mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-2xl md:text-3xl font-bold tracking-tight text-primary mb-6 italic">
            "Every feature we build is designed around one question:
            Does this make transportation easier?"
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed mb-10">
            By combining modern technology with an easy-to-use experience,
            My Florida NEMT helps connect patients, facilities, dispatch teams,
            Medicaid transportation providers, and healthcare organizations
            throughout Florida — without adding unnecessary complexity.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              to="/request-a-ride"
              className="px-6 py-3 bg-accent text-accent-foreground font-bold rounded-sm text-sm tracking-wide uppercase hover:bg-accent/90"
            >
              Request a ride
            </Link>
            <Link
              to="/providers"
              className="px-6 py-3 border-2 border-primary/15 text-primary font-bold rounded-sm text-sm tracking-wide uppercase hover:bg-primary/5"
            >
              Join the network
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
