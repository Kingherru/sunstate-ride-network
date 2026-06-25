import { Link } from "@tanstack/react-router";

const FAQS = [
  {
    q: "What is non-emergency medical transportation (NEMT)?",
    a: "NEMT is scheduled, non-ambulance transport for patients getting to medical appointments — dialysis, physical therapy, surgery, primary care — including ambulatory, wheelchair, and stretcher service.",
  },
  {
    q: "Does Medicaid or Medicare cover my ride?",
    a: "Florida Medicaid covers medically necessary NEMT for eligible members through their managed-care plan. Medicare Advantage plans often include a transportation benefit. We can bill participating brokers directly or you can pay privately.",
  },
  {
    q: "How far in advance should I book?",
    a: "At least 48 hours in advance for routine appointments, and as soon as possible for same-day or recurring trips. Standing dialysis schedules can be set up once and run weekly.",
  },
  {
    q: "Do you transport wheelchair and stretcher patients?",
    a: "Yes. Our network includes wheelchair-accessible vans and stretcher vans across all Florida regions. Specify mobility needs when booking so we dispatch the right vehicle.",
  },
  {
    q: "Can a family member or caregiver ride along?",
    a: "Yes — one companion can typically ride at no extra charge. Mention them when booking so the driver has the right vehicle capacity.",
  },
  {
    q: "How is HIPAA protected on this platform?",
    a: "FloridaNEMT requires a HIPAA acknowledgment on every trip sent or received. Patient details are visible only to the sender and the assigned provider — not to the platform.",
  },
  {
    q: "What does it cost to become a provider?",
    a: "A free membership is included once you're approved. To send trips and use API integrations, upgrade to the $5/month paid membership.",
  },
  {
    q: "How and when do providers get paid?",
    a: "Patient payments are collected at booking and held by FloridaNEMT. After you complete the trip, funds release to your connected bank account in 1–2 business days, minus a 4% platform fee.",
  },
];

export function Footer() {
  return (
    <footer className="bg-card pt-24 pb-12 border-t border-border">
      <div className="max-w-7xl mx-auto px-6">
        <section className="mb-20 pb-16 border-b border-border">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tighter mb-2">
            Frequently asked questions
          </h2>
          <p className="text-sm text-muted mb-8 max-w-2xl">
            Common questions about non-emergency medical transportation in Florida — for patients, caregivers, and providers.
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            {FAQS.map((item) => (
              <details
                key={item.q}
                className="group bg-background border border-border rounded-sm p-4 open:bg-background"
              >
                <summary className="cursor-pointer list-none flex items-start justify-between gap-3 text-sm font-bold text-foreground">
                  <span>{item.q}</span>
                  <span className="text-primary text-lg leading-none transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="text-sm text-muted mt-3 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 mb-20">
          <div className="col-span-2 lg:col-span-1">
            <Link
              to="/"
              className="font-extrabold text-2xl tracking-tighter text-primary uppercase block mb-6"
            >
              FloridaNEMT
            </Link>
            <p className="text-sm text-muted leading-relaxed mb-8">
              Florida's statewide non-emergency medical transportation network — connecting patients
              with vetted providers across the Sunshine State.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-mono font-bold uppercase tracking-widest mb-6">Services</h4>
            <ul className="space-y-4 text-sm text-muted">
              <li><Link to="/services" className="hover:text-primary transition-colors">Ambulatory Transport</Link></li>
              <li><Link to="/services" className="hover:text-primary transition-colors">Wheelchair Access</Link></li>
              <li><Link to="/services" className="hover:text-primary transition-colors">Stretcher Services</Link></li>
              <li><Link to="/request-a-ride" className="hover:text-primary transition-colors">Request a Ride</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-mono font-bold uppercase tracking-widest mb-6">Coverage</h4>
            <ul className="space-y-4 text-sm text-muted">
              <li><Link to="/service-areas/jacksonville" className="hover:text-primary transition-colors">Jacksonville</Link></li>
              <li><Link to="/service-areas/orlando" className="hover:text-primary transition-colors">Orlando</Link></li>
              <li><Link to="/service-areas/tampa" className="hover:text-primary transition-colors">Tampa</Link></li>
              <li><Link to="/service-areas/miami" className="hover:text-primary transition-colors">Miami</Link></li>
              <li><Link to="/service-areas/tallahassee" className="hover:text-primary transition-colors">Tallahassee</Link></li>
              <li><Link to="/service-areas/fort-lauderdale" className="hover:text-primary transition-colors">Fort Lauderdale</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-mono font-bold uppercase tracking-widest mb-6">Contact</h4>
            <ul className="space-y-4 text-sm text-muted">
              <li className="font-mono font-bold text-primary">(800) 555-0199</li>
              <li><a href="mailto:myfloridanemt@gmail.com" className="hover:text-primary">myfloridanemt@gmail.com</a></li>
              <li>Main Hub: Orlando, FL</li>
              <li><Link to="/providers" className="hover:text-primary transition-colors">Join the Network</Link></li>
              <li><Link to="/training" className="hover:text-primary transition-colors">Training Academy</Link></li>
            </ul>
          </div>
        </div>
        <div className="pt-12 border-t border-border flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-[10px] text-muted uppercase tracking-wider">
            © {new Date().getFullYear()} FloridaNEMT. Licensed & insured statewide.
          </p>
          <div className="flex gap-8 text-[10px] font-bold text-muted uppercase tracking-wider">
            <Link to="/about">About</Link>
            <Link to="/contact">Contact</Link>
            <a href="#">HIPAA Privacy</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
