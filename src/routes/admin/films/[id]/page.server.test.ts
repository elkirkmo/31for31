import { describe, expect, it, vi, beforeEach } from 'vitest'
import { isHttpError } from '@sveltejs/kit'

vi.mock('$lib/server/requireAdmin', () => ({
    requireAdmin: vi.fn(async () => ({ user: { id: 'admin-1' } }))
}))

const scrapeOneMock = vi.fn()
vi.mock('$lib/server/scraperClient', () => ({
    scrapeOne: (...args: unknown[]) => scrapeOneMock(...args)
}))

const applyFilmOffersMock = vi.fn()
vi.mock('$lib/server/applyOffers', () => ({
    applyFilmOffers: (...args: unknown[]) => applyFilmOffersMock(...args)
}))

const fromMock = vi.fn()
vi.mock('$lib/server/supabaseAdmin', () => ({
    supabaseAdmin: { from: (...args: unknown[]) => fromMock(...args) }
}))

import { load, actions } from './+page.server'

// Minimal fake Supabase query builder: supports .select().eq().single() and
// .select().eq().order() (awaited directly, thenable).
function makeFilmsBuilder(rows: Record<string, unknown>[]) {
    let filtered = rows
    const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn((col: string, val: unknown) => {
            // Loose comparison: mimics PostgREST coercing a string route
            // param against a numeric column.
            filtered = filtered.filter((r) => String(r[col]) === String(val))
            return builder
        }),
        order: vi.fn(() => builder),
        single: vi.fn(async () => ({ data: filtered[0] ?? null })),
        then: (resolve: (v: { data: Record<string, unknown>[] }) => void) => resolve({ data: filtered })
    }
    return builder
}

describe('admin film [id] load', () => {
    beforeEach(() => {
        fromMock.mockReset()
    })

    it('throws a 404 when the film does not exist', async () => {
        fromMock.mockImplementation(() => makeFilmsBuilder([]))

        try {
            await load({ params: { id: '999' }, locals: {} } as unknown as Parameters<typeof load>[0])
            expect.unreachable('should have thrown')
        } catch (e) {
            expect(isHttpError(e)).toBe(true)
            expect((e as { status: number }).status).toBe(404)
        }
    })

    it('returns the film with its services', async () => {
        fromMock.mockImplementation(() =>
            makeFilmsBuilder([
                {
                    id: 1,
                    year: 2025,
                    date: '10/1/2025',
                    title: 'Film A',
                    justwatch_url: null,
                    services: [{ id: 10, name: 'Netflix', type: 'subscription', price: null }]
                }
            ])
        )

        const result = await load({ params: { id: '1' }, locals: {} } as unknown as Parameters<typeof load>[0])

        expect(result.film.title).toBe('Film A')
        expect(result.film.services).toHaveLength(1)
    })
})

describe('admin film [id] actions', () => {
    const updateMock = vi.fn()
    const deleteMock = vi.fn()

    // films is written directly now: .update(...).eq().select().single()
    // and .delete().eq().select().single().
    function writableFilms(result: Record<string, unknown> = { data: { id: 1 }, error: null }) {
        const tail = { eq: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => result) })) })) }
        updateMock.mockImplementation(() => tail)
        deleteMock.mockImplementation(() => tail)
        return { update: (...a: unknown[]) => updateMock(...a), delete: (...a: unknown[]) => deleteMock(...a) }
    }

    beforeEach(() => {
        fromMock.mockReset()
        updateMock.mockReset()
        deleteMock.mockReset()
        fromMock.mockImplementation(() => writableFilms())
    })

    function formDataRequest(fields: Record<string, string>) {
        const formData = new FormData()
        for (const [key, value] of Object.entries(fields)) formData.set(key, value)
        return { formData: async () => formData } as unknown as Request
    }

    it('update writes the film row directly', async () => {
        const event = {
            request: formDataRequest({ title: ' Film A Renamed ', date: '10/1/2025', justwatch_url: '' }),
            params: { id: '1' },
            locals: {}
        } as unknown as Parameters<typeof actions.update>[0]

        const result = await actions.update(event)

        expect(updateMock).toHaveBeenCalledWith({
            title: 'Film A Renamed',
            date: '10/1/2025',
            justwatch_url: null
        })
        expect(result).toEqual({ success: true })
    })

    // The whole point of the migration: an override set here is what the
    // next scrape actually uses.
    it('update stores a justwatch_url override', async () => {
        const event = {
            request: formDataRequest({
                title: 'The Ring',
                date: '10/20/2024',
                justwatch_url: 'https://www.justwatch.com/us/movie/le-cercle'
            }),
            params: { id: '1' },
            locals: {}
        } as unknown as Parameters<typeof actions.update>[0]

        await actions.update(event)

        expect(updateMock).toHaveBeenCalledWith(
            expect.objectContaining({ justwatch_url: 'https://www.justwatch.com/us/movie/le-cercle' })
        )
    })

    it('update returns an error when title is blank', async () => {
        const event = {
            request: formDataRequest({ title: '  ', date: '10/1/2025', justwatch_url: '' }),
            params: { id: '1' },
            locals: {}
        } as unknown as Parameters<typeof actions.update>[0]

        const result = await actions.update(event)

        expect(result).toEqual({ error: 'Title is required.' })
        expect(updateMock).not.toHaveBeenCalled()
    })

    it('update returns an error when date is blank, which the column rejects', async () => {
        const event = {
            request: formDataRequest({ title: 'Film A', date: '', justwatch_url: '' }),
            params: { id: '1' },
            locals: {}
        } as unknown as Parameters<typeof actions.update>[0]

        const result = await actions.update(event)

        expect(result).toEqual({ error: 'Date is required.' })
        expect(updateMock).not.toHaveBeenCalled()
    })

    it('update explains a duplicate title rather than leaking the constraint', async () => {
        fromMock.mockImplementation(() =>
            writableFilms({ data: null, error: { code: '23505', message: 'duplicate key' } })
        )
        const event = {
            request: formDataRequest({ title: 'Film B', date: '10/1/2025', justwatch_url: '' }),
            params: { id: '1' },
            locals: {}
        } as unknown as Parameters<typeof actions.update>[0]

        const result = await actions.update(event)

        expect(result).toEqual({ error: 'Another film that year is already called Film B.' })
    })

    it('update reports a missing film', async () => {
        fromMock.mockImplementation(() =>
            writableFilms({ data: null, error: { code: 'PGRST116', message: 'no rows' } })
        )
        const event = {
            request: formDataRequest({ title: 'Film A', date: '10/1/2025', justwatch_url: '' }),
            params: { id: '999' },
            locals: {}
        } as unknown as Parameters<typeof actions.update>[0]

        expect(await actions.update(event)).toEqual({ error: 'Film not found.' })
    })

    it('delete removes the film row, letting services cascade', async () => {
        const event = { params: { id: '1' }, locals: {} } as unknown as Parameters<typeof actions.delete>[0]

        const result = await actions.delete(event)

        expect(deleteMock).toHaveBeenCalled()
        expect(result).toEqual({ success: true, deleted: true })
    })

    it('delete reports a missing film', async () => {
        fromMock.mockImplementation(() =>
            writableFilms({ data: null, error: { code: 'PGRST116', message: 'no rows' } })
        )
        const event = { params: { id: '999' }, locals: {} } as unknown as Parameters<typeof actions.delete>[0]

        expect(await actions.delete(event)).toEqual({ error: 'Film not found.' })
    })
})

describe('admin film [id] rescrape actions', () => {
    beforeEach(() => {
        fromMock.mockReset()
        scrapeOneMock.mockReset()
        applyFilmOffersMock.mockReset()
    })

    function offer(name: string, overrides: Record<string, unknown> = {}) {
        return { name, type: 'free', price: null, currency: null, link: null, icon: null, ...overrides }
    }

    it('rescrape diffs a fresh scrape against stored offers without writing', async () => {
        fromMock.mockImplementation(() =>
            makeFilmsBuilder([
                {
                    id: 1,
                    title: 'Film A',
                    justwatch_url: null,
                    services: [offer('Netflix', { type: 'subscription' })]
                }
            ])
        )
        scrapeOneMock.mockResolvedValue({
            ok: true,
            data: { title: 'Film A', service: [offer('Netflix', { type: 'subscription' }), offer('Tubi')] }
        })

        const result = await actions.rescrape({
            params: { id: '1' },
            locals: {}
        } as unknown as Parameters<typeof actions.rescrape>[0])

        expect(result).toEqual({ rescrapePreview: { added: 1, removed: 0, changed: 0, unchanged: 1 } })
        expect(applyFilmOffersMock).not.toHaveBeenCalled()
    })

    it('rescrape returns the inline scrape error', async () => {
        fromMock.mockImplementation(() =>
            makeFilmsBuilder([{ id: 1, title: 'Not A Real Movie', justwatch_url: null, services: [] }])
        )
        scrapeOneMock.mockResolvedValue({
            ok: true,
            data: { title: 'Not A Real Movie', service: [], error: 'No JustWatch page found' }
        })

        const result = await actions.rescrape({
            params: { id: '1' },
            locals: {}
        } as unknown as Parameters<typeof actions.rescrape>[0])

        expect(result).toEqual({ error: 'No JustWatch page found' })
    })

    it('applyRescrape re-scrapes fresh and applies it', async () => {
        fromMock.mockImplementation(() => makeFilmsBuilder([{ id: 1, title: 'Film A', justwatch_url: null }]))
        scrapeOneMock.mockResolvedValue({ ok: true, data: { title: 'Film A', service: [offer('Tubi')] } })
        applyFilmOffersMock.mockResolvedValue({ ok: true })

        const result = await actions.applyRescrape({
            params: { id: '1' },
            locals: {}
        } as unknown as Parameters<typeof actions.applyRescrape>[0])

        expect(scrapeOneMock).toHaveBeenCalledWith('Film A', undefined)
        expect(applyFilmOffersMock).toHaveBeenCalledWith(1, [offer('Tubi')])
        expect(result).toEqual({ rescraped: true })
    })

    it('applyRescrape surfaces an apply failure', async () => {
        fromMock.mockImplementation(() => makeFilmsBuilder([{ id: 1, title: 'Film A', justwatch_url: null }]))
        scrapeOneMock.mockResolvedValue({ ok: true, data: { title: 'Film A', service: [offer('Tubi')] } })
        applyFilmOffersMock.mockResolvedValue({ ok: false, error: 'insert failed' })

        const result = await actions.applyRescrape({
            params: { id: '1' },
            locals: {}
        } as unknown as Parameters<typeof actions.applyRescrape>[0])

        expect(result).toEqual({ error: 'insert failed' })
    })
})
