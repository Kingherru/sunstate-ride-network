import { describe, it, expect } from "vitest";
import { resolveAdminLevel, levelAllows, canOpen } from "@/lib/admin-permissions";

describe("resolveAdminLevel", () => {
  it("master always resolves to manage", () => {
    expect(resolveAdminLevel({ master: true, sections: {}, scope: "all" }, "pricing")).toBe("manage");
  });
  it("missing perms resolves to none", () => {
    expect(resolveAdminLevel(null, "pricing")).toBe("none");
  });
  it("reads section grants", () => {
    const p = { master: false, sections: { pricing: "read" }, scope: "all" };
    expect(resolveAdminLevel(p, "pricing")).toBe("read");
    expect(resolveAdminLevel(p, "payouts")).toBe("none");
  });
  it("manage grant resolves to manage", () => {
    const p = { master: false, sections: { payouts: "manage" }, scope: "all" };
    expect(resolveAdminLevel(p, "payouts")).toBe("manage");
  });
  it("ignores unknown/invalid level strings", () => {
    const p = { master: false, sections: { payouts: "bogus" }, scope: "all" };
    expect(resolveAdminLevel(p as any, "payouts")).toBe("none");
  });
});

describe("levelAllows", () => {
  it("manage satisfies read requirement", () => {
    expect(levelAllows("manage", "read")).toBe(true);
  });
  it("read does not satisfy manage requirement", () => {
    expect(levelAllows("read", "manage")).toBe(false);
  });
  it("none satisfies nothing", () => {
    expect(levelAllows("none", "read")).toBe(false);
    expect(levelAllows(undefined, "read")).toBe(false);
  });
});

describe("canOpen with resolved levels", () => {
  it("blocks section pages when level is none", () => {
    const p = { master: false, sections: {}, scope: "none" };
    expect(canOpen("/admin/pricing", p)).toBe(false);
  });
  it("allows section pages when level is read", () => {
    const p = { master: false, sections: { pricing: "read" }, scope: "all" };
    expect(canOpen("/admin/pricing", p)).toBe(true);
  });
  it("master-only sections stay blocked for non-master regardless of sections", () => {
    const p = { master: false, sections: { pricing: "manage" }, scope: "all" };
    expect(canOpen("/admin/security", p)).toBe(false);
  });
});
