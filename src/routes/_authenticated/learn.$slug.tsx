import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getMyCoursePlayer, submitAttempt, downloadMyCertificate } from "@/lib/courses.functions";
import { Button } from "@/components/ui/button";
import { Award, ArrowLeft, ArrowRight, CheckCircle2, XCircle, Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/learn/$slug")({
  head: () => ({ meta: [{ title: "Course Player | My Florida NEMT" }, { name: "robots", content: "noindex" }] }),
  component: Player,
});

function Player() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["course-player", slug], queryFn: () => getMyCoursePlayer({ data: { slug } }) });
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ score: number; passed: boolean; correct: number; total: number } | null>(null);

  const submit = useMutation({
    mutationFn: async (holderName: string) => {
      if (!data) throw new Error();
      const r = await submitAttempt({ data: { enrollmentId: data.enrollment.id, answers, holderName } });
      return r;
    },
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries({ queryKey: ["course-player", slug] });
      qc.invalidateQueries({ queryKey: ["my-enrollments"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to submit"),
  });

  const downloadCert = useMutation({
    mutationFn: async (certId: string) => downloadMyCertificate({ data: { certificateId: certId, origin: window.location.origin } }),
    onSuccess: (r) => {
      const blob = new Blob([Uint8Array.from(atob(r.pdfBase64), (c) => c.charCodeAt(0))], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = r.filename; a.click();
      URL.revokeObjectURL(url);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to download certificate"),
  });

  if (isLoading) return <div className="max-w-3xl mx-auto p-10">Loading…</div>;
  if (error || !data) return <div className="max-w-3xl mx-auto p-10 text-destructive">{(error as any)?.message ?? "Unable to load course."}</div>;

  const { course, modules, questions, enrollment, certificate } = data;
  const totalSteps = modules.length + 1; // modules + exam
  const isExam = step >= modules.length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link to="/learn" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"><ArrowLeft className="w-4 h-4" />My Courses</Link>
      <h1 className="text-2xl md:text-3xl font-extrabold mb-2">{course.title}</h1>
      <div className="text-sm text-muted-foreground mb-6">Step {step + 1} of {totalSteps}</div>

      {enrollment.status === "completed" && certificate ? (
        <div className="border border-primary/40 bg-primary/5 rounded-lg p-6 mb-6">
          <div className="flex items-center gap-2 mb-2"><Award className="w-6 h-6 text-primary" /><h2 className="text-xl font-bold">Certificate issued</h2></div>
          <p className="text-sm text-muted-foreground mb-1">Certificate #: <span className="font-mono">{certificate.cert_number}</span></p>
          <p className="text-sm text-muted-foreground mb-4">Holder: {certificate.holder_name}</p>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => downloadCert.mutate(certificate.id)} disabled={downloadCert.isPending}><Download className="w-4 h-4 mr-1" />{downloadCert.isPending ? "Preparing…" : "Download PDF"}</Button>
            <Button asChild variant="outline"><Link to="/verify/$token" params={{ token: certificate.verify_token }}>Public verify link</Link></Button>
          </div>
        </div>
      ) : null}

      {!isExam ? (
        <article className="border border-border rounded-lg p-6 bg-card mb-6">
          <h2 className="text-xl font-bold mb-3">{modules[step].title}</h2>
          <div className="prose prose-sm max-w-none whitespace-pre-line">{modules[step].body_markdown}</div>
        </article>
      ) : result ? (
        <div className={`border rounded-lg p-6 mb-6 ${result.passed ? "border-primary/40 bg-primary/5" : "border-destructive/40 bg-destructive/5"}`}>
          <div className="flex items-center gap-2 mb-2">
            {result.passed ? <CheckCircle2 className="w-6 h-6 text-primary" /> : <XCircle className="w-6 h-6 text-destructive" />}
            <h2 className="text-xl font-bold">{result.passed ? "You passed!" : "Not quite — try again"}</h2>
          </div>
          <p>Score: {result.score}% ({result.correct}/{result.total})</p>
          {result.passed ? (
            <p className="text-sm text-muted-foreground mt-2">Your certificate is being issued — refresh this page to download it.</p>
          ) : (
            <Button className="mt-4" onClick={() => { setResult(null); setAnswers({}); }}>Retake exam</Button>
          )}
        </div>
      ) : (
        <ExamForm
          questions={questions}
          answers={answers}
          setAnswers={setAnswers}
          onSubmit={(name) => submit.mutate(name)}
          submitting={submit.isPending}
        />
      )}

      {!isExam && (
        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}><ArrowLeft className="w-4 h-4 mr-1" />Previous</Button>
          <Button onClick={() => setStep((s) => Math.min(totalSteps - 1, s + 1))}>{step === modules.length - 1 ? "Take exam" : "Next"} <ArrowRight className="w-4 h-4 ml-1" /></Button>
        </div>
      )}
    </div>
  );
}

function ExamForm({
  questions, answers, setAnswers, onSubmit, submitting,
}: {
  questions: { id: string; ord: number; prompt: string; choices: any }[];
  answers: Record<string, number>;
  setAnswers: (a: Record<string, number>) => void;
  onSubmit: (name: string) => void;
  submitting: boolean;
}) {
  const [name, setName] = useState("");
  const allAnswered = questions.every((q) => typeof answers[q.id] === "number");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(name); }} className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-1">Name to appear on certificate</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-border rounded-md px-3 py-2 bg-background"
          placeholder="Your full name"
        />
      </div>
      {questions.map((q, i) => {
        const choices = Array.isArray(q.choices) ? (q.choices as string[]) : [];
        return (
          <fieldset key={q.id} className="border border-border rounded-lg p-4">
            <legend className="font-semibold px-1">{i + 1}. {q.prompt}</legend>
            <div className="space-y-2 mt-2">
              {choices.map((c, ci) => (
                <label key={ci} className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === ci}
                    onChange={() => setAnswers({ ...answers, [q.id]: ci })}
                    className="mt-1"
                  />
                  <span>{c}</span>
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
      <Button type="submit" disabled={!allAnswered || !name.trim() || submitting} className="w-full">
        {submitting ? "Submitting…" : "Submit exam"}
      </Button>
    </form>
  );
}
