import { describe, expect, it } from "vitest";
import { BONUS_DATE_LABEL, displayFilmDate } from "./filmDate";

describe("displayFilmDate", () => {
  it("passes a real date through untouched", () => {
    expect(displayFilmDate("10/15/2024")).toBe("10/15/2024");
  });

  it("labels an empty date as a bonus film", () => {
    expect(displayFilmDate("")).toBe(BONUS_DATE_LABEL);
  });

  it("labels a whitespace-only date as a bonus film", () => {
    expect(displayFilmDate("   ")).toBe(BONUS_DATE_LABEL);
  });

  it("labels a null or undefined date as a bonus film", () => {
    expect(displayFilmDate(null)).toBe(BONUS_DATE_LABEL);
    expect(displayFilmDate(undefined)).toBe(BONUS_DATE_LABEL);
  });
});
