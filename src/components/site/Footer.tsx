import { Link } from "@tanstack/react-router";

export type FooterPortal = "public" | "patient" | "provider" | "facility" | "admin";

const FAQS = [
  {
    q: "What is non-emergency medical transportation (NEMT)?",
    a: "NEMT is scheduled, non-ambulance transport for patients getting to medical appointments — dialysis, physical therapy, surgery, primary care — including ambulatory, wheelchair, and stretcher service.",
  },
  {
    q: "Does Medicaid or Medicare cover my ride?",
    a: "Florida Medicaid covers medically necessary NEMT for eligible members through their managed-care plan. Medicare Advantage plans often include a transportation benefit.",
  },
  {
    q: "How far in advance should I book?",
    a: "At least 48 hours in advance for routine appointments, and as soon as possible for same-day or recurring trips.",
  },
  {
    q: "Do you transport wheelchair and stretcher patients?",
    a: "Yes. Our network includes wheelchair-accessible vans and stretcher vans across all Florida regions.",
  },
  {
    q: "How is HIPAA protected on this platform?",
    a: "FloridaNEMT requires a HIPAA acknowledgment on every trip sent or received. Patient details are visible only to the sender and the assigned provider.",
  },
  {
    q: "How and when do providers get paid?",
    a: "Patient payments are collected at booking and held by FloridaNEMT. After the trip completes, funds release to the provider's connected bank in 1–2 business days, minus a 4% platform fee.",
  },
];

export function Footer({ portal = "public" }: { portal?: FooterPortal }) {
  const isAuthed = portal !== "public";
  // Patient + Facility portals see About/Contact links. Provider/Admin do not.
  const showCompanyLinks = portal === "patient" || portal === "facility";

  if (isAuthed) {
    return (
      <footer className="bg-[#0b1220] text-slate-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <Link
                to="/"
                className="font-extrabold text-xl tracking-tighter text-white uppercase block mb-3"
              >
                FloridaNEMT
              </Link>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
                Florida's statewide Medicaid transportation network.
              </p>
            </div>

            {/* Secondary menu: Membership + Training live here for logged-in users */}
            <div>
              <h4 className="text-[11px] font-mono font-bold uppercase tracking-widest mb-4 text-slate-400">
                More
              </h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/membership" className="text-slate-300 hover:text-white">Membership</Link></li>
                <li><Link to="/training" className="text-slate-300 hover:text-white">Training</Link></li>
                <li><Link to="/service-areas" className="text-slate-300 hover:text-white">Service Areas</Link></li>
              </ul>
            </div>

            {showCompanyLinks ? (
              <div>
                <h4 className="text-[11px] font-mono font-bold uppercase tracking-widest mb-4 text-slate-400">
                  Company
                </h4>
                <ul className="space-y-2 text-sm">
                  <li><Link to="/about" className="text-slate-300 hover:text-white">About</Link></li>
                  <li><Link to="/contact" className="text-slate-300 hover:text-white">Contact</Link></li>
                  <li><a href="mailto:myfloridanemt@gmail.com" className="text-slate-300 hover:text-white">Support</a></li>
                </ul>
              </div>
            ) : (
              <div>
                <h4 className="text-[11px] font-mono font-bold uppercase tracking-widest mb-4 text-slate-400">
                  Support
                </h4>
                <ul className="space-y-2 text-sm">
                  <li><a href="mailto:myfloridanemt@gmail.com" className="text-slate-300 hover:text-white">myfloridanemt@gmail.com</a></li>
                </ul>
              </div>
            )}
          </div>

          <div className="pt-6 mt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} FloridaNEMT. All rights reserved.</p>
            <p>Florida's statewide Medicaid transportation network.</p>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="bg-card pt-20 pb-10 border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <section className="mb-16 pb-12 border-b border-border">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tighter mb-2">
            Frequently asked questions
          </h2>
          <p className="text-sm text-muted mb-8 max-w-2xl">
            Common questions about Florida Medicaid transportation.
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            {FAQS.map((item) => (
              <details
                key={item.q}
                className="group bg-background border border-border p-4"
              >
                <summary className="cursor-pointer list-none flex items-start justify-between gap-3 text-sm font-bold text-foreground">
                  <span>{item.q}</span>
                  <span className="text-accent text-lg leading-none transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="text-sm text-muted mt-3 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-10 mb-16">
          <div className="col-span-2 lg:col-span-2">
            <Link
              to="/"
              className="font-extrabold text-2xl tracking-tighter text-primary uppercase block mb-5"
            >
              FloridaNEMT
            </Link>
            <p className="text-sm text-muted leading-relaxed max-w-sm">
              Florida's statewide non-emergency medical transportation network — connecting
              patients, facilities, and vetted providers.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-mono font-bold uppercase tracking-widest mb-5">Platform</h4>
            <ul className="space-y-3 text-sm text-muted">
              <li><Link to="/services" className="hover:text-primary">Services</Link></li>
              <li><Link to="/service-areas" className="hover:text-primary">Service Areas</Link></li>
              <li><Link to="/providers" className="hover:text-primary">For Providers</Link></li>
              <li><Link to="/training" className="hover:text-primary">Training</Link></li>
              <li><Link to="/membership" className="hover:text-primary">Membership</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-mono font-bold uppercase tracking-widest mb-5">Portals</h4>
            <ul className="space-y-3 text-sm text-muted">
              <li><Link to="/patient/login" className="hover:text-primary">Patient Sign In</Link></li>
              <li><Link to="/provider/login" className="hover:text-primary">Provider Sign In</Link></li>
              <li><Link to="/facility/login" className="hover:text-primary">Facility Sign In</Link></li>
              <li><Link to="/request-a-ride" className="hover:text-primary">Request a Ride</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-mono font-bold uppercase tracking-widest mb-5">Company</h4>
            <ul className="space-y-3 text-sm text-muted">
              <li><Link to="/about" className="hover:text-primary">About</Link></li>
              <li><Link to="/contact" className="hover:text-primary">Contact</Link></li>
              <li><a href="mailto:myfloridanemt@gmail.com" className="hover:text-primary">Support</a></li>
              <li><Link to="/contact" className="hover:text-primary">Privacy Policy</Link></li>
              <li><Link to="/contact" className="hover:text-primary">Terms of Service</Link></li>
              <li><Link to="/contact" className="hover:text-primary">HIPAA Notice</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs text-muted">
          <p>© {new Date().getFullYear()} FloridaNEMT. All rights reserved.</p>
          <p>Florida's statewide Medicaid transportation network.</p>
        </div>
      </div>
    </footer>
  );
}
