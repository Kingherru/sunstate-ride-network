import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const sql = readFileSync('drizzle/migrations/0150_secure_user_removal_dependency_scan.sql', 'utf8');
const plan = sql.split('CREATE OR REPLACE FUNCTION public.admin_user_removal_plan')[1];

describe('user-removal security boundary', () => {
  test('dynamic dependency scan is not executable by API roles', () => {
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.user_removal_dependency_count(uuid) FROM PUBLIC, anon, authenticated, service_role');
    expect(sql).toContain('INTO k USING _user');
    expect(sql).toContain('public.%I WHERE %I=$1');
    expect(plan).not.toMatch(/\bEXECUTE\s+format/i);
  });

  test('permissions are checked before any target read or dependency scan', () => {
    const permission = plan.indexOf("auth.uid() IS NULL OR NOT coalesce(public.admin_can('people', 'manage'), false)");
    expect(permission).toBeGreaterThan(-1);
    expect(permission).toBeLessThan(plan.indexOf('SELECT * INTO p'));
    expect(plan.indexOf("RAISE EXCEPTION 'Account scope required'")).toBeLessThan(plan.indexOf('n := public.user_removal_dependency_count'));
    expect(plan).toContain('AND NOT coalesce(public.admin_can_account(workspace_id), false)');
  });

  test('preserves Master Admin protection and history-dependent removal decisions', () => {
    expect(plan).toContain('IF NOT FOUND OR public.is_master_admin(_user)');
    expect(plan).toContain("CASE WHEN m AND n = 0 THEN 'delete' ELSE 'deactivate' END");
    expect(sql).toContain("table_name NOT IN ('user_profiles', 'workspace_members')");
    expect(sql).not.toMatch(/\b(DELETE FROM|UPDATE public\.|INSERT INTO)\b/i);
    expect(plan).toContain('REVOKE ALL ON FUNCTION public.admin_user_removal_plan(uuid) FROM PUBLIC, anon');
  });
});