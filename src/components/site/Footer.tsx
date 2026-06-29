import { Link } from "@tanstack/react-router";

export type FooterPortal = "public" | "patient" | "provider" | "facility" | "admin";


export function Footer({ portal = "public" }: { portal?: FooterPortal }) {
  const isAuthed = portal !== "public";
  // Only providers see Membership + Training. Patient/Facility see Company links instead.
  const showProviderLinks = portal === "provider";
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
                Florida NEMT
              </Link>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
                Florida's statewide Medicaid transportation network.
              </p>
            </div>

            {showProviderLinks && (
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
            )}

            {showCompanyLinks && (
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
            )}

            <div>
              <h4 className="text-[11px] font-mono font-bold uppercase tracking-widest mb-4 text-slate-400">
                Support
              </h4>
              <ul className="space-y-2 text-sm">
                <li><a href="mailto:myfloridanemt@gmail.com" className="text-slate-300 hover:text-white">myfloridanemt@gmail.com</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-6 mt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} Florida NEMT. All rights reserved.</p>
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
            <Link
              to="/"
              className="font-extrabold text-2xl tracking-tighter text-primary uppercase block mb-5"
            >
              Florida NEMT
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
              <li><Link to="/contact" className="hover:text-primary">Privacy Policy</Link></li>
              <li><Link to="/contact" className="hover:text-primary">HIPAA Notice</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs text-muted">
          <p>© {new Date().getFullYear()} Florida NEMT. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <Link to="/staff/login" className="hover:text-primary">Staff Login</Link>
            <Link to="/contact" className="hover:text-primary">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
