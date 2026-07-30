import { Link } from "@tanstack/react-router";

export type FooterPortal = "public" | "patient" | "provider" | "facility" | "admin";


export function Footer({ portal = "public" }: { portal?: FooterPortal }) {
  const isAuthed = portal !== "public";
  // Only providers see Membership + Training. Patient/Facility see Company links instead.
  const showProviderLinks = portal === "provider";
  const showCompanyLinks = portal === "patient" || portal === "facility";

  if (isAuthed) {
    return (
      <footer className="bg-sidebar text-sidebar-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <Link to="/" className="block mb-3" aria-label="My Florida NEMT — home">
                <span className="font-extrabold text-xl tracking-tighter uppercase">
                  <span className="text-primary">My Florida</span> <span className="text-accent">NEMT</span>
                </span>
              </Link>
              <p className="text-xs opacity-70 leading-relaxed max-w-xs">

                Florida's statewide Medicaid transportation network.
              </p>
            </div>

            {showProviderLinks && (
              <div>
                <h4 className="text-[11px] font-mono font-bold uppercase tracking-widest mb-4 opacity-60">
                  More
                </h4>
                <ul className="space-y-2 text-sm">
                  <li><Link to="/membership" className="opacity-80 hover:opacity-100">Membership</Link></li>
                  <li><Link to="/training" className="opacity-80 hover:opacity-100">Training</Link></li>
                  <li><Link to="/service-areas" className="opacity-80 hover:opacity-100">Service Areas</Link></li>
                </ul>
              </div>
            )}

            {showCompanyLinks && (
              <div>
                <h4 className="text-[11px] font-mono font-bold uppercase tracking-widest mb-4 opacity-60">
                  Company
                </h4>
                <ul className="space-y-2 text-sm">
                  <li><Link to="/about" className="opacity-80 hover:opacity-100">About</Link></li>
                  <li><Link to="/contact" className="opacity-80 hover:opacity-100">Contact</Link></li>
                  <li><a href="mailto:myfloridanemt@gmail.com" className="opacity-80 hover:opacity-100">Support</a></li>
                </ul>
              </div>
            )}

            <div>
              <h4 className="text-[11px] font-mono font-bold uppercase tracking-widest mb-4 opacity-60">
                Support
              </h4>
              <ul className="space-y-2 text-sm">
                <li><a href="mailto:myfloridanemt@gmail.com" className="opacity-80 hover:opacity-100">myfloridanemt@gmail.com</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-6 mt-8 border-t border-sidebar-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs opacity-60">
            <p>© {new Date().getFullYear()} My Florida NEMT. All rights reserved.</p>
            <p>Florida's statewide Medicaid transportation network.</p>
          </div>
        </div>
      </footer>
    );
  }


  return (
    <footer className="bg-card pt-20 pb-10 border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 mb-16">
          <div className="col-span-2 lg:col-span-2">
            <Link to="/" className="block mb-5" aria-label="My Florida NEMT — home">
              <span className="font-extrabold text-3xl tracking-tighter uppercase leading-none">
                <span className="text-primary">My Florida</span> <span className="text-accent">NEMT</span>
              </span>
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
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-mono font-bold uppercase tracking-widest mb-5">Company</h4>
            <ul className="space-y-3 text-sm text-muted">
              <li><Link to="/contact" className="hover:text-primary">Contact</Link></li>
              <li><a href="mailto:myfloridanemt@gmail.com" className="hover:text-primary">Support</a></li>
              <li><Link to="/privacy-policy" className="hover:text-primary">Privacy Policy</Link></li>
              <li><Link to="/privacy-policy" hash="phi-hipaa" className="hover:text-primary">HIPAA Notice</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs text-muted">
          <p>© {new Date().getFullYear()} My Florida NEMT. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <Link to="/login" className="hover:text-primary">Login</Link>
            <Link to="/contact" className="hover:text-primary">Terms of Service</Link>
            <span className="text-muted">v1.5</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
