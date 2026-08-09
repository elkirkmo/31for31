import { describe, expect, it } from "vitest";
import {
  collectFilterOptions,
  isDisplayableService,
  sortByPriceType,
} from "./services";

describe("isDisplayableService", () => {
  it("excludes cinema-type services", () => {
    expect(isDisplayableService({ name: "Fandango", type: "cinema" })).toBe(
      false,
    );
  });

  it("excludes Amazon Channel add-ons", () => {
    expect(
      isDisplayableService({
        name: "Shudder Amazon Channel",
        type: "subscription",
      }),
    ).toBe(false);
  });

  it("excludes Apple TV Channel add-ons", () => {
    expect(
      isDisplayableService({
        name: "Starz Apple TV Channel",
        type: "subscription",
      }),
    ).toBe(false);
  });

  it("includes ordinary streaming services", () => {
    expect(
      isDisplayableService({ name: "Netflix", type: "subscription" }),
    ).toBe(true);
  });
});

describe("sortByPriceType", () => {
  it("orders free, subscription, rent, buy", () => {
    const input = [
      { name: "a", type: "buy" },
      { name: "b", type: "free" },
      { name: "c", type: "rent" },
      { name: "d", type: "subscription" },
    ];

    expect(sortByPriceType(input).map((s) => s.type)).toEqual([
      "free",
      "subscription",
      "rent",
      "buy",
    ]);
  });

  it("puts unrecognized types last without mutating the input array", () => {
    const input = [
      { name: "a", type: "cinema" },
      { name: "b", type: "free" },
    ];

    const result = sortByPriceType(input);

    expect(result.map((s) => s.type)).toEqual(["free", "cinema"]);
    expect(input.map((s) => s.type)).toEqual(["cinema", "free"]);
  });
});

describe("collectFilterOptions", () => {
  it("returns deduplicated, sorted service names and price types", () => {
    const films = [
      {
        service: [
          { name: "Netflix", type: "subscription" },
          { name: "Tubi", type: "free" },
        ],
      },
      {
        service: [
          { name: "Netflix", type: "subscription" },
          { name: "Amazon Video", type: "buy" },
        ],
      },
    ];

    const options = collectFilterOptions(films);

    expect(options.services).toEqual(["Amazon Video", "Netflix", "Tubi"]);
    expect(options.prices).toEqual(["free", "subscription", "buy"]);
  });

  it("excludes cinema and duplicate channel add-ons from the options", () => {
    const films = [
      {
        service: [
          { name: "Fandango", type: "cinema" },
          { name: "Shudder Amazon Channel", type: "subscription" },
          { name: "Shudder", type: "subscription" },
        ],
      },
    ];

    const options = collectFilterOptions(films);

    expect(options.services).toEqual(["Shudder"]);
    expect(options.prices).toEqual(["subscription"]);
  });

  it("returns empty lists for no films", () => {
    expect(collectFilterOptions([])).toEqual({ services: [], prices: [] });
  });
});
