import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MedicaidSubmissionCenter } from "@/components/dashboard/MedicaidSubmissionCenter";

export const Route = createFileRoute("/_authenticated/provider/medicaid")({
  head: () => ({
    meta: [
      { title: "Medicaid Submission Center — Florida NEMT" },
      { name: "description", content: "Prepare Medicaid packets, save billing contacts, upload trip logs, and track submissions." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MedicaidCenterPage,
});

function MedicaidCenterPage() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);
  if (!userId) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  return (
    <div className="portal-scope max-w-6xl mx-auto p-6 md:p-10">
      <MedicaidSubmissionCenter userId={userId} />
    </div>
  );
}
