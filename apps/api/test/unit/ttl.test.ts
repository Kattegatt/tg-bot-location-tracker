import { describe, it, expect } from "vitest";
import { TTL_HOURS } from "@community-map/shared";

describe("ttl", () => {
  it("uses 5 hour ttl", () => {
    expect(TTL_HOURS).toBe(5);
  });
});
