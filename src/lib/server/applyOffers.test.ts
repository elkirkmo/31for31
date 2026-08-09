import { describe, expect, it, vi, beforeEach } from 'vitest'

const fromMock = vi.fn()
vi.mock('./supabaseAdmin', () => ({
    supabaseAdmin: { from: (...args: unknown[]) => fromMock(...args) }
}))

import { applyFilmOffers } from './applyOffers'

function offer(name: string) {
    return { name, type: 'free', price: null, currency: null, link: null, icon: null }
}

describe('applyFilmOffers', () => {
    beforeEach(() => {
        fromMock.mockReset()
    })

    it('deletes existing rows then inserts the new offers', async () => {
        const deleteEq = vi.fn(async () => ({ error: null }))
        const insert = vi.fn(async () => ({ error: null }))
        fromMock.mockReturnValue({
            delete: vi.fn(() => ({ eq: deleteEq })),
            insert
        })

        const result = await applyFilmOffers(1, [offer('Tubi')])

        expect(result).toEqual({ ok: true })
        expect(deleteEq).toHaveBeenCalledWith('film_id', 1)
        expect(insert).toHaveBeenCalledWith([
            { film_id: 1, name: 'Tubi', type: 'free', price: null, currency: null, link: null, icon: null }
        ])
    })

    it('skips the insert call when there are no offers', async () => {
        const deleteEq = vi.fn(async () => ({ error: null }))
        const insert = vi.fn(async () => ({ error: null }))
        fromMock.mockReturnValue({
            delete: vi.fn(() => ({ eq: deleteEq })),
            insert
        })

        const result = await applyFilmOffers(1, [])

        expect(result).toEqual({ ok: true })
        expect(insert).not.toHaveBeenCalled()
    })

    it('returns an error and skips insert when the delete fails', async () => {
        const deleteEq = vi.fn(async () => ({ error: { message: 'delete failed' } }))
        const insert = vi.fn(async () => ({ error: null }))
        fromMock.mockReturnValue({
            delete: vi.fn(() => ({ eq: deleteEq })),
            insert
        })

        const result = await applyFilmOffers(1, [offer('Tubi')])

        expect(result).toEqual({ ok: false, error: 'delete failed' })
        expect(insert).not.toHaveBeenCalled()
    })

    it('returns an error when the insert fails', async () => {
        const deleteEq = vi.fn(async () => ({ error: null }))
        const insert = vi.fn(async () => ({ error: { message: 'insert failed' } }))
        fromMock.mockReturnValue({
            delete: vi.fn(() => ({ eq: deleteEq })),
            insert
        })

        const result = await applyFilmOffers(1, [offer('Tubi')])

        expect(result).toEqual({ ok: false, error: 'insert failed' })
    })
})
