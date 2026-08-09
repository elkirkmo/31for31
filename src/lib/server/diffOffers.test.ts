import { describe, expect, it } from 'vitest'
import { diffServices, type OfferLike } from './diffOffers'

function offer(overrides: Partial<OfferLike> = {}): OfferLike {
    return {
        name: 'Netflix',
        type: 'subscription',
        price: null,
        currency: null,
        link: 'https://netflix.com/1',
        icon: 'https://images.justwatch.com/netflix.webp',
        ...overrides
    }
}

describe('diffServices', () => {
    it('reports no changes when old and new are identical', () => {
        const rows = [offer()]
        const result = diffServices(rows, [offer()])

        expect(result.added).toEqual([])
        expect(result.removed).toEqual([])
        expect(result.changed).toEqual([])
        expect(result.unchanged).toEqual([offer()])
    })

    it('reports an offer present only in the new scrape as added', () => {
        const result = diffServices([], [offer({ name: 'Tubi', type: 'free', link: 'https://tubi.tv/1', icon: null })])

        expect(result.added).toEqual([{ name: 'Tubi', type: 'free', price: null, currency: null, link: 'https://tubi.tv/1', icon: null }])
        expect(result.removed).toEqual([])
        expect(result.changed).toEqual([])
    })

    it('reports an offer present only in the old rows as removed', () => {
        const stale = offer({ name: 'Shudder', type: 'subscription' })
        const result = diffServices([stale], [])

        expect(result.removed).toEqual([stale])
        expect(result.added).toEqual([])
    })

    it('reports a matching (name, type) pair with a different price as changed', () => {
        const oldRow = offer({ name: 'Amazon Video', type: 'rent', price: 3.99, currency: 'USD' })
        const newRow = offer({ name: 'Amazon Video', type: 'rent', price: 4.99, currency: 'USD' })

        const result = diffServices([oldRow], [newRow])

        expect(result.changed).toEqual([{ old: oldRow, new: newRow }])
        expect(result.unchanged).toEqual([])
    })

    it('reports a matching pair with a different link as changed even when price is unchanged', () => {
        const oldRow = offer({ link: 'https://netflix.com/old' })
        const newRow = offer({ link: 'https://netflix.com/new' })

        const result = diffServices([oldRow], [newRow])

        expect(result.changed).toEqual([{ old: oldRow, new: newRow }])
    })

    it('matches offers by (name, type) regardless of array order', () => {
        const netflix = offer({ name: 'Netflix', type: 'subscription' })
        const tubi = offer({ name: 'Tubi', type: 'free', link: 'https://tubi.tv/1' })

        const result = diffServices([tubi, netflix], [netflix, tubi])

        expect(result.unchanged).toHaveLength(2)
        expect(result.added).toEqual([])
        expect(result.removed).toEqual([])
    })

    it('treats the same service name with a different type as a distinct offer', () => {
        const rentRow = offer({ name: 'Amazon Video', type: 'rent', price: 3.99 })
        const buyRow = offer({ name: 'Amazon Video', type: 'buy', price: 12.99 })

        const result = diffServices([rentRow], [rentRow, buyRow])

        expect(result.added).toEqual([buyRow])
        expect(result.unchanged).toEqual([rentRow])
    })

    it('handles a full replacement (nothing in common) as all-removed plus all-added', () => {
        const oldRow = offer({ name: 'Old Service', type: 'free', link: 'https://old.com' })
        const newRow = offer({ name: 'New Service', type: 'rent', price: 2.99, link: 'https://new.com' })

        const result = diffServices([oldRow], [newRow])

        expect(result.removed).toEqual([oldRow])
        expect(result.added).toEqual([newRow])
        expect(result.changed).toEqual([])
    })
})
