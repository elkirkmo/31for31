import { afterEach, describe, expect, it, vi } from "vitest";
import { readStoredYear, storeYear } from "./yearPreference";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("readStoredYear", () => {
  it("returns nothing when no year has been stored", () => {
    expect(readStoredYear(["2025", "2024"])).toBe(null);
  });

  it("returns a stored year that is still available", () => {
    storeYear("2024");

    expect(readStoredYear(["2025", "2024"])).toBe("2024");
  });

  it("ignores a stored year that is not currently available", () => {
    storeYear("2026");

    expect(readStoredYear(["2025", "2024"])).toBe(null);
  });

  it("returns nothing instead of throwing when localStorage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(readStoredYear(["2025"])).toBe(null);
  });
});

describe("storeYear", () => {
  it("round-trips the selected year", () => {
    storeYear("2025");

    expect(readStoredYear(["2025"])).toBe("2025");
  });

  it("does not throw when localStorage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() => storeYear("2025")).not.toThrow();
  });
});
