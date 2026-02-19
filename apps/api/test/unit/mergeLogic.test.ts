import { describe, it, expect } from "vitest";
import { MERGE_DISTANCE_METERS } from "@community-map/shared";

describe("merge logic", () => {
  it("uses 200m merge radius", () => {
    expect(MERGE_DISTANCE_METERS).toBe(200);
  });
});
