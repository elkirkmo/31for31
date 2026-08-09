import { describe, expect, it, vi, beforeEach } from 'vitest'
import { isHttpError } from '@sveltejs/kit'

vi.mock('$lib/server/requireAdmin', () => ({
    requireAdmin: vi.fn(async () => ({ user: { id: 'admin-1' } }))
}))

const replaceYearMock = vi.fn()
const scrapeOneMock = vi.fn()
vi.mock('$lib/server/scraperClient', () => ({
    replaceYear: (...args: unknown[]) => replaceYearMock(...args),
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
    const yearFilms = [
        { id: 1, date: '10/1/2025', title: 'Film A', justwatch_url: null, year: 2025 },
        { id: 2, date: '10/2/2025', title: 'Film B', justwatch_url: 'https://x', year: 2025 }
    ]

    beforeEach(() => {
        fromMock.mockReset()
        replaceYearMock.mockReset()
        fromMock.mockImplementation(() => makeFilmsBuilder(yearFilms))
    })

    function formDataRequest(fields: Record<string, string>) {
        const formData = new FormData()
        for (const [key, value] of Object.entries(fields)) formData.set(key, value)
        return { formData: async () => formData } as unknown as Request
    }

    it('update rebuilds the full year list from our table and PUTs it to the scraper', async () => {
        replaceYearMock.mockResolvedValue({ ok: true, data: [] })

        const event = {
            request: formDataRequest({ title: 'Film A Renamed', date: '10/1/2025', justwatch_url: '' }),
            params: { id: '1' },
            locals: {}
        } as unknown as Parameters<typeof actions.update>[0]

        const result = await actions.update(event)

        expect(replaceYearMock).toHaveBeenCalledWith('2025', [
            { title: 'Film A Renamed', date: '10/1/2025', justwatch_url: undefined },
            { title: 'Film B', date: '10/2/2025', justwatch_url: 'https://x' }
        ])
        expect(result).toEqual({ success: true })
    })

    it('update returns an error when title is blank', async () => {
        const event = {
            request: formDataRequest({ title: '  ', date: '', justwatch_url: '' }),
            params: { id: '1' },
            locals: {}
        } as unknown as Parameters<typeof actions.update>[0]

        const result = await actions.update(event)

        expect(result).toEqual({ error: 'Title is required.' })
        expect(replaceYearMock).not.toHaveBeenCalled()
    })

    it('update surfaces the scraper error on failure', async () => {
        replaceYearMock.mockResolvedValue({ ok: false, status: 401, error: 'Unauthorized' })

        const event = {
            request: formDataRequest({ title: 'Film A', date: '', justwatch_url: '' }),
            params: { id: '1' },
            locals: {}
        } as unknown as Parameters<typeof actions.update>[0]

        const result = await actions.update(event)

        expect(result).toEqual({ error: 'Unauthorized' })
    })

    it('delete removes the film from the year list before PUTing it to the scraper', async () => {
        replaceYearMock.mockResolvedValue({ ok: true, data: [] })

        const event = {
            params: { id: '1' },
            locals: {}
        } as unknown as Parameters<typeof actions.delete>[0]

        const result = await actions.delete(event)

        expect(replaceYearMock).toHaveBeenCalledWith('2025', [
            { title: 'Film B', date: '10/2/2025', justwatch_url: 'https://x' }
        ])
        expect(result).toEqual({ success: true, deleted: true })
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
