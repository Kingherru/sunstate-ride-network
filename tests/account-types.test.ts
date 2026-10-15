import { test, expect } from "bun:test";
import { ORGANIZATION_VALUES, organizationLabel } from "../src/lib/account-types";

test("users cannot pick the provider label or 'needs review' as their account type", () => {
  expect(ORGANIZATION_VALUES).not.toContain("transportation_provider" as never);
  expect(ORGANIZATION_VALUES).not.toContain("needs_review" as never);
  expect(ORGANIZATION_VALUES.length).toBe(10);
});

test("unknown account types display as needing classification", () => {
  expect(organizationLabel(null)).toBe("Needs classification");
  expect(organizationLabel("needs_review")).toBe("Needs classification");
  expect(organizationLabel("hospital")).toBe("Hospital");
});
