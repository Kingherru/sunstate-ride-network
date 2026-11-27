import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { BrandName } from "@/components/brand/BrandName";
import { cn } from "@/lib/utils";
import { DsButton } from '@/components/ds/controls';
import { btnOutline } from '@/components/home/buttons';

/** Shared layout for sign-in, account creation and password recovery. */
export function AuthShell({ title, intro, children, wide = false }: { title: string; intro?: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="theme-public flex min-h-screen flex-col bg-ds-sky">
      <div className="px-5 pt-8 text-center">
        <a href="/" aria-label="MY FLORIDA NEMT home" className="inline-block rounded-ds-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus"><BrandName className="text-2xl" /></a>
      </div>
      <main id="main" className="flex-1 px-5 py-10 sm:py-14">
        <div className={cn("auth-enter mx-auto min-w-0 w-full rounded-ds bg-ds-surface p-5 shadow-ds sm:p-10", wide ? "max-w-2xl" : "max-w-md")}>
          <h1 className="ds-h2 text-center uppercase text-ds-primary">{title}</h1>
          {intro && <p className="ds-body mt-3 text-center text-ds-text-2">{intro}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
      <p className="pb-8 text-center"><a href="/" className={btnOutline}>Back to website</a></p>
    </div>
  );
}

export function AuthMessage({ tone, children }: { tone: "error" | "success" | "info"; children: React.ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("auth-message ds-body rounded-ds-sm px-4 py-3",
      tone === "error" && "bg-ds-error-soft text-ds-error",
      tone === "success" && "bg-ds-success-soft text-ds-on-surface",
      tone === "info" && "bg-ds-sky text-ds-primary")}>
      {children}
    </div>
  );
}

export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={show ? "text" : "password"} className={cn(authField, "pr-12")} />
      <DsButton variant="ghost" type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} title={show ? "Hide password" : "Show password"} aria-pressed={show}
        className="absolute right-1.5 top-1/2 size-9 min-h-0 -translate-y-1/2 p-0 text-ds-text-2">
        {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </DsButton>
    </div>
  );
}

export const authField = "ds-body ds-transition w-full min-h-12 rounded-ds-sm bg-ds-sky/60 px-3.5 py-2.5 text-ds-on-surface placeholder:text-ds-text-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-ds-error";
export const authLabel = "ds-label mb-1.5 block text-ds-primary";
