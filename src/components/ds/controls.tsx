import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-focus focus-visible:ring-offset-2";

export type ButtonVariant = "primary" | "secondary" | "on-blue" | "ghost";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-ds-accent text-ds-on-accent hover:bg-ds-accent-hover active:bg-ds-accent-active",
  secondary: "bg-ds-primary text-ds-on-primary hover:bg-ds-primary-hover active:bg-ds-primary-active",
  "on-blue": "bg-ds-surface text-ds-primary hover:bg-ds-sky active:bg-ds-active focus-visible:ring-offset-ds-primary",
  ghost: "bg-transparent text-ds-primary hover:bg-ds-hover active:bg-ds-active",
};

export const DsButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "md" | "sm" }
>(({ variant = "primary", size = "md", className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "ds-button-text ds-transition inline-flex items-center justify-center gap-2 rounded-ds-sm",
      size === "md" ? "min-h-11 px-5 py-2.5" : "min-h-9 px-3.5 py-1.5 text-[0.9375rem]",
      "hover:-translate-y-px active:translate-y-0",
      "disabled:bg-ds-disabled disabled:text-ds-on-disabled disabled:cursor-not-allowed disabled:translate-y-0",
      focus,
      buttonVariants[variant],
      className,
    )}
    {...props}
  />
));
DsButton.displayName = "DsButton";

export function DsLink({ className, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      className={cn("ds-transition text-ds-link underline underline-offset-4 decoration-1 hover:text-ds-link-hover hover:decoration-2 rounded-sm", focus, className)}
      {...props}
    />
  );
}

const fieldBase = cn(
  "ds-body ds-transition w-full rounded-ds-sm border border-ds-border bg-ds-surface text-ds-on-surface px-3.5 py-2.5 min-h-11",
  "placeholder:text-ds-text-2 hover:border-ds-text-2",
  "focus-visible:outline-none focus-visible:border-ds-focus focus-visible:ring-2 focus-visible:ring-ds-focus/30",
  "disabled:bg-ds-disabled disabled:text-ds-on-disabled disabled:cursor-not-allowed",
  "aria-[invalid=true]:border-ds-error",
);

export function DsField({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => React.ReactNode;
}) {
  const id = useId();
  const descId = hint || error ? `${id}-desc` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="ds-label text-ds-on-surface">{label}</label>
      {children({ id, "aria-describedby": descId, "aria-invalid": error ? true : undefined })}
      {error ? (
        <p id={descId} className="ds-caption !text-ds-error flex items-center gap-1">
          <span aria-hidden>⚠</span> {error}
        </p>
      ) : hint ? (
        <p id={descId} className="ds-caption">{hint}</p>
      ) : null}
    </div>
  );
}

export const DsInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...p }, ref) => <input ref={ref} className={cn(fieldBase, className)} {...p} />,
);
DsInput.displayName = "DsInput";

export const DsSelect = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...p }, ref) => <select ref={ref} className={cn(fieldBase, "pr-9 appearance-none bg-[length:1rem] bg-no-repeat bg-[right_0.75rem_center]", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2355616F'%3E%3Cpath d='M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z'/%3E%3C/svg%3E\")" }} {...p} />,
);
DsSelect.displayName = "DsSelect";

export const DsTextarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...p }, ref) => <textarea ref={ref} className={cn(fieldBase, "min-h-28", className)} {...p} />,
);
DsTextarea.displayName = "DsTextarea";

function ChoiceControl({ type, label, className, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={cn("ds-body inline-flex items-center gap-2.5 cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:text-ds-on-disabled", className)}>
      <input
        type={type}
        className={cn("size-5 accent-[var(--ds-primary)] cursor-pointer disabled:cursor-not-allowed", focus)}
        {...p}
      />
      {label}
    </label>
  );
}

export const DsCheckbox = (p: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => <ChoiceControl type="checkbox" {...p} />;
export const DsRadio = (p: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => <ChoiceControl type="radio" {...p} />;
