import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('$lib/server/requireAdmin', () => ({
    requireAdmin: vi.fn(async () => ({ user: { id: 'admin-1' } }))
}))

const listFilms = vi.fn()
const refreshFilm = vi.fn()
const refreshAllFilms = vi.fn()
const scrapeMany = vi.fn()
vi.mock('$lib/server/scraperClient', () => ({
    listFilms: (...a: unknown[]) => listFilms(...a),
    refreshFilm: (...a: unknown[]) => refreshFilm(...a),
    refreshAllFilms: (...a: unknown[]) => refreshAllFilms(...a),
    scrapeMany: (...a: unknown[]) => scrapeMany(...a)
}))

import { actions } from './+page.server'

const offer = (over: Record<string, unknown> = {}) => ({
    name: 'Netflix',
    type: 'subscription',
    price: null,
    currency: 'USD',
    link: 'https://netflix.com/1',
    icon: 'https://img/1.webp',
    ...over
})

const film = (over: Record<string, unknown> = {}) => ({
    id: 1,
    year: 2025,
    sort_order: 0,
    date: '10/1/2025',
    title: 'Film A',
    justwatch_url: null,
    services: [],
    ...over
})

const evt = () => ({ locals: {} }) as never
const formEvt = (fields: Record<string, string>) => {
    const formData = new FormData()
    for (const [k, v] of Object.entries(fields)) formData.set(k, v)
    return { locals: {}, request: { formData: async () => formData } } as never
}
const scraped = (...films: Record<string, unknown>[]) => ({ ok: true as const, data: films })

beforeEach(() => {
    for (const m of [listFilms, refreshFilm, refreshAllFilms, scrapeMany]) m.mockReset()
})

describe('admin refresh preview action', () => {
    it('diffs every film in the catalogue against its fresh scrape', async () => {
        listFilms.mockResolvedValue({
            ok: true,
            data: [film({ id: 1, services: [{ id: 9, film_id: 1, ...offer({ name: 'Hulu' }) }] })]
        })
        scrapeMany.mockResolvedValue(
            scraped({ title: 'Film A', service: [offer({ name: 'Hulu' }), offer({ name: 'Shudder' })] })
        )

        const result = await actions.preview(evt())

        expect(result).toEqual({
            preview: [
                {
                    filmId: 1,
                    year: 2025,
                    title: 'Film A',
                    oldCount: 1,
                    newCount: 2,
                    added: 1,
                    removed: 0,
                    changed: 0
                }
            ],
            failed: []
        })
    })

    it('sends the scraper every film title and its justwatch_url override', async () => {
        listFilms.mockResolvedValue({
            ok: true,
            data: [
                film({ id: 1, title: 'Film A', justwatch_url: null }),
                film({ id: 2, title: 'The Ring', justwatch_url: 'https://www.justwatch.com/us/movie/le-cercle' })
            ]
        })
        scrapeMany.mockResolvedValue(
            scraped({ title: 'Film A', service: [] }, { title: 'The Ring', service: [] })
        )

        await actions.preview(evt())

        expect(scrapeMany).toHaveBeenCalledWith([
            { title: 'Film A', justwatch_url: undefined },
            { title: 'The Ring', justwatch_url: 'https://www.justwatch.com/us/movie/le-cercle' }
        ])
    })

    // A film the scraper couldn't read is not a film with no offers.
    it('lists a failed scrape separately instead of diffing it as an empty result', async () => {
        listFilms.mockResolvedValue({
            ok: true,
            data: [film({ id: 1, services: [{ id: 9, film_id: 1, ...offer() }] })]
        })
        scrapeMany.mockResolvedValue(scraped({ title: 'Film A', service: [], error: 'no page found' }))

        const result = await actions.preview(evt())

        expect(result).toEqual({ preview: [], failed: ['Film A (2025): no page found'] })
    })

    it('returns the scraper error when the scrape call itself fails', async () => {
        listFilms.mockResolvedValue({ ok: true, data: [film()] })
        scrapeMany.mockResolvedValue({ ok: false, status: 401, error: 'Unauthorized' })

        expect(await actions.preview(evt())).toEqual({ error: 'Unauthorized' })
    })

    it('returns the error when the catalogue read fails', async () => {
        listFilms.mockResolvedValue({ ok: false, status: 502, error: 'Supabase unreachable' })

        expect(await actions.preview(evt())).toEqual({ error: 'Supabase unreachable' })
        expect(scrapeMany).not.toHaveBeenCalled()
    })

    // /api/scrape answers in request order, so this path still pairs by
    // index and still has to refuse a length mismatch.
    it('refuses rather than mispairing when the scraper returns the wrong number of results', async () => {
        listFilms.mockResolvedValue({ ok: true, data: [film({ id: 1 }), film({ id: 2, title: 'Film B' })] })
        scrapeMany.mockResolvedValue(scraped({ title: 'Film A', service: [] }))

        const result = await actions.preview(evt())

        expect(result).toEqual({
            error: 'Scraper returned 1 results for 2 films. Nothing was changed.'
        })
    })

    it('does not call the scraper when there are no films', async () => {
        listFilms.mockResolvedValue({ ok: true, data: [] })

        expect(await actions.preview(evt())).toEqual({ preview: [], failed: [] })
        expect(scrapeMany).not.toHaveBeenCalled()
    })
})

describe('admin refresh applyOne action', () => {
    it('refreshes the film server-side', async () => {
        refreshFilm.mockResolvedValue({
            ok: true,
            data: { film_id: 7, title: 'Film A', refreshed: true, services_updated: 3 }
        })

        const result = await actions.applyOne(formEvt({ filmId: '7' }))

        expect(refreshFilm).toHaveBeenCalledWith(7)
        expect(result).toEqual({ appliedOne: 7 })
    })

    it('returns an error when the film is not found', async () => {
        refreshFilm.mockResolvedValue({ ok: false, status: 404, error: 'not found' })

        expect(await actions.applyOne(formEvt({ filmId: '999' }))).toEqual({ error: 'Film not found.' })
    })

    it('says the offers were left alone when the scrape fails', async () => {
        refreshFilm.mockResolvedValue({
            ok: true,
            data: { film_id: 7, title: 'Film A', refreshed: false, error: 'no page found.' }
        })

        expect(await actions.applyOne(formEvt({ filmId: '7' }))).toEqual({
            error: 'no page found. The existing offers were left unchanged.'
        })
    })
})

describe('admin refresh applyAll action', () => {
    it('reports how many refreshed and names the ones that did not', async () => {
        listFilms.mockResolvedValue({ ok: true, data: [film({ id: 1 }), film({ id: 2, title: 'Film B' })] })
        refreshAllFilms.mockResolvedValue({
            ok: true,
            data: {
                films: 2,
                refreshed: 1,
                results: [
                    { film_id: 1, title: 'Film A', refreshed: true, services_updated: 3 },
                    { film_id: 2, title: 'Film B', refreshed: false, error: 'no page found' }
                ]
            }
        })

        const result = await actions.applyAll(evt())

        expect(result).toEqual({
            appliedAll: 1,
            errors: ['Film B: no page found'],
            cleared: []
        })
    })

    // The "every readable film came back empty" refusal is the scraper's
    // rule now. This renders its message rather than reimplementing it.
    it('surfaces the scraper refusing a run that found offers for nothing', async () => {
        listFilms.mockResolvedValue({ ok: true, data: [film()] })
        refreshAllFilms.mockResolvedValue({
            ok: false,
            status: 502,
            error: 'Refused: every readable film scraped empty. Nothing was written.'
        })

        expect(await actions.applyAll(evt())).toEqual({
            error: 'Refused: every readable film scraped empty. Nothing was written.'
        })
    })

    it('names the films that went from having offers to having none', async () => {
        listFilms.mockResolvedValue({
            ok: true,
            data: [film({ id: 1, services: [{ id: 9, film_id: 1, ...offer() }, { id: 10, film_id: 1, ...offer({ name: 'Hulu' }) }] })]
        })
        refreshAllFilms.mockResolvedValue({
            ok: true,
            data: {
                films: 1,
                refreshed: 1,
                results: [{ film_id: 1, title: 'Film A', refreshed: true, services_updated: 0 }]
            }
        })

        const result = await actions.applyAll(evt())

        expect(result).toMatchObject({
            cleared: ['Film A — 2 offer(s) removed, now streaming nowhere']
        })
    })

    it('does not flag a film that already had no offers', async () => {
        listFilms.mockResolvedValue({ ok: true, data: [film({ id: 1, services: [] })] })
        refreshAllFilms.mockResolvedValue({
            ok: true,
            data: {
                films: 1,
                refreshed: 1,
                results: [{ film_id: 1, title: 'Film A', refreshed: true, services_updated: 0 }]
            }
        })

        expect(await actions.applyAll(evt())).toMatchObject({ cleared: [] })
    })

    // Losing the before-picture costs the `cleared` report, not the refresh.
    it('still refreshes when the pre-run catalogue read fails', async () => {
        listFilms.mockResolvedValue({ ok: false, status: 502, error: 'Supabase unreachable' })
        refreshAllFilms.mockResolvedValue({
            ok: true,
            data: {
                films: 1,
                refreshed: 1,
                results: [{ film_id: 1, title: 'Film A', refreshed: true, services_updated: 4 }]
            }
        })

        const result = await actions.applyAll(evt())

        expect(result).toEqual({ appliedAll: 1, errors: [], cleared: [] })
    })
})
