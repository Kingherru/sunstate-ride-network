import { describe, it, expect } from "vitest";
import { FEATURE_CATALOG, publicFeatures } from "../src/lib/feature-catalog";

describe("feature catalog", () => {
  it("limits public features to the four approved complete trial benefits", () => {
    expect(publicFeatures().map(f=>f.name)).toEqual(['Trips','Schedule','Vehicles','Pricing Rules']);
    expect(publicFeatures().every(f=>f.status==='complete' && f.publicApproved)).toBe(true);
  });
  it("includes Smart Notes", () => {
    expect(FEATURE_CATALOG.some((f) => f.name === "Smart Notes")).toBe(true);
  });
});
