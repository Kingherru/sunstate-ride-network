#!/usr/bin/env python3
"""
provider-docs upload folder-ownership E2E.

Uses the currently signed-in Supabase session (injected via
LOVABLE_BROWSER_SUPABASE_* env vars) to hit the Storage REST API directly
and confirm the INSERT policy on `storage.objects` for bucket
`provider-docs` enforces `(storage.foldername(name))[2] = auth.uid()`.
"""
import json
import os
import sys
import time
import uuid
import base64
import urllib.request
import urllib.error

SUPABASE_URL = "https://ehhxvjmiqobojslbwvij.supabase.co"
ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoaHh2am1pcW9ib2pzbGJ3dmlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NjE3NjMsImV4cCI6MjA5NTIzNzc2M30."
    "zmXFV2GwCEgJvLMJSFLCgUh5TZkBjimz4aWhTRsNBng"
)
BUCKET = "provider-docs"


def die(msg):
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def jwt_sub(token: str) -> str:
    payload = token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    claims = json.loads(base64.urlsafe_b64decode(payload))
    return claims["sub"]


def upload(access_token: str, path: str, body: bytes):
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}"
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {access_token}",
            "apikey": ANON_KEY,
            "Content-Type": "application/octet-stream",
            "x-upsert": "true",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def delete(access_token: str, path: str):
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}"
    req = urllib.request.Request(
        url,
        method="DELETE",
        headers={"Authorization": f"Bearer {access_token}", "apikey": ANON_KEY},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code


def main():
    status = os.environ.get("LOVABLE_BROWSER_AUTH_STATUS", "")
    if status != "injected":
        die(
            f"LOVABLE_BROWSER_AUTH_STATUS={status!r} — sign in in the Lovable "
            "preview first, then rerun."
        )

    token = os.environ.get("LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN")
    if not token:
        session = json.loads(os.environ["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"])
        token = session["access_token"]
    my_uid = jwt_sub(token)
    other_uid = str(uuid.uuid4())
    stamp = int(time.time() * 1000)
    body = b"provider-docs upload ownership test payload"

    print(f"signed in as {my_uid}")

    cases = [
        ("own folder (should succeed)",   f"applications/{my_uid}/test-{stamp}.bin",   True),
        ("other user's folder (should fail)", f"applications/{other_uid}/test-{stamp}.bin", False),
        ("wrong prefix (should fail)",    f"credentials/{my_uid}/test-{stamp}.bin",    False),
        ("missing user segment (should fail)", f"applications/loose-{stamp}.bin",       False),
    ]

    failures = []
    to_cleanup = []
    for label, path, expect_ok in cases:
        code, resp = upload(token, path, body)
        ok = 200 <= code < 300
        outcome = "ALLOWED" if ok else f"REJECTED({code})"
        expected = "ALLOWED" if expect_ok else "REJECTED"
        marker = "✓" if ok == expect_ok else "✗"
        print(f"  {marker} {label:44s} {path}  →  {outcome}  [expected {expected}]")
        if ok != expect_ok:
            failures.append(f"{label}: got {outcome}, expected {expected}. body={resp[:200]}")
        if ok:
            to_cleanup.append(path)

    for path in to_cleanup:
        delete(token, path)

    if failures:
        print()
        for f in failures:
            print(f"FAIL: {f}", file=sys.stderr)
        sys.exit(1)
    print("\nAll provider-docs upload ownership assertions passed.")


if __name__ == "__main__":
    main()
