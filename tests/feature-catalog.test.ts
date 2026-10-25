import { describe, it, expect } from "vitest";
import { FEATURE_CATALOG, publicFeatures } from "../src/lib/feature-catalog";

describe("feature catalog", () => {
  it("shows nothing publicly until explicitly approved", () => {
    expect(publicFeatures()).toHaveLength(0);
  });
  it("includes Smart Notes", () => {
    expect(FEATURE_CATALOG.some((f) => f.name === "Smart Notes")).toBe(true);
  });
});
