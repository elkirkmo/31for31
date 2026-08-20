// Remembers which year tab the reader last looked at, so a refresh doesn't
// throw them back to the newest list.
const STORAGE_KEY = '31for31:selectedYear'

// Every access is wrapped: some privacy modes make `localStorage` throw on
// touch rather than just returning null. A forgotten tab preference is a
// fine outcome; a page whose script died on load is not.
export function readStoredYear(availableYears: string[]): string | null {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        // The stored value goes stale: the year may have left the data, or
        // an admin may have picked a not-yet-released year and then logged
        // out. Only restore something the reader can currently see.
        return stored && availableYears.includes(stored) ? stored : null
    } catch {
        return null
    }
}

export function storeYear(year: string): void {
    try {
        localStorage.setItem(STORAGE_KEY, year)
    } catch {
        // Preference simply isn't remembered this time.
    }
}
