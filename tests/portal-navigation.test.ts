import { test, expect } from "bun:test";
import { CUSTOMER_ONLY, RESTRICTED_BLOCK, under, isPortalPathBlocked, portalNavigation } from "../src/components/portal/portal-nav";
import { canUploadCsvRequests } from '../src/lib/csv-access';

test("provider notifications are not blocked as a patient-only page", () => {
  expect(under("/portal/notifications", CUSTOMER_ONLY)).toBe(false);
});

test("restricted provider members still cannot access fleet management", () => {
  expect(under("/portal/vehicles", RESTRICTED_BLOCK)).toBe(true);
  expect(under("/portal/drivers", RESTRICTED_BLOCK)).toBe(true);
  expect(under("/portal/fleet", RESTRICTED_BLOCK)).toBe(true);
  expect(under("/portal/earnings", RESTRICTED_BLOCK)).toBe(true);
});

test("providers can reach the shared request form and created request history", () => {
  expect(under("/portal/requests/new", CUSTOMER_ONLY)).toBe(false);
  expect(under("/portal/requests", CUSTOMER_ONLY)).toBe(false);
});

const customerMember = { portalKind: 'customer' as const, restricted: true, canMessageForWorkspace: false, canUploadCsvRequests: false };
const workspace = { type: 'facility', status: 'active', role: 'member', is_contractor: false, can_create_requests: true };

test('a customer member allowed to create requests can open CSV from the menu', () => {
  const access = { ...customerMember, canUploadCsvRequests: canUploadCsvRequests([workspace]) };
  expect(access.canUploadCsvRequests).toBe(true);
  expect(isPortalPathBlocked('/portal/upload-csv', access)).toBe(false);
  expect(portalNavigation(access).some((n) => n.to === '/portal/upload-csv')).toBe(true);
});

test('customer members without request permission cannot see or open CSV', () => {
  const access = { ...customerMember, canUploadCsvRequests: canUploadCsvRequests([{ ...workspace, can_create_requests: false }]) };
  expect(access.canUploadCsvRequests).toBe(false);
  expect(isPortalPathBlocked('/portal/upload-csv', access)).toBe(true);
  expect(portalNavigation(access).some((n) => n.to === '/portal/upload-csv')).toBe(false);
});

test('CSV requires exactly one eligible active non-contractor customer account', () => {
  expect(canUploadCsvRequests([])).toBe(false);
  expect(canUploadCsvRequests([workspace, workspace])).toBe(false);
  expect(canUploadCsvRequests([{ ...workspace, is_contractor: true }])).toBe(false);
  expect(canUploadCsvRequests([{ ...workspace, status: 'pending' }])).toBe(false);
  expect(canUploadCsvRequests([{ ...workspace, status: 'suspended' }])).toBe(false);
  expect(canUploadCsvRequests([{ ...workspace, type: 'provider' }])).toBe(false);
  expect(canUploadCsvRequests([{ ...workspace, role: 'owner', can_create_requests: false }])).toBe(true);
  expect(canUploadCsvRequests([{ ...workspace, role: 'admin', can_create_requests: false }])).toBe(true);
});

test('messaging visibility matches direct page access for customer and provider members', () => {
  for (const portalKind of ['customer', 'provider'] as const) {
    for (const restricted of [true, false]) {
      for (const canMessageForWorkspace of [true, false]) {
        const access = { ...customerMember, portalKind, restricted, canMessageForWorkspace };
        expect(isPortalPathBlocked('/portal/messaging', access)).toBe(!canMessageForWorkspace);
        expect(portalNavigation(access).some((n) => n.to === '/portal/messaging')).toBe(canMessageForWorkspace);
        expect(portalNavigation(access).every((n) => !isPortalPathBlocked(n.to, access))).toBe(true);
      }
    }
  }
});

test('request-submission permission does not unlock restricted provider management', () => {
  const access = { ...customerMember, portalKind: 'provider' as const };
  for (const path of ['/portal/fleet', '/portal/vehicles', '/portal/drivers', '/portal/earnings', '/portal/schedule', '/portal/upload-csv']) {
    expect(isPortalPathBlocked(path, access)).toBe(true);
  }
});