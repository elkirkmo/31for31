// Each 31-for-31 list drops on October 1 of its own year, but the scraper
// seeds that year's films well ahead of time (placeholder titles, no
// streaming offers). This keeps a year hidden from the public site until
// its October 1, while admins always see every year so they can check the
// list before it goes live.
//
// The cutoff is October 1 00:00 UTC, which is the evening of September 30
// in the US. Close enough for a fan site — nudge this if it ever matters.
export function isYearVisible(year: string, isAdmin: boolean, now: Date = new Date()): boolean {
    if (isAdmin) return true

    const releaseYear = Number(year)
    if (!Number.isFinite(releaseYear)) return false

    return now.getTime() >= Date.UTC(releaseYear, 9, 1) // month 9 === October
}

// Drops the not-yet-released years from a year-keyed map.
export function visibleYearsOnly<T>(
    filmsByYear: Record<string, T>,
    isAdmin: boolean,
    now: Date = new Date()
): Record<string, T> {
    return Object.fromEntries(
        Object.entries(filmsByYear).filter(([year]) => isYearVisible(year, isAdmin, now))
    )
}
