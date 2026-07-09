import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PlatformTheme {
  id?: string;
  primary_color: string;
  accent_color: string;
  background_color: string;
  foreground_color: string;
  card_color: string;
  muted_color: string;
  border_color: string;
  layout_style: "standard" | "compact" | "wide";
  header_style: "classic" | "minimal" | "split";
  footer_style: "expanded" | "compact" | "minimal";
  card_style: "rounded" | "sharp" | "soft";
  radius_scale: "small" | "medium" | "large";
  custom_css?: string | null;
  // Provider portal overrides (also reused by forms)
  portal_primary_color?: string | null;
  portal_accent_color?: string | null;
  portal_background_color?: string | null;
  portal_card_color?: string | null;
  portal_foreground_color?: string | null;
  portal_border_color?: string | null;
  // Form overrides (default to portal colors if blank)
  form_primary_color?: string | null;
  form_accent_color?: string | null;
}

export const DEFAULT_THEME: PlatformTheme = {
  primary_color: "#13335a",
  accent_color: "#e07a1f",
  background_color: "#ffffff",
  foreground_color: "#0f172a",
  card_color: "#ffffff",
  muted_color: "#64748b",
  border_color: "#e2e8f0",
  layout_style: "standard",
  header_style: "classic",
  footer_style: "expanded",
  card_style: "rounded",
  radius_scale: "medium",
  custom_css: null,
  portal_primary_color: "#1D3557",
  portal_accent_color: "#F9CB9F",
  portal_background_color: "#0f1f33",
  portal_card_color: "#16294099",
  portal_foreground_color: "#f5f7fa",
  portal_border_color: "#ffffff1f",
  form_primary_color: null,
  form_accent_color: null,
};

function radiusBlock(scale: PlatformTheme["radius_scale"]) {
  switch (scale) {
    case "small":
      return "--radius-sm:2px;--radius-md:4px;--radius-lg:8px;--radius-xl:12px;--radius-2xl:16px;";
    case "large":
      return "--radius-sm:8px;--radius-md:14px;--radius-lg:22px;--radius-xl:32px;--radius-2xl:44px;";
    default:
      return "--radius-sm:4px;--radius-md:8px;--radius-lg:14px;--radius-xl:20px;--radius-2xl:28px;";
  }
}

function readableOn(hex: string): string {
  const h = (hex || "").replace("#", "").slice(0, 6);
  if (h.length !== 6) return "#ffffff";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const toLin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
  return L > 0.5 ? "#0f172a" : "#ffffff";
}

export function themeToCss(t: PlatformTheme) {
  const root = `:root{--background:${t.background_color};--foreground:${t.foreground_color};--card:${t.card_color};--card-foreground:${t.foreground_color};--popover:${t.card_color};--popover-foreground:${t.foreground_color};--primary:${t.primary_color};--primary-foreground:${readableOn(t.primary_color)};--secondary:#f1f5f9;--secondary-foreground:${t.primary_color};--muted:${t.muted_color};--muted-foreground:${t.muted_color};--accent:${t.accent_color};--accent-foreground:${readableOn(t.accent_color)};--border:${t.border_color};--input:${t.border_color};--ring:${t.primary_color};${radiusBlock(t.radius_scale)}}`;

  const pPrimary = t.portal_primary_color || t.primary_color;
  const pAccent = t.portal_accent_color || t.accent_color;
  const pBg = t.portal_background_color || "#0f1f33";
  const pCard = t.portal_card_color || "#16294099";
  const pFg = t.portal_foreground_color || "#f5f7fa";
  const pBorder = t.portal_border_color || "#ffffff1f";
  const pPrimaryFg = readableOn(pPrimary);
  const pAccentFg = readableOn(pAccent);
  const pCardFg = readableOn(pCard);

  const portal = `.portal-scope{--background:${pBg};--foreground:${pFg};--card:${pCard};--card-foreground:${pCardFg};--popover:${pCard};--popover-foreground:${pCardFg};--primary:${pAccent};--primary-foreground:${pAccentFg};--secondary:${pPrimary};--secondary-foreground:${pPrimaryFg};--muted:${pCard};--muted-foreground:${pCardFg}b3;--accent:${pAccent};--accent-foreground:${pAccentFg};--border:${pBorder};--input:${pBorder};--ring:${pAccent};--brand:${pFg};--sidebar:${pPrimary};--sidebar-foreground:${pPrimaryFg};--sidebar-primary:${pAccent};--sidebar-primary-foreground:${pAccentFg};--sidebar-accent:${pAccent}33;--sidebar-accent-foreground:${pPrimaryFg};--sidebar-border:${pBorder};--sidebar-ring:${pAccent};}`;

  const fPrimary = t.form_primary_color || pPrimary;
  const fAccent = t.form_accent_color || pAccent;
  const fAccentFg = readableOn(fAccent);
  // Apply form colors to inputs/selects/textareas + buttons inside forms across the app
  const forms = `form input:not([type=checkbox]):not([type=radio]):not([type=color]):not([type=range]):focus-visible,form select:focus-visible,form textarea:focus-visible{border-color:${fAccent} !important;box-shadow:0 0 0 3px ${fAccent}40 !important;outline:none;}form button[type=submit]{background:${fAccent} !important;color:${fAccentFg} !important;border-color:${fAccent} !important;}form .form-accent{color:${fAccent} !important;}form label{color:${fPrimary};}`;

  return root + portal + forms + (t.custom_css ?? "");
}


export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [css, setCss] = useState<string>("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from("platform_theme")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!alive) return;
        if (data) setCss(themeToCss({ ...DEFAULT_THEME, ...data }));
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
      {children}
    </>
  );
}
