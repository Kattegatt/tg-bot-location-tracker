import { describe, it, expect } from "vitest";
import { buildDataCheckString } from "../../src/telegram";

describe("telegram initData", () => {
  it("builds a stable data-check-string", () => {
    const initData = "query_id=1&user=%7B%22id%22%3A1%7D&auth_date=1700000000&hash=abc";
    const result = buildDataCheckString(initData);
    expect(result).toContain("auth_date=1700000000");
  });
});
