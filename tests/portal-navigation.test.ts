import { test, expect } from "bun:test";
import { CUSTOMER_ONLY, RESTRICTED_BLOCK, under } from "../src/components/portal/portal-nav";

test("provider notifications are not blocked as a patient-only page", () => {
  expect(under("/portal/notifications", CUSTOMER_ONLY)).toBe(false);
});

test("restricted provider members still cannot access fleet management", () => {
  expect(under("/portal/vehicles", RESTRICTED_BLOCK)).toBe(true);
  expect(under("/portal/drivers", RESTRICTED_BLOCK)).toBe(true);
});