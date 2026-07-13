# Provider-docs upload — folder ownership E2E

Verifies the `storage.objects` INSERT policy `Authenticated users upload
provider-docs applications` on the `provider-docs` bucket only allows the
signed-in user to write under `applications/<their auth.uid()>/…`.

Assertions
----------

1. **Own folder** — upload to `applications/<uid>/…` returns HTTP 200.
2. **Someone else's folder** — upload to `applications/<random-uuid>/…`
   is rejected (HTTP 400/403, RLS "new row violates row-level security
   policy").
3. **Wrong top-level prefix** — upload to `credentials/<uid>/…` under this
   policy path is rejected because the policy pins
   `(storage.foldername(name))[1] = 'applications'`.
4. **Missing user segment** — upload to `applications/foo.txt` (no user
   folder) is rejected.

Own-folder uploads are cleaned up at the end.

Run
---

1. Sign in as any user in the Lovable preview (any role — the policy is
   generic across authenticated users).
2. From the sandbox shell:

   ```bash
   python3 tests/e2e/provider-docs-upload/run.py
   ```

Exits non-zero on any assertion failure.
