import { describe, it, expect } from "vitest";
import { PRESETS, canOpen } from "@/lib/admin-permissions";
import { csvCell, parseCsv, validateRows, PASSENGER_COLUMNS, CSV_MAX_ROWS } from "@/lib/csv-import";

const none = { master: false, sections: {}, scope: "none" };
describe("regular admin permissions", () => {
  it("new admin opens nothing but overview", () => {
    expect(canOpen("/admin", none)).toBe(true);
    expect(canOpen("/admin/people", none)).toBe(false);
    expect(canOpen("/admin/payouts", none)).toBe(false);
  });
  it("security and admin management stay master-only", () => {
    const all = { master: false, sections: Object.fromEntries(["people","requests","pricing","payouts","integrations","messaging","notifications"].map((k) => [k, "manage"])), scope: "all" };
    expect(canOpen("/admin/security", all)).toBe(false);
    expect(canOpen("/admin/admins", all)).toBe(false);
    expect(canOpen("/admin/security", { ...none, master: true })).toBe(true);
  });
  it("support preset has no pricing or payouts", () => {
    expect(PRESETS.support.pricing).toBeUndefined();
    expect(PRESETS.support.payouts).toBeUndefined();
  });
  it("finance preset has no messaging or requests", () => {
    expect(PRESETS.finance.messaging).toBeUndefined();
    expect(PRESETS.finance.requests).toBeUndefined();
  });
  it("request-for-customer needs requests manage", () => {
    expect(canOpen("/admin/on-behalf", { ...none, sections: { requests: "read" } })).toBe(false);
    expect(canOpen("/admin/on-behalf", { ...none, sections: { requests: "manage" } })).toBe(true);
  });
});

describe("csv import", () => {
  it("escapes spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+1")).toBe("'+1");
  });
  it("row limit is 250", () => expect(CSV_MAX_ROWS).toBe(250));
  it("flags duplicates and invalid rows", () => {
    const d = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const row = `A,B,555-555-5555,,1 Main St,Orlando,${d},09:30,,2 Main St,Orlando,wheelchair,,`;
    const [h, ...body] = parseCsv(PASSENGER_COLUMNS.join(",") + "\n" + row + "\n" + row + "\nx,,,,,,,,,,,rocket,,\n");
    const r: any[] = validateRows("passenger", h, body);
    expect(r[0].ok).toBe(true);
    expect(r[1].dup).toBe(2);
    expect(r[2].ok).toBe(false);
  });
});
