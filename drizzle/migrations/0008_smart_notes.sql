CREATE TABLE public.workspace_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  creator_mfn_id text,
  workspace_mfn_id text,
  title text NOT NULL DEFAULT '' CHECK (char_length(title) <= 120),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 4000),
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private')),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workspace_notes_owner_idx ON public.workspace_notes(created_by, workspace_id);
GRANT SELECT, INSERT, UPDATE ON public.workspace_notes TO authenticated;
GRANT ALL ON public.workspace_notes TO service_role;
ALTER TABLE public.workspace_notes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_active_workspace_member(_ws uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members m JOIN public.workspaces w ON w.id = m.workspace_id
    WHERE m.workspace_id = _ws AND m.user_id = _uid AND w.status = 'active'
  )
$$;

CREATE POLICY "Creators read own notes" ON public.workspace_notes FOR SELECT TO authenticated
  USING (created_by = auth.uid() AND public.is_active_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Members create own notes" ON public.workspace_notes FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_active_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Creators update own notes" ON public.workspace_notes FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND public.is_active_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (created_by = auth.uid() AND public.is_active_workspace_member(workspace_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.workspace_notes_stamp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.creator_mfn_id := (SELECT mfn_id FROM public.user_profiles WHERE user_id = NEW.created_by);
    NEW.workspace_mfn_id := (SELECT mfn_id FROM public.workspaces WHERE id = NEW.workspace_id);
  ELSE
    NEW.id := OLD.id; NEW.workspace_id := OLD.workspace_id; NEW.created_by := OLD.created_by;
    NEW.creator_mfn_id := OLD.creator_mfn_id; NEW.workspace_mfn_id := OLD.workspace_mfn_id; NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER workspace_notes_stamp BEFORE INSERT OR UPDATE ON public.workspace_notes
  FOR EACH ROW EXECUTE FUNCTION public.workspace_notes_stamp();