import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { verifyCertificate } from "@/lib/courses.functions";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { CheckCircle2, XCircle, ShieldCheck } from "lucide-react";

const qo = (token: string) => queryOptions({ queryKey: ["verify", token], queryFn: () => verifyCertificate({ data: { token } }) });

export const Route = createFileRoute("/verify/$token")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(qo(params.token)),
  head: () => ({
    meta: [
      { title: "Verify Certificate | My Florida NEMT" },
      { name: "description", content: "Verify a My Florida NEMT training certificate." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Verify,
});

function Verify() {
  const { token } = Route.useParams();
  const { data } = useSuspenseQuery(qo(token));
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 max-w-xl mx-auto px-4 py-16">
        <div className="border border-border rounded-lg p-8 text-center bg-card">
          <ShieldCheck className="w-12 h-12 mx-auto text-primary mb-3" />
          <h1 className="text-2xl font-extrabold mb-6">Certificate Verification</h1>
          {!data ? (
            <div className="flex flex-col items-center gap-2 text-destructive">
              <XCircle className="w-10 h-10" />
              <p>No certificate found for this link.</p>
            </div>
          ) : (
            <div className="text-left space-y-3">
              <Row label="Status" value={
                <span className={data.valid ? "text-primary flex items-center gap-1" : "text-destructive flex items-center gap-1"}>
                  {data.valid ? <><CheckCircle2 className="w-4 h-4" />Valid</> : <><XCircle className="w-4 h-4" />Expired</>}
                </span>
              } />
              <Row label="Holder" value={data.holder_name} />
              <Row label="Course" value={data.course_title} />
              <Row label="Certificate #" value={data.cert_number} />
              <Row label="Issued" value={new Date(data.issued_at).toLocaleDateString()} />
              {data.expires_at && <Row label="Expires" value={new Date(data.expires_at).toLocaleDateString()} />}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-border pb-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
