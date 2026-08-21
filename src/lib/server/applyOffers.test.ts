import { describe, expect, it, vi, beforeEach } from 'vitest'

const fromMock = vi.fn()
vi.mock('./supabaseAdmin', () => ({
    supabaseAdmin: { from: (...args: unknown[]) => fromMock(...args) }
}))

import { applyFilmOffers } from './applyOffers'

function offer(name: string) {
    return { name, type: 'free', price: null, currency: null, link: null, icon: null }
}

// Mirrors the three calls applyFilmOffers makes: read the existing row ids,
// insert the new rows, delete the old ones by id.
function fakeSupabase({
    existingIds = [1, 2] as number[],
    readError = null as { message: string } | null,
    insertError = null as { message: string } | null,
    deleteError = null as { message: string } | null
} = {}) {
    const insert = vi.fn(async () => ({ error: insertError }))
    const deleteIn = vi.fn(async () => ({ error: deleteError }))
    const selectEq = vi.fn(async () => ({
        data: readError ? null : existingIds.map((id) => ({ id })),
        error: readError
    }))

    fromMock.mockReturnValue({
        select: vi.fn(() => ({ eq: selectEq })),
        insert,
        delete: vi.fn(() => ({ in: deleteIn }))
    })

    return { insert, deleteIn, selectEq }
}

describe('applyFilmOffers', () => {
    beforeEach(() => {
        fromMock.mockReset()
    })

    describe('write ordering', () => {
        // A handful of films genuinely stream nowhere, so clearing one is a
        // legitimate outcome here. Refusing a whole scrape that came back
        // empty for everything is the caller's job -- see the applyAll action.
        it('clears the offers when the scrape legitimately found none', async () => {
            const { insert, deleteIn } = fakeSupabase({ existingIds: [7, 8] })

            const result = await applyFilmOffers(1, [])

            expect(result).toEqual({ ok: true })
            expect(insert).not.toHaveBeenCalled()
            expect(deleteIn).toHaveBeenCalledWith('id', [7, 8])
        })

        it('leaves the old offers in place when the insert fails', async () => {
            const { deleteIn } = fakeSupabase({ insertError: { message: 'insert failed' } })

            const result = await applyFilmOffers(1, [offer('Tubi')])

            expect(result).toEqual({ ok: false, error: 'insert failed' })
            expect(deleteIn).not.toHaveBeenCalled()
        })

        it('inserts before deleting, so a crash between the two costs nothing', async () => {
            const calls: string[] = []
            const insert = vi.fn(async () => {
                calls.push('insert')
                return { error: null }
            })
            const deleteIn = vi.fn(async () => {
                calls.push('delete')
                return { error: null }
            })
            fromMock.mockReturnValue({
                select: vi.fn(() => ({ eq: vi.fn(async () => ({ data: [{ id: 1 }], error: null })) })),
                insert,
                delete: vi.fn(() => ({ in: deleteIn }))
            })

            await applyFilmOffers(1, [offer('Tubi')])

            expect(calls).toEqual(['insert', 'delete'])
        })
    })

    describe('the happy path', () => {
        it('inserts the new offers and removes only the previously stored rows', async () => {
            const { insert, deleteIn } = fakeSupabase({ existingIds: [7, 8] })

            const result = await applyFilmOffers(1, [offer('Tubi')])

            expect(result).toEqual({ ok: true })
            expect(insert).toHaveBeenCalledWith([
                { film_id: 1, name: 'Tubi', type: 'free', price: null, currency: null, link: null, icon: null }
            ])
            expect(deleteIn).toHaveBeenCalledWith('id', [7, 8])
        })

        it('skips the delete when the film had no offers to begin with', async () => {
            const { deleteIn } = fakeSupabase({ existingIds: [] })

            const result = await applyFilmOffers(1, [offer('Tubi')])

            expect(result).toEqual({ ok: true })
            expect(deleteIn).not.toHaveBeenCalled()
        })

        it('reports when the new offers saved but the old ones could not be removed', async () => {
            fakeSupabase({ deleteError: { message: 'delete failed' } })

            const result = await applyFilmOffers(1, [offer('Tubi')])

            expect(result).toMatchObject({
                ok: false,
                error: expect.stringContaining('delete failed')
            })
        })

        it('returns the error when the existing rows cannot be read', async () => {
            const { insert } = fakeSupabase({ readError: { message: 'read failed' } })

            const result = await applyFilmOffers(1, [offer('Tubi')])

            expect(result).toEqual({ ok: false, error: 'read failed' })
            expect(insert).not.toHaveBeenCalled()
        })
    })

    describe('URL sanitising', () => {
        it('keeps https links and icons as-is', async () => {
            const { insert } = fakeSupabase()

            await applyFilmOffers(1, [
                { ...offer('Tubi'), link: 'https://tubi.tv/1', icon: 'https://images.justwatch.com/tubi.webp' }
            ])

            expect(insert).toHaveBeenCalledWith([
                expect.objectContaining({ link: 'https://tubi.tv/1', icon: 'https://images.justwatch.com/tubi.webp' })
            ])
        })

        it('strips a plain http link instead of storing it', async () => {
            const { insert } = fakeSupabase()

            await applyFilmOffers(1, [{ ...offer('Tubi'), link: 'http://tubi.tv/1', icon: null }])

            expect(insert).toHaveBeenCalledWith([expect.objectContaining({ link: null })])
        })

        it('strips a javascript: URI instead of storing it', async () => {
            const { insert } = fakeSupabase()

            await applyFilmOffers(1, [{ ...offer('Tubi'), link: 'javascript:alert(document.cookie)', icon: null }])

            expect(insert).toHaveBeenCalledWith([expect.objectContaining({ link: null })])
        })

        it('strips a malformed URL instead of storing it', async () => {
            const { insert } = fakeSupabase()

            await applyFilmOffers(1, [{ ...offer('Tubi'), link: 'not a url', icon: null }])

            expect(insert).toHaveBeenCalledWith([expect.objectContaining({ link: null })])
        })
    })
})
