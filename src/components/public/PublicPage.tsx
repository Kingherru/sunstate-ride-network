import { PublicHeader } from "./PublicHeader";
import { PublicFooter } from "./PublicFooter";

/** Wrapper for rebuilt public pages. Root route hides its temporary bar on these paths. */
export const PUBLIC_SHELL_PATHS = ["/", "/book", "/join", "/services", "/how-it-works", "/for-providers", "/for-facilities", "/florida-coverage", "/privacy", "/terms", "/accessibility", "/sitemap", "/resources", "/frequently-asked-questions", "/login", "/create-account", "/forgot-password", "/reset-password", "/portal", "/admin", "/account-setup", "/account-status"];

export function PublicPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-public flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-ds-sm focus:bg-ds-surface focus:px-4 focus:py-2 focus:text-ds-primary">Skip to content</a>
      <PublicHeader />
      <main id="main" className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
