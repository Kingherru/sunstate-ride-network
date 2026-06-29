import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Floating button to hard-refresh the preview when changes don't appear.
 * Renders only after mount to avoid SSR/CSR hydration mismatches.
 */
export function PreviewRefreshButton() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const host = window.location.hostname;
    const isPreview =
      host === "localhost" ||
      host.startsWith("127.") ||
      host.includes("lovable.app") ||
      host.includes("lovableproject.com");
    setShow(isPreview);
  }, []);

  if (!show) return null;

  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      aria-label="Refresh preview"
      title="Refresh preview"
      className="fixed bottom-4 right-4 z-[60] inline-flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 text-xs font-bold uppercase tracking-wider shadow-elegant hover:bg-accent transition-colors"
    >
      <RefreshCw className="size-4" />
      Refresh
    </button>
  );
}
