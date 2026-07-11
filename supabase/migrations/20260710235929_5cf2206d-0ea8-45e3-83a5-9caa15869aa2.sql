
ALTER TABLE public.dispatch_zones
  ADD COLUMN IF NOT EXISTS is_preset boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_dispatch_zones_preset ON public.dispatch_zones(is_preset);

CREATE TABLE IF NOT EXISTS public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  price_cents integer NOT NULL DEFAULT 0,
  price_id text,
  duration_min integer NOT NULL DEFAULT 60,
  passing_score integer NOT NULL DEFAULT 80,
  cert_validity_months integer NOT NULL DEFAULT 12,
  cover_image text,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.courses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view published courses" ON public.courses
  FOR SELECT USING (is_published = true);
CREATE POLICY "Admins manage courses" ON public.courses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'));

CREATE TABLE IF NOT EXISTS public.course_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  ord integer NOT NULL,
  title text NOT NULL,
  body_markdown text NOT NULL DEFAULT '',
  video_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_course_modules_course ON public.course_modules(course_id, ord);
GRANT SELECT ON public.course_modules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_modules TO authenticated;
GRANT ALL ON public.course_modules TO service_role;
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone views modules of published courses" ON public.course_modules
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.is_published));
CREATE POLICY "Admins manage modules" ON public.course_modules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'));

CREATE TABLE IF NOT EXISTS public.course_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  stripe_session_id text,
  status text NOT NULL DEFAULT 'active',
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON public.course_enrollments(user_id);
GRANT SELECT, INSERT, UPDATE ON public.course_enrollments TO authenticated;
GRANT ALL ON public.course_enrollments TO service_role;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own enrollments" ON public.course_enrollments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all enrollments" ON public.course_enrollments
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.course_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  ord integer NOT NULL,
  prompt text NOT NULL,
  choices jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_index integer NOT NULL,
  explanation text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_course_questions_course ON public.course_questions(course_id, ord);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_questions TO authenticated;
GRANT ALL ON public.course_questions TO service_role;
ALTER TABLE public.course_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage questions" ON public.course_questions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'));
CREATE POLICY "Enrolled users read questions" ON public.course_questions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.course_enrollments e
    WHERE e.course_id = course_questions.course_id AND e.user_id = auth.uid()
  ));

CREATE TABLE IF NOT EXISTS public.course_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.course_enrollments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  score integer,
  passed boolean,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attempts_enrollment ON public.course_attempts(enrollment_id);
GRANT SELECT, INSERT ON public.course_attempts TO authenticated;
GRANT ALL ON public.course_attempts TO service_role;
ALTER TABLE public.course_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own attempts" ON public.course_attempts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.course_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.course_enrollments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  cert_number text NOT NULL UNIQUE,
  verify_token text NOT NULL UNIQUE,
  holder_name text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  pdf_storage_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_certs_user ON public.course_certificates(user_id);
GRANT SELECT ON public.course_certificates TO anon;
GRANT SELECT, INSERT ON public.course_certificates TO authenticated;
GRANT ALL ON public.course_certificates TO service_role;
ALTER TABLE public.course_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own certs" ON public.course_certificates
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Public can look up certs" ON public.course_certificates
  FOR SELECT TO anon USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_courses_updated ON public.courses;
CREATE TRIGGER trg_courses_updated BEFORE UPDATE ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_enrollments_updated ON public.course_enrollments;
CREATE TRIGGER trg_enrollments_updated BEFORE UPDATE ON public.course_enrollments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
