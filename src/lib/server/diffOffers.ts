export type OfferLike = {
    name: string
    type: string
    price: number | null
    currency: string | null
    link: string | null
    icon: string | null
}

export type OfferDiff<T extends OfferLike> = {
    added: T[]
    removed: T[]
    unchanged: T[]
    changed: { old: T; new: T }[]
}

function key(offer: OfferLike) {
    return `${offer.name}::${offer.type}`
}

function offersEqual(a: OfferLike, b: OfferLike) {
    return a.price === b.price && a.currency === b.currency && a.link === b.link && a.icon === b.icon
}

// Pure diff between what's currently stored for a film and what a fresh
// scrape returned. Matches offers by (name, type) — JustWatch doesn't give
// a stable id per offer, so that's the closest thing to identity we have.
export function diffServices<T extends OfferLike>(oldRows: T[], newOffers: T[]): OfferDiff<T> {
    const oldByKey = new Map(oldRows.map((s) => [key(s), s]))
    const newByKey = new Map(newOffers.map((s) => [key(s), s]))

    const added: T[] = []
    const unchanged: T[] = []
    const changed: { old: T; new: T }[] = []

    for (const [k, newRow] of newByKey) {
        const oldRow = oldByKey.get(k)
        if (!oldRow) {
            added.push(newRow)
        } else if (!offersEqual(oldRow, newRow)) {
            changed.push({ old: oldRow, new: newRow })
        } else {
            unchanged.push(newRow)
        }
    }

    const removed: T[] = []
    for (const [k, oldRow] of oldByKey) {
        if (!newByKey.has(k)) removed.push(oldRow)
    }

    return { added, removed, unchanged, changed }
}
