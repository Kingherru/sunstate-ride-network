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

export function themeToCss(t: PlatformTheme) {
  return `:root{--background:${t.background_color};--foreground:${t.foreground_color};--card:${t.card_color};--card-foreground:${t.foreground_color};--popover:${t.card_color};--popover-foreground:${t.foreground_color};--primary:${t.primary_color};--primary-foreground:#ffffff;--secondary:#f1f5f9;--secondary-foreground:${t.primary_color};--muted:${t.muted_color};--muted-foreground:${t.muted_color};--accent:${t.accent_color};--accent-foreground:#ffffff;--border:${t.border_color};--input:${t.border_color};--ring:${t.primary_color};${radiusBlock(t.radius_scale)}}${t.custom_css ?? ""}`;
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
