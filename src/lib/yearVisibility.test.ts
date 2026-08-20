import { describe, expect, it } from "vitest";
import { isYearVisible, visibleYearsOnly } from "./yearVisibility";

const beforeRelease = new Date("2026-08-20T12:00:00Z");
const onRelease = new Date("2026-10-01T00:00:00Z");

describe("isYearVisible", () => {
  it("hides a year before its October 1", () => {
    expect(isYearVisible("2026", false, beforeRelease)).toBe(false);
  });

  it("shows a year from October 1 onwards", () => {
    expect(isYearVisible("2026", false, onRelease)).toBe(true);
  });

  it("shows past years", () => {
    expect(isYearVisible("2025", false, beforeRelease)).toBe(true);
  });

  it("shows an unreleased year to an admin", () => {
    expect(isYearVisible("2026", true, beforeRelease)).toBe(true);
  });

  it("hides a key that is not a year", () => {
    expect(isYearVisible("textContent", false, beforeRelease)).toBe(false);
  });
});

describe("visibleYearsOnly", () => {
  const filmsByYear = {
    "2024": ["a"],
    "2025": ["b"],
    "2026": ["c"],
  };

  it("drops the unreleased year for the public", () => {
    expect(visibleYearsOnly(filmsByYear, false, beforeRelease)).toEqual({
      "2024": ["a"],
      "2025": ["b"],
    });
  });

  it("keeps every year for an admin", () => {
    expect(visibleYearsOnly(filmsByYear, true, beforeRelease)).toEqual(
      filmsByYear,
    );
  });
});
