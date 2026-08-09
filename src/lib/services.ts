export type ServiceOffer = {
  name: string;
  type: string;
};

export const PRICE_TYPE_ORDER = ["free", "subscription", "rent", "buy"];

/**
 * Amazon/Apple TV "Channel" add-ons duplicate a service that's already
 * listed on its own (e.g. "Shudder" and "Shudder Amazon Channel"), and
 * cinema listings aren't streamable -- neither belongs in the UI.
 */
export function isDisplayableService(s: ServiceOffer): boolean {
  return (
    s.type !== "cinema" &&
    !s.name.includes("Amazon Channel") &&
    !s.name.includes("Apple TV Channel")
  );
}

export function sortByPriceType<T extends ServiceOffer>(services: T[]): T[] {
  return [...services].sort((a, b) => {
    const aIndex = PRICE_TYPE_ORDER.indexOf(a.type);
    const bIndex = PRICE_TYPE_ORDER.indexOf(b.type);
    return (
      (aIndex === -1 ? PRICE_TYPE_ORDER.length : aIndex) -
      (bIndex === -1 ? PRICE_TYPE_ORDER.length : bIndex)
    );
  });
}

/**
 * Collects the distinct, displayable service names and price types across
 * a set of films, for use as the option lists in the Filter component.
 */
export function collectFilterOptions(
  films: { service: ServiceOffer[] }[],
): { services: string[]; prices: string[] } {
  const services = new Set<string>();
  const prices = new Set<string>();

  for (const film of films) {
    for (const s of film.service) {
      if (!isDisplayableService(s)) continue;
      services.add(s.name);
      prices.add(s.type);
    }
  }

  return {
    services: [...services].sort((a, b) => a.localeCompare(b)),
    prices: sortByPriceType([...prices].map((type) => ({ name: type, type }))).map(
      (p) => p.type,
    ),
  };
}
