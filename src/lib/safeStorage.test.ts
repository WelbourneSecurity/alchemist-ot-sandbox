// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { safeSetItem, safeRemoveItem } from "./safeStorage";

afterEach(() => vi.restoreAllMocks());

describe("safeStorage", () => {
  it("stores a value and reports success", () => {
    expect(safeSetItem("k", "v")).toBe(true);
    expect(window.localStorage.getItem("k")).toBe("v");
  });

  it("returns false instead of throwing when setItem throws (quota/private mode)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(() => safeSetItem("k", "v")).not.toThrow();
    expect(safeSetItem("k", "v")).toBe(false);
  });

  it("returns false instead of throwing when removeItem throws", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });
    expect(() => safeRemoveItem("k")).not.toThrow();
    expect(safeRemoveItem("k")).toBe(false);
  });
});
