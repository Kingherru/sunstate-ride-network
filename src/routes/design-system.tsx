import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BrandName } from "@/components/brand/BrandName";
import { LinePattern, LINE_PATTERN_PRESETS, type LinePatternPreset } from "@/components/brand/LinePattern";
import { DsButton, DsLink, DsField, DsInput, DsSelect, DsTextarea, DsCheckbox, DsRadio } from "@/components/ds/controls";
import { DsBadge, DsAlert, DsLoading, DsSkeleton, DsEmpty, DsModal } from "@/components/ds/feedback";
import { btnAction, btnBlue, btnLight } from "@/components/home/buttons";
import { CalendarPlus, Monitor, Network, Phone, Smartphone, Tablet } from "lucide-react";
import { DsCard, DsSoftBox, DsTabs, DsPublicHeader, DsPortalMenu } from "@/components/ds/layout";

export const Route = createFileRoute("/design-system")({
  head: () => ({
    meta: [
      { title: "Design System (internal) — My Florida NEMT" },
      { name: "description", content: "Internal design-system review page." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DesignSystemPage,
});

const PUBLIC_SWATCHES = [
  ["Primary brand blue", "#13335A", "--mfn-blue", "light"],
  ["Brand orange (NEMT, eyebrows, accents)", "#E07A1F", "--mfn-orange", "dark"],
  ["Action orange (buttons, white text)", "#BE5200", "--ds-action", "light"],
  ["Action orange border / hover / pressed", "#9F4100", "--ds-action-border", "light"],
  ["White", "#FFFFFF", "--mfn-white", "dark"],
  ["Soft neutral gray", "#F4F5F7", "--mfn-gray", "dark"],
  ["Light sky blue", "#EAF2F8", "--mfn-sky", "dark"],
  ["Pale supporting green", "#EDF4ED", "--mfn-green", "dark"],
  ["Soft peach", "#FAE9DD", "--mfn-peach", "dark"],
  ["Warm sand", "#F5EFE5", "--mfn-sand", "dark"],
  ["Primary dark text", "#18202A", "--mfn-text", "light"],
  ["Secondary text", "#55616F", "--mfn-text-2", "light"],
  ["Neutral border", "#DCE1E6", "--mfn-line", "dark"],
] as const;

const SEMANTIC = [
  ["Background / On-background", "bg-ds-bg text-ds-on-bg border border-ds-border"],
  ["Surface / On-surface", "bg-ds-surface text-ds-on-surface border border-ds-border"],
  ["Primary / On-primary", "bg-ds-primary text-ds-on-primary"],
  ["Accent / On-accent", "bg-ds-accent text-ds-on-accent"],
  ["Hover", "bg-ds-hover text-ds-on-surface"],
  ["Active", "bg-ds-active text-ds-on-surface"],
  ["Disabled", "bg-ds-disabled text-ds-on-disabled"],
  ["Informational", "bg-ds-info-soft text-ds-info"],
  ["Success", "bg-ds-success-soft text-ds-success"],
  ["Warning", "bg-ds-warning-soft text-ds-warning"],
  ["Error", "bg-ds-error-soft text-ds-error"],
] as const;

const CONTRAST = [
  ["White text on primary blue", "12.74:1", "AA / AAA"],
  ["Dark text #18202A on white", "16.42:1", "AA / AAA"],
  ["Secondary text on white", "6.31:1", "AA"],
  ["Secondary text on soft gray", "5.79:1", "AA"],
  ["Dark text on orange button", "5.45:1", "AA"],
  ["Blue text on orange button", "4.23:1", "Fails AA (normal text) — not used"],
  ["White text on brand orange #E07A1F", "3.01:1", "Fails AA — never used"],
  ["White text on action orange #BE5200", "4.78:1", "AA — used for all orange buttons"],
  ["Orange “NEMT” on white", "3.01:1", "Large/brand text only (AA large)"],
  ["Orange “NEMT” on blue", "4.23:1", "AA large"],
  ["Blue on light sky blue", "11.25:1", "AA / AAA"],
  ["Dark text on green / peach / sand", "13.9–14.7:1", "AA / AAA"],
  ["Success text on pale green", "5.83:1", "AA"],
  ["Warning text on peach", "5.75:1", "AA"],
  ["Error text on pale red", "6.19:1", "AA"],
  ["Focus ring #1F6FB2 on white", "5.28:1", "Meets 3:1 non-text"],
] as const;

function Section({ title, children, id }: { title: string; id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="py-10 border-t border-ds-border first:border-t-0">
      <h2 className="ds-section-title text-ds-primary mb-6">{title}</h2>
      {children}
    </section>
  );
}

function Sub({ children }: { children: React.ReactNode }) {
  return <h3 className="ds-label text-ds-text-2 uppercase tracking-wide text-[0.8125rem] mb-3 mt-8 first:mt-0">{children}</h3>;
}

function DesignSystemPage() {
  const [modal, setModal] = useState(false);
  const [reviewOpacity, setReviewOpacity] = useState(false);
  const patternOpacity = reviewOpacity ? 0.25 : 0.05;

  return (
    <div className="theme-public">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <p className="ds-caption">Internal review · not linked · noindex</p>
        <h1 className="ds-page-title text-ds-primary mt-1">My Florida NEMT Design System</h1>
        <p className="ds-body-lg text-ds-text-2 mt-2 max-w-2xl">Public website system first, then the quieter portal system.</p>

        {/* ------------------------------------------------ PUBLIC */}
        <Section id="rev3" title="Homepage Revision 3 rules">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3 ds-body">
              <p><strong>Corners:</strong> 4px standard, 3px small controls (tabs, chips, inputs, map controls), 5px maximum on large image and promotional panels. No pills, no fully square components.</p>
              <p><strong>Borders:</strong> no permanent 2px/3px borders and no double-border or colored-underlining effects. Separation comes from background color, spacing and restrained shadows. Neutral 1px dividers only where functional: list rows, table-style information, form fields.</p>
              <p><strong>Focus:</strong> keyboard-only — a visible outline appears only when an element receives keyboard focus.</p>
              <p><strong>Header:</strong> uppercase navigation (SERVICES, HOW IT WORKS, FOR PROVIDERS, TRAINING, RESOURCES, SIGN IN). CALL US and BOOK A TRIP are icon + text on blue — no background, no border, subtle hover.</p>
              <p><strong>Training:</strong> one prominent EXPLORE TRAINING button (blue, 4px, no border) below the intro; View Resources is a quiet text link.</p>
              <p><strong>Spacing:</strong> sections 48 / 64 / 80px (mobile / tablet / desktop), major sections 56 / 80 / 96px; heading-to-content 32–40px; panels 18–32px.</p>
            </div>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3"><span className={btnAction}><CalendarPlus aria-hidden />Book a Trip</span><span className={btnBlue}><Network aria-hidden />Join the Provider Network</span><span className={btnLight}>Secondary</span></div>
              <div className="flex flex-wrap items-center gap-5 bg-ds-primary p-4">
                <span className="ds-button-text inline-flex items-center gap-2 text-ds-on-primary"><Phone aria-hidden className="size-5" />CALL US</span>
                <span className="ds-button-text inline-flex items-center gap-2 uppercase tracking-[0.04em] text-ds-accent"><CalendarPlus aria-hidden className="size-5" />Book a Trip</span>
                <span className="ds-caption !text-ds-on-primary self-center">Header actions — no background</span>
              </div>
              <div className="flex flex-wrap gap-3"><span className="ds-button-text rounded-ds-sm bg-ds-primary px-6 py-3 text-ds-on-primary">Tab selected</span><span className="ds-button-text rounded-ds-sm bg-ds-subtle px-6 py-3 text-ds-primary">Tab unselected</span></div>
              <div className="flex gap-3">{([[Smartphone, "Mobile"], [Tablet, "Tablet"], [Monitor, "Desktop"]] as const).map(([I, l]) => <span key={l} className="flex items-center gap-2 rounded-ds-sm bg-ds-sky px-3 py-2 ds-label text-ds-primary"><I className="size-5" aria-hidden />{l}</span>)}</div>
            </div>
          </div>
        </Section>
        <Section id="brand" title="Brand name">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-ds border border-ds-border bg-ds-surface p-6"><BrandName className="text-2xl" /><p className="ds-caption mt-2">On white</p></div>
            <div className="rounded-ds bg-ds-subtle p-6"><BrandName className="text-2xl" /><p className="ds-caption mt-2">On light gray</p></div>
            <div className="rounded-ds bg-ds-primary p-6"><BrandName on="blue" className="text-2xl" /><p className="ds-caption mt-2 !text-ds-on-primary opacity-80">On blue</p></div>
          </div>
          <p className="ds-support mt-4">Title-case option: <BrandName casing="title" className="text-lg" /></p>
        </Section>

        <Section id="colors" title="Public color palette">
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {PUBLIC_SWATCHES.map(([name, hex, token, text]) => (
              <div key={hex} className="rounded-ds overflow-hidden border border-ds-border">
                <div className="h-20 flex items-end p-3" style={{ background: `var(${token})`, color: text === "light" ? "#FFFFFF" : "#18202A" }}>
                  <span className="ds-label">Aa</span>
                </div>
                <div className="p-3 bg-ds-surface">
                  <p className="ds-label">{name}</p>
                  <p className="ds-caption">{hex} · {token}</p>
                </div>
              </div>
            ))}
          </div>
          <Sub>Semantic tokens (each background paired with its on-color)</Sub>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SEMANTIC.map(([n, c]) => (
              <div key={n} className={`rounded-ds-sm px-4 py-3 ds-body ${c}`}>{n}</div>
            ))}
            <div className="rounded-ds-sm px-4 py-3 ds-body border border-ds-border"><DsLink href="#colors">Link token</DsLink></div>
            <div className="rounded-ds-sm px-4 py-3 ds-body border border-ds-border ring-2 ring-ds-focus ring-offset-2">Focus token</div>
          </div>
        </Section>

        <Section id="type" title="Typography — Archivo + Source Sans 3">
          <div className="space-y-4">
            <p className="ds-display text-ds-primary">Display headline</p>
            <p className="ds-page-title text-ds-primary">Page title</p>
            <p className="ds-section-title">Section title</p>
            <p className="ds-subheading">Subheading</p>
            <p className="ds-body-lg">Body large — reliable rides to medical appointments across Florida.</p>
            <p className="ds-body">Body regular — scheduling, pickup and drop-off details are confirmed before every trip.</p>
            <p className="ds-support">Supporting text — secondary details and helper copy.</p>
            <p className="ds-label">Label</p>
            <p className="ds-button-text">Button text</p>
            <p className="ds-caption">Caption — timestamps and fine print.</p>
          </div>
        </Section>

        <Section id="buttons" title="Buttons and links">
          <Sub>On white</Sub>
          <div className="flex flex-wrap gap-3 items-center">
            <DsButton>Primary action</DsButton>
            <DsButton variant="secondary">Secondary</DsButton>
            <DsButton variant="ghost">Ghost</DsButton>
            <DsButton disabled>Disabled</DsButton>
            <DsButton size="sm">Small</DsButton>
            <DsLink href="#buttons">Text link</DsLink>
          </div>
          <Sub>On blue</Sub>
          <div className="rounded-ds bg-ds-primary p-6 flex flex-wrap gap-3 items-center">
            <DsButton>Primary action</DsButton>
            <DsButton variant="on-blue">White button</DsButton>
          </div>
          <p className="ds-caption mt-3">Hover: slight lift + darker fill. Active: deepest fill. Focus: blue ring (Tab key to test).</p>
        </Section>

        <Section id="forms" title="Form controls">
          <div className="grid gap-5 md:grid-cols-2">
            <DsField label="Full name" hint="As shown on your ID.">{(p) => <DsInput placeholder="Jane Doe" {...p} />}</DsField>
            <DsField label="Phone" error="Enter a 10-digit phone number.">{(p) => <DsInput defaultValue="555-01" {...p} />}</DsField>
            <DsField label="Service type">{(p) => (
              <DsSelect {...p} defaultValue="">
                <option value="" disabled>Choose one</option>
                <option>Ambulatory</option><option>Wheelchair</option><option>Stretcher</option>
              </DsSelect>
            )}</DsField>
            <DsField label="Disabled field">{(p) => <DsInput disabled placeholder="Not editable" {...p} />}</DsField>
            <div className="md:col-span-2">
              <DsField label="Trip notes">{(p) => <DsTextarea placeholder="Gate code, mobility needs…" {...p} />}</DsField>
            </div>
            <fieldset className="flex flex-col gap-2.5">
              <legend className="ds-label mb-2">Checkboxes</legend>
              <DsCheckbox label="Round trip" defaultChecked />
              <DsCheckbox label="Needs an escort" />
              <DsCheckbox label="Disabled option" disabled />
            </fieldset>
            <fieldset className="flex flex-col gap-2.5">
              <legend className="ds-label mb-2">Radio</legend>
              <DsRadio name="pay" label="Medicaid" defaultChecked />
              <DsRadio name="pay" label="Private pay" />
              <DsRadio name="pay" label="Facility billed" disabled />
            </fieldset>
          </div>
        </Section>

        <Section id="tabs" title="Tabs">
          <DsTabs tabs={[
            { id: "a", label: "Ambulatory", content: <p className="ds-body">Walk-on rides with light assistance.</p> },
            { id: "b", label: "Wheelchair", content: <p className="ds-body">Lift-equipped vans with securement.</p> },
            { id: "c", label: "Stretcher", content: <p className="ds-body">Bed-to-bed non-emergency transport.</p> },
          ]} />
        </Section>

        <Section id="status" title="Status badges and alerts">
          <div className="flex flex-wrap gap-2 mb-6">
            <DsBadge status="success">Completed</DsBadge>
            <DsBadge status="pending">Pending</DsBadge>
            <DsBadge status="warning">Needs attention</DsBadge>
            <DsBadge status="error">Canceled</DsBadge>
            <DsBadge status="info">Scheduled</DsBadge>
            <DsBadge>Draft</DsBadge>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <DsAlert status="info" title="Heads up">Pickup windows are 15 minutes.</DsAlert>
            <DsAlert status="success" title="Ride booked">A confirmation email is on its way.</DsAlert>
            <DsAlert status="warning" title="Missing information">Add the appointment address to continue.</DsAlert>
            <DsAlert status="error" title="Payment failed">Check the card details and try again.</DsAlert>
          </div>
        </Section>

        <Section id="containers" title="Cards and soft boxes">
          <div className="grid gap-4 md:grid-cols-3">
            <DsCard><p className="ds-subheading">White content card</p><p className="ds-support mt-1">Neutral border, minimal shadow.</p></DsCard>
            <DsSoftBox tone="sky"><p className="ds-subheading text-ds-primary">Light sky box</p><p className="ds-body mt-1">No contrasting border.</p></DsSoftBox>
            <DsSoftBox tone="green"><p className="ds-subheading">Pale green box</p><p className="ds-body mt-1">Supporting color only.</p></DsSoftBox>
            <DsSoftBox tone="peach"><p className="ds-subheading">Soft peach box</p><p className="ds-body mt-1">Never an orange border.</p></DsSoftBox>
            <DsSoftBox tone="sand"><p className="ds-subheading">Warm sand box</p><p className="ds-body mt-1">Calm background block.</p></DsSoftBox>
            <DsSoftBox tone="gray"><p className="ds-subheading">Soft gray box</p><p className="ds-body mt-1">Section separation.</p></DsSoftBox>
          </div>
        </Section>

        <Section id="header" title="Public blue header">
          <div className="rounded-ds overflow-hidden border border-ds-border"><DsPublicHeader /></div>
        </Section>

        <Section id="modal" title="Modal, loading and empty states">
          <div className="grid gap-4 md:grid-cols-3">
            <DsCard>
              <p className="ds-subheading mb-3">Modal</p>
              <DsButton variant="secondary" onClick={() => setModal(true)}>Open modal</DsButton>
            </DsCard>
            <DsCard>
              <p className="ds-subheading mb-3">Loading</p>
              <DsLoading />
              <div className="mt-4 space-y-2"><DsSkeleton className="h-4 w-3/4" /><DsSkeleton className="h-4 w-1/2" /></div>
            </DsCard>
            <DsCard className="!p-0">
              <DsEmpty title="No trips yet" action={<DsButton size="sm">Request a ride</DsButton>}>Your upcoming rides will appear here.</DsEmpty>
            </DsCard>
          </div>
          <DsModal
            open={modal}
            onClose={() => setModal(false)}
            title="Cancel this ride?"
            footer={<><DsButton variant="ghost" onClick={() => setModal(false)}>Keep ride</DsButton><DsButton onClick={() => setModal(false)}>Cancel ride</DsButton></>}
          >
            The driver will be notified right away.
          </DsModal>
        </Section>

        <Section id="pattern" title="LinePattern — 9 fixed crop presets">
          <label className="ds-body inline-flex items-center gap-2 mb-4">
            <input type="checkbox" checked={reviewOpacity} onChange={(e) => setReviewOpacity(e.target.checked)} className="size-5" />
            Review mode: show at 25% so the crops are easy to see (production default is exactly 5%)
          </label>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(LINE_PATTERN_PRESETS) as LinePatternPreset[]).map((p, i) => {
              const blue = i === 4;
              return (
                <div key={p} className={`relative overflow-hidden rounded-ds h-44 p-5 ${blue ? "bg-ds-primary text-ds-on-primary" : i % 2 ? "bg-ds-subtle" : "bg-ds-surface border border-ds-border"}`}>
                  <LinePattern preset={p} tone={blue ? "light" : "dark"} opacity={patternOpacity} />
                  <div className="relative z-10">
                    <p className="ds-label">{p}</p>
                    <p className={blue ? "ds-caption !text-ds-on-primary opacity-80" : "ds-caption"}>Text always sits above the art.</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section id="contrast" title="Contrast results (WCAG 2.2)">
          <div className="overflow-x-auto rounded-ds border border-ds-border">
            <table className="w-full ds-body text-left">
              <thead className="bg-ds-subtle"><tr><th className="p-3 ds-label">Pair</th><th className="p-3 ds-label">Ratio</th><th className="p-3 ds-label">Result</th></tr></thead>
              <tbody>
                {CONTRAST.map(([a, b, c]) => (
                  <tr key={a} className="border-t border-ds-border"><td className="p-3">{a}</td><td className="p-3 font-semibold">{b}</td><td className="p-3">{c}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      {/* ------------------------------------------------ PORTAL */}
      <div className="theme-portal border-t border-ds-border">
        <div className="mx-auto max-w-6xl px-5 py-10">
          <h2 className="ds-page-title text-ds-primary">Portal design system</h2>
          <p className="ds-body-lg text-ds-text-2 mt-2 max-w-2xl">Quieter and businesslike: blue menu, gray page, white workspace, status colors only for real statuses. No patterns.</p>

          <div className="mt-8 rounded-ds overflow-hidden border border-ds-border flex flex-col md:flex-row bg-ds-bg min-h-[28rem]">
            <DsPortalMenu items={["Overview", "Trips", "Schedule", "Messages", "Training", "Settings"]} active="Trips" />
            <div className="flex-1 p-5 sm:p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="ds-section-title">Trips</h3>
                <DsButton size="sm">New trip</DsButton>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-ds bg-ds-sky p-4"><p className="ds-caption !text-ds-primary">Selected / info</p><p className="ds-subheading text-ds-primary">12 scheduled</p></div>
                <div className="rounded-ds bg-ds-green p-4"><p className="ds-caption !text-ds-success">Completed</p><p className="ds-subheading">48 this month</p></div>
                <div className="rounded-ds bg-ds-peach p-4"><p className="ds-caption !text-ds-warning">Pending / attention</p><p className="ds-subheading">3 need review</p></div>
              </div>
              <DsCard className="!p-0 shadow-ds">
                <table className="w-full ds-body text-left">
                  <thead><tr className="border-b border-ds-border"><th className="p-3 ds-label">Trip</th><th className="p-3 ds-label">Patient</th><th className="p-3 ds-label">Status</th></tr></thead>
                  <tbody>
                    {[["MFN-1042", "J. Rivera", "success", "Completed"], ["MFN-1043", "A. Chen", "pending", "Pending"], ["MFN-1044", "M. Brooks", "error", "Canceled"]].map(([t, p, s, l]) => (
                      <tr key={t} className="border-b border-ds-border last:border-0 ds-transition hover:bg-ds-hover">
                        <td className="p-3 font-semibold">{t}</td><td className="p-3">{p}</td>
                        <td className="p-3"><DsBadge status={s as "success" | "pending" | "error"}>{l}</DsBadge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DsCard>
              <DsAlert status="info" title="Portal alerts use the same components">Sample rows above are illustration only.</DsAlert>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
