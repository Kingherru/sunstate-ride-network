import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_THEME, PlatformTheme, themeToCss } from "@/components/ThemeProvider";

const LAYOUTS: PlatformTheme["layout_style"][] = ["standard", "compact", "wide"];
const HEADERS: PlatformTheme["header_style"][] = ["classic", "minimal", "split"];
const FOOTERS: PlatformTheme["footer_style"][] = ["expanded", "compact", "minimal"];
const CARDS: PlatformTheme["card_style"][] = ["rounded", "sharp", "soft"];
const RADII: PlatformTheme["radius_scale"][] = ["small", "medium", "large"];

const PRESETS: Array<{ name: string; primary: string; accent: string }> = [
  { name: "Navy + Orange", primary: "#13335a", accent: "#e07a1f" },
  { name: "Navy + Peach", primary: "#1D3557", accent: "#F9CB9F" },
  { name: "Emerald + Gold", primary: "#064e3b", accent: "#c9a84c" },
  { name: "Slate + Coral", primary: "#1e293b", accent: "#ff6b6b" },
  { name: "Indigo + Cyan", primary: "#4338ca", accent: "#06b6d4" },
  { name: "Charcoal + Lime", primary: "#1f2937", accent: "#84cc16" },
  { name: "Royal + Magenta", primary: "#1e3a8a", accent: "#d946ef" },
];

const PORTAL_PRESETS: Array<{ name: string; primary: string; accent: string; bg: string; card: string; fg: string; border: string }> = [
  { name: "Navy + Peach", primary: "#1D3557", accent: "#F9CB9F", bg: "#0f1f33", card: "#16294099", fg: "#f5f7fa", border: "#ffffff1f" },
  { name: "Charcoal + Lime", primary: "#1f2937", accent: "#84cc16", bg: "#0b1220", card: "#1f293799", fg: "#f8fafc", border: "#ffffff1a" },
  { name: "Midnight + Cyan", primary: "#0a0a1a", accent: "#06b6d4", bg: "#0a0a1a", card: "#14143299", fg: "#e8ecf1", border: "#ffffff14" },
  { name: "Emerald + Gold", primary: "#064e3b", accent: "#c9a84c", bg: "#06281f", card: "#0d7a5f55", fg: "#f5f0e0", border: "#ffffff1f" },
];


export function AdminThemePanel() {
  const [theme, setTheme] = useState<PlatformTheme>(DEFAULT_THEME);
  const [id, setId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [livePreview, setLivePreview] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("platform_theme")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setTheme({ ...DEFAULT_THEME, ...data });
        setId(data.id);
      }
    })();
  }, []);

  useEffect(() => {
    if (!livePreview) return;
    const el = document.createElement("style");
    el.setAttribute("data-theme-preview", "true");
    el.innerHTML = themeToCss(theme);
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, [theme, livePreview]);

  function update<K extends keyof PlatformTheme>(key: K, value: PlatformTheme[K]) {
    setTheme((t) => ({ ...t, [key]: value }));
  }

  async function save() {
    setBusy(true);
    try {
      if (id) {
        const { error } = await (supabase as any)
          .from("platform_theme")
          .update(theme)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any)
          .from("platform_theme")
          .insert({ ...theme, is_active: true })
          .select()
          .single();
        if (error) throw error;
        setId(data.id);
      }
      toast.success("Theme saved. Refresh other tabs to see changes.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save theme");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setTheme(DEFAULT_THEME);
  }

  const colorFields: Array<[keyof PlatformTheme, string]> = [
    ["primary_color", "Primary"],
    ["accent_color", "Accent"],
    ["background_color", "Background"],
    ["foreground_color", "Text"],
    ["card_color", "Card"],
    ["muted_color", "Muted"],
    ["border_color", "Border"],
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Visual settings</h2>
          <p className="text-sm text-muted">Site-wide theme. Applies to every page and portal.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={livePreview}
              onChange={(e) => setLivePreview(e.target.checked)}
            />
            Live preview
          </label>
          <button onClick={reset} className="px-3 py-2 text-sm border border-input rounded-md">
            Reset
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="px-4 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-md disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save theme"}
          </button>
        </div>
      </header>

      <section>
        <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-muted mb-3">
          Color presets
        </h3>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() =>
                setTheme((t) => ({ ...t, primary_color: p.primary, accent_color: p.accent }))
              }
              className="flex items-center gap-2 px-3 py-2 border border-input rounded-md text-sm hover:bg-secondary"
            >
              <span className="inline-block size-4 rounded-full" style={{ background: p.primary }} />
              <span className="inline-block size-4 rounded-full" style={{ background: p.accent }} />
              {p.name}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-muted mb-3">
          Colors
        </h3>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {colorFields.map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 p-3 border border-border rounded-md bg-card text-card-foreground">
              <input
                type="color"
                value={String(theme[key] ?? "#000000")}
                onChange={(e) => update(key, e.target.value as never)}
                className="size-10 rounded cursor-pointer border border-border bg-transparent"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-foreground">{label}</div>
                <input
                  type="text"
                  value={String(theme[key] ?? "")}
                  onChange={(e) => update(key, e.target.value as never)}
                  className="w-full font-mono text-xs bg-background text-foreground border border-input rounded px-2 py-1 mt-1 outline-none focus:border-ring"
                />
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* ====== PROVIDER PORTAL COLORS ====== */}
      <section className="p-5 border-2 border-border rounded-lg bg-card space-y-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-base font-extrabold tracking-tight">Provider portal colors</h3>
            <p className="text-xs text-muted">Applied inside every signed-in portal (provider, patient, facility) and to forms.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {PORTAL_PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() =>
                  setTheme((t) => ({
                    ...t,
                    portal_primary_color: p.primary,
                    portal_accent_color: p.accent,
                    portal_background_color: p.bg,
                    portal_card_color: p.card,
                    portal_foreground_color: p.fg,
                    portal_border_color: p.border,
                  }))
                }
                className="flex items-center gap-2 px-3 py-1.5 border border-input rounded-md text-xs hover:bg-secondary"
              >
                <span className="inline-block size-3 rounded-full" style={{ background: p.primary }} />
                <span className="inline-block size-3 rounded-full" style={{ background: p.accent }} />
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          {([
            ["portal_primary_color", "Portal primary"],
            ["portal_accent_color", "Portal accent (buttons)"],
            ["portal_background_color", "Portal background"],
            ["portal_card_color", "Portal card surface"],
            ["portal_foreground_color", "Portal text"],
            ["portal_border_color", "Portal border"],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 p-3 border border-border rounded-md bg-background text-foreground">
              <input
                type="color"
                value={String(theme[key] ?? "#000000").slice(0, 7)}
                onChange={(e) => update(key, e.target.value as never)}
                className="size-9 rounded cursor-pointer border border-border bg-transparent"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-foreground">{label}</div>
                <input
                  type="text"
                  value={String(theme[key] ?? "")}
                  onChange={(e) => update(key, e.target.value as never)}
                  className="w-full font-mono text-xs bg-card text-foreground border border-input rounded px-2 py-1 mt-1 outline-none focus:border-ring"
                />
              </div>
            </label>
          ))}
        </div>

        {/* Mini preview */}
        <div
          className="mt-2 p-5 rounded-lg border"
          style={{
            background: theme.portal_background_color || "#0f1f33",
            color: theme.portal_foreground_color || "#f5f7fa",
            borderColor: theme.portal_border_color || "#ffffff1f",
          }}
        >
          <div className="text-xs uppercase tracking-widest opacity-70 mb-2">Portal preview</div>
          <div className="flex flex-wrap gap-3 items-center">
            <button
              className="px-4 py-2 rounded-md font-bold text-sm"
              style={{ background: theme.portal_accent_color || "#F9CB9F", color: theme.portal_primary_color || "#1D3557" }}
            >
              Primary action
            </button>
            <span
              className="px-3 py-2 rounded-md text-sm"
              style={{ background: theme.portal_card_color || "#16294099", border: `1px solid ${theme.portal_border_color || "#ffffff1f"}` }}
            >
              Card surface
            </span>
            <input
              placeholder="Form input"
              className="px-3 py-2 rounded-md text-sm bg-transparent border outline-none"
              style={{ borderColor: theme.portal_border_color || "#ffffff1f", color: theme.portal_foreground_color || "#f5f7fa" }}
            />
          </div>
        </div>
      </section>

      {/* ====== FORM COLORS (override; defaults to portal) ====== */}
      <section className="p-5 border-2 border-border rounded-lg bg-card space-y-3">
        <div>
          <h3 className="text-base font-extrabold tracking-tight">Form colors</h3>
          <p className="text-xs text-muted">
            Applied to every &lt;form&gt; on the site. Leave blank to reuse the portal colors above.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {([
            ["form_primary_color", "Form label / text accent"],
            ["form_accent_color", "Form focus & submit"],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 p-3 border border-border rounded-md bg-background">
              <input
                type="color"
                value={String(theme[key] ?? theme.portal_accent_color ?? "#000000").slice(0, 7)}
                onChange={(e) => update(key, e.target.value as never)}
                className="size-9 rounded cursor-pointer border-0 bg-transparent"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold">{label}</div>
                <input
                  type="text"
                  placeholder="(inherits portal)"
                  value={String(theme[key] ?? "")}
                  onChange={(e) => update(key, (e.target.value || null) as never)}
                  className="w-full font-mono text-xs bg-transparent outline-none"
                />
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {([
          ["Layout", "layout_style", LAYOUTS],
          ["Header", "header_style", HEADERS],
          ["Footer", "footer_style", FOOTERS],
          ["Cards", "card_style", CARDS],
          ["Radius", "radius_scale", RADII],
        ] as const).map(([label, key, options]) => (

          <div key={key} className="p-4 border border-border rounded-md bg-card">
            <div className="text-xs font-mono font-bold uppercase tracking-widest text-muted mb-2">
              {label}
            </div>
            <div className="flex flex-wrap gap-1">
              {options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => update(key, opt as never)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md border ${
                    theme[key] === opt
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-input hover:bg-secondary"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section>
        <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-muted mb-3">
          Custom CSS (advanced)
        </h3>
        <textarea
          value={theme.custom_css ?? ""}
          onChange={(e) => update("custom_css", e.target.value)}
          rows={5}
          placeholder=":root { --ring: #ff0000; }"
          className="w-full font-mono text-xs bg-card border border-input rounded-md p-3"
        />
      </section>

      <section className="p-6 border border-border rounded-lg bg-card space-y-4">
        <h3 className="text-sm font-bold">Live sample</h3>
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-bold text-sm">
            Primary button
          </button>
          <button className="px-4 py-2 rounded-md bg-accent text-accent-foreground font-bold text-sm">
            Accent button
          </button>
          <button className="px-4 py-2 rounded-md border border-input text-sm">Outline</button>
          <span className="px-3 py-2 rounded-md bg-secondary text-secondary-foreground text-sm">
            Secondary chip
          </span>
        </div>
        <p className="text-sm">
          Body text in <span className="text-primary font-bold">primary</span> and{" "}
          <span className="text-accent font-bold">accent</span>. Muted:{" "}
          <span className="text-muted">helper copy.</span>
        </p>
      </section>
    </div>
  );
}
