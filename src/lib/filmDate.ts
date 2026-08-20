// October has 31 days but a year's list can run longer — 2024 carries 32
// films. The extras come through without a date (the scraper has no slot to
// give them), so rather than rendering a blank they're labelled as bonus
// picks.
//
// A missing date is the marker for "this one is an extra": the dated films
// fill October 1-31 in order, so anything left over is by definition beyond
// the calendar. Counting films per year would tell us how many extras there
// are but not which ones they are.
export const BONUS_DATE_LABEL = 'Bonus'

// Takes a film's stored date. Callers that distinguish "no date" from "not
// in the films table at all" must check for null themselves first — this
// treats both as a bonus film.
export function displayFilmDate(date: string | null | undefined): string {
    return date?.trim() ? date : BONUS_DATE_LABEL
}
