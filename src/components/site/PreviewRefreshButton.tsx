import { RefreshCw } from "lucide-react";

/**
 * Small floating button to hard-refresh the preview when changes don't appear.
 * Visible only on dev/preview hosts (localhost or *.lovable.app preview URLs).
 */
export function PreviewRefreshButton() {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname;
  const isPreview =
    host === "localhost" ||
    host.startsWith("127.") ||
    host.includes("lovable.app") ||
    host.includes("lovableproject.com");
  if (!isPreview) return null;

  return (
    <button
      type="button"
      onClick={() => {
        // Bypass cache on reload.
        window.location.reload();
      }}
      aria-label="Refresh preview"
      title="Refresh preview"
      className="fixed bottom-4 right-4 z-[60] inline-flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 text-xs font-bold uppercase tracking-wider shadow-elegant hover:bg-accent transition-colors"
    >
      <RefreshCw className="size-4" />
      Refresh
    </button>
  );
}
