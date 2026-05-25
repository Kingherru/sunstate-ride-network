import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="bg-card pt-24 pb-12 border-t border-border">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 mb-20">
          <div className="col-span-2 lg:col-span-1">
            <Link
              to="/"
              className="font-extrabold text-2xl tracking-tighter text-primary uppercase block mb-6"
            >
              FL-NEMT<span className="text-accent">.</span>
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
              <li><a href="mailto:support@fl-nemt.net" className="hover:text-primary">support@fl-nemt.net</a></li>
              <li>Main Hub: Orlando, FL</li>
              <li><Link to="/providers" className="hover:text-primary transition-colors">Join the Network</Link></li>
              <li><Link to="/training" className="hover:text-primary transition-colors">Training Academy</Link></li>
            </ul>
          </div>
        </div>
        <div className="pt-12 border-t border-border flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-[10px] text-muted uppercase tracking-wider">
            © {new Date().getFullYear()} Florida NEMT Network. Licensed & insured statewide.
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
