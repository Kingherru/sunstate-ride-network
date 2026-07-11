import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type Course = Database["public"]["Tables"]["courses"]["Row"];
type Module = Database["public"]["Tables"]["course_modules"]["Row"];

function publicClient() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

// ---------- Public catalog ----------

export const listPublicCourses = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await sb
    .from("courses")
    .select("id,slug,title,summary,description,price_cents,duration_min,passing_score,cert_validity_months,cover_image,is_published")
    .eq("is_published", true)
    .order("price_cents", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getPublicCourse = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: course } = await sb
      .from("courses")
      .select("id,slug,title,summary,description,price_cents,price_id,duration_min,passing_score,cert_validity_months,cover_image,is_published")
      .eq("slug", data.slug)
      .eq("is_published", true)
      .maybeSingle();
    if (!course) return null;
    const { data: modules } = await sb
      .from("course_modules")
      .select("id,ord,title")
      .eq("course_id", course.id)
      .order("ord");
    const { count } = await sb
      .from("course_questions")
      .select("*", { head: true, count: "exact" })
      .eq("course_id", course.id);
    return { course, modules: modules ?? [], question_count: count ?? 0 };
  });

// ---------- Enrolled learner ----------

export const listMyEnrollments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("course_enrollments")
      .select("id,course_id,status,progress,purchased_at,completed_at,courses!inner(slug,title,summary,cover_image,duration_min)")
      .eq("user_id", userId)
      .order("purchased_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getMyCoursePlayer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: course } = await supabase
      .from("courses")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!course) throw new Error("Course not found");
    const { data: enrollment } = await supabase
      .from("course_enrollments")
      .select("*")
      .eq("user_id", userId)
      .eq("course_id", course.id)
      .maybeSingle();
    if (!enrollment) throw new Error("You are not enrolled in this course.");
    const { data: modules } = await supabase
      .from("course_modules")
      .select("*")
      .eq("course_id", course.id)
      .order("ord");
    const { data: rawQuestions } = await supabase
      .from("course_questions")
      .select("id,ord,prompt,choices")
      .eq("course_id", course.id)
      .order("ord");
    const { data: cert } = await supabase
      .from("course_certificates")
      .select("id,cert_number,verify_token,issued_at,expires_at,holder_name")
      .eq("enrollment_id", enrollment.id)
      .maybeSingle();
    return { course, enrollment, modules: modules ?? [], questions: rawQuestions ?? [], certificate: cert };
  });

// ---------- Enrollment creation (fallback from return page) ----------

function randomToken(len = 24) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function issueCertificate(
  admin: ReturnType<typeof createClient<Database>>,
  args: { enrollment_id: string; user_id: string; course_id: string; holder_name: string; validity_months: number },
) {
  const existing = await admin
    .from("course_certificates")
    .select("id,cert_number,verify_token")
    .eq("enrollment_id", args.enrollment_id)
    .maybeSingle();
  if (existing.data) return existing.data;
  const cert_number = `CERT-${new Date().getFullYear()}-${randomToken(4).toUpperCase()}`;
  const verify_token = randomToken(16);
  const expires_at = new Date();
  expires_at.setMonth(expires_at.getMonth() + args.validity_months);
  const inserted = await admin
    .from("course_certificates")
    .insert({
      enrollment_id: args.enrollment_id,
      user_id: args.user_id,
      course_id: args.course_id,
      cert_number,
      verify_token,
      holder_name: args.holder_name,
      expires_at: expires_at.toISOString(),
    })
    .select("id,cert_number,verify_token")
    .single();
  if (inserted.error) throw new Error(inserted.error.message);
  return inserted.data;
}

export const claimEnrollmentFromSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sessionId: string; slug: string }) => d)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: course } = await supabaseAdmin.from("courses").select("id").eq("slug", data.slug).maybeSingle();
    if (!course) throw new Error("Course not found");
    const { error } = await supabaseAdmin
      .from("course_enrollments")
      .upsert(
        { user_id: userId, course_id: course.id, stripe_session_id: data.sessionId, status: "active" },
        { onConflict: "user_id,course_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Exam submission ----------

export const submitAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { enrollmentId: string; answers: Record<string, number>; holderName?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const { data: enrollment } = await supabase
      .from("course_enrollments")
      .select("id,course_id,status,user_id")
      .eq("id", data.enrollmentId)
      .maybeSingle();
    if (!enrollment || enrollment.user_id !== userId) throw new Error("Enrollment not found");

    const { data: course } = await supabase
      .from("courses")
      .select("id,slug,title,passing_score,cert_validity_months")
      .eq("id", enrollment.course_id)
      .single();

    const { data: questions } = await supabase
      .from("course_questions")
      .select("id,correct_index")
      .eq("course_id", enrollment.course_id);

    if (!questions?.length) throw new Error("This course has no exam questions yet.");

    let correct = 0;
    for (const q of questions) {
      if (data.answers[q.id] === q.correct_index) correct++;
    }
    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= (course?.passing_score ?? 80);

    await supabase.from("course_attempts").insert({
      enrollment_id: enrollment.id,
      user_id: userId,
      submitted_at: new Date().toISOString(),
      score,
      passed,
      answers: data.answers,
    });

    let certificate: { id: string; cert_number: string; verify_token: string } | null = null;
    if (passed && course) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("course_enrollments")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", enrollment.id);
      const holder =
        data.holderName?.trim() ||
        (claims as { email?: string; user_metadata?: { full_name?: string } })?.user_metadata?.full_name ||
        (claims as { email?: string })?.email ||
        "Learner";
      certificate = await issueCertificate(supabaseAdmin, {
        enrollment_id: enrollment.id,
        user_id: userId,
        course_id: enrollment.course_id,
        holder_name: holder,
        validity_months: course.cert_validity_months,
      });
    }
    return { score, passed, correct, total: questions.length, certificate };
  });

// ---------- Certificate PDF ----------

async function renderCertificatePdf(args: {
  holder_name: string; course_title: string; cert_number: string; issued_at: string; expires_at?: string | null; verify_url: string;
}) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const page = doc.addPage([792, 612]); // landscape US Letter
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const draw = (t: string, x: number, y: number, size: number, f = font, color = rgb(0.1, 0.15, 0.3)) =>
    page.drawText(t, { x, y, size, font: f, color });

  // Frame
  page.drawRectangle({ x: 20, y: 20, width: 752, height: 572, borderColor: rgb(0.05, 0.1, 0.25), borderWidth: 3 });
  page.drawRectangle({ x: 30, y: 30, width: 732, height: 552, borderColor: rgb(0.9, 0.5, 0.15), borderWidth: 1 });

  draw("MyFloridaNemt.com", 300, 540, 20, bold, rgb(0.05, 0.1, 0.25));
  draw("Certificate of Completion", 220, 490, 30, bold);
  draw("This certifies that", 320, 430, 14);
  draw(args.holder_name, 396 - (args.holder_name.length * 6), 390, 28, bold);
  draw("has successfully completed", 290, 340, 14);
  draw(args.course_title, 396 - (args.course_title.length * 6), 305, 22, bold);

  draw(`Certificate #: ${args.cert_number}`, 60, 120, 11);
  draw(`Issued: ${new Date(args.issued_at).toLocaleDateString()}`, 60, 100, 11);
  if (args.expires_at) draw(`Expires: ${new Date(args.expires_at).toLocaleDateString()}`, 60, 80, 11);
  draw(`Verify: ${args.verify_url}`, 60, 60, 10, font, rgb(0.4, 0.4, 0.4));

  const bytes = await doc.save();
  return Buffer.from(bytes).toString("base64");
}

export const downloadMyCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { certificateId: string; origin: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cert } = await supabase
      .from("course_certificates")
      .select("id,user_id,cert_number,verify_token,holder_name,issued_at,expires_at,courses!inner(title)")
      .eq("id", data.certificateId)
      .maybeSingle();
    if (!cert || cert.user_id !== userId) throw new Error("Certificate not found");
    const pdfBase64 = await renderCertificatePdf({
      holder_name: cert.holder_name,
      course_title: (cert.courses as { title: string }).title,
      cert_number: cert.cert_number,
      issued_at: cert.issued_at,
      expires_at: cert.expires_at,
      verify_url: `${data.origin}/verify/${cert.verify_token}`,
    });
    return { pdfBase64, filename: `${cert.cert_number}.pdf` };
  });

// ---------- Public verification ----------

export const verifyCertificate = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: cert } = await sb
      .from("course_certificates")
      .select("cert_number,holder_name,issued_at,expires_at,courses!inner(title,slug)")
      .eq("verify_token", data.token)
      .maybeSingle();
    if (!cert) return null;
    return {
      cert_number: cert.cert_number,
      holder_name: cert.holder_name,
      issued_at: cert.issued_at,
      expires_at: cert.expires_at,
      course_title: (cert.courses as { title: string }).title,
      valid: !cert.expires_at || new Date(cert.expires_at) > new Date(),
    };
  });
