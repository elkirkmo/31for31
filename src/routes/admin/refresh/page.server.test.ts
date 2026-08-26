import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('$lib/server/requireAdmin', () => ({
    requireAdmin: vi.fn(async () => ({ user: { id: 'admin-1' } }))
}))

const scrapeManyMock = vi.fn()
const scrapeOneMock = vi.fn()
vi.mock('$lib/server/scraperClient', () => ({
    scrapeMany: (...args: unknown[]) => scrapeManyMock(...args),
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

import { actions } from './+page.server'

function offer(name: string, overrides: Record<string, unknown> = {}) {
    return { name, type: 'free', price: null, currency: null, link: null, icon: null, ...overrides }
}

// .from('films').select(...).order(...).order(...) awaited — used by
// loadFilmsWithServices in preview/applyAll. Results are paired with this
// list by index, so its order is what the pairing depends on.
function thenableFilms(rows: Record<string, unknown>[]) {
    const awaited = { then: (resolve: (v: unknown) => void) => resolve({ data: rows }) }
    return { select: vi.fn(() => ({ order: vi.fn(() => ({ order: vi.fn(() => awaited) })) })) }
}

// One scraper result per film, in the same order as the request.
function scraped(...entries: Record<string, unknown>[]) {
    return { ok: true, data: entries }
}

// .from('films').select(...).eq(...).single() — used by applyOne.
function singleFilm(row: Record<string, unknown> | null) {
    return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: row })) })) })) }
}

describe('admin refresh preview action', () => {
    beforeEach(() => {
        scrapeManyMock.mockReset()
        fromMock.mockReset()
    })

    it('diffs every film in our table against its fresh scrape', async () => {
        fromMock.mockReturnValue(
            thenableFilms([
                {
                    id: 1,
                    year: 2025,
                    title: 'Film A',
                    justwatch_url: null,
                    services: [offer('Netflix', { type: 'subscription' })]
                }
            ])
        )
        scrapeManyMock.mockResolvedValue(
            scraped({ title: 'Film A', service: [offer('Tubi', { type: 'free' })] })
        )

        const result = await actions.preview({ locals: {} } as unknown as Parameters<typeof actions.preview>[0])

        expect(result).toEqual({
            preview: [
                { filmId: 1, year: 2025, title: 'Film A', oldCount: 1, newCount: 1, added: 1, removed: 1, changed: 0 }
            ],
            failed: []
        })
    })

    // Our table is the list now — the scraper is told what to scrape rather
    // than consulting its own copy, and the override travels with the title.
    it('sends the scraper every film title and its justwatch_url override', async () => {
        fromMock.mockReturnValue(
            thenableFilms([
                { id: 1, year: 2024, title: 'The Ring', justwatch_url: 'https://www.justwatch.com/us/movie/le-cercle', services: [] },
                { id: 2, year: 2025, title: 'Film B', justwatch_url: null, services: [] }
            ])
        )
        scrapeManyMock.mockResolvedValue(
            scraped({ title: 'The Ring', service: [] }, { title: 'Film B', service: [] })
        )

        await actions.preview({ locals: {} } as unknown as Parameters<typeof actions.preview>[0])

        expect(scrapeManyMock).toHaveBeenCalledWith([
            { title: 'The Ring', justwatch_url: 'https://www.justwatch.com/us/movie/le-cercle' },
            { title: 'Film B', justwatch_url: undefined }
        ])
    })

    // A film the scraper couldn't read is not a film with no offers.
    // Diffing it would report every offer being removed.
    it('lists a failed scrape separately instead of diffing it as an empty result', async () => {
        fromMock.mockReturnValue(
            thenableFilms([
                { id: 1, year: 2025, title: 'Film A', justwatch_url: null, services: [offer('Tubi')] },
                { id: 2, year: 2025, title: 'Obscure Film', justwatch_url: null, services: [offer('Netflix')] }
            ])
        )
        scrapeManyMock.mockResolvedValue(
            scraped(
                { title: 'Film A', service: [offer('Tubi')] },
                { title: 'Obscure Film', service: [], error: 'No JustWatch page found' }
            )
        )

        const result = (await actions.preview({ locals: {} } as unknown as Parameters<typeof actions.preview>[0])) as {
            preview: { title: string }[]
            failed: string[]
        }

        expect(result.preview.map((r) => r.title)).toEqual(['Film A'])
        expect(result.failed).toEqual(['Obscure Film (2025): No JustWatch page found'])
    })

    it('returns the scraper error when the call itself fails', async () => {
        fromMock.mockReturnValue(thenableFilms([{ id: 1, year: 2025, title: 'Film A', justwatch_url: null, services: [] }]))
        scrapeManyMock.mockResolvedValue({ ok: false, status: 500, error: 'ADMIN_API_KEY is not configured' })

        const result = await actions.preview({ locals: {} } as unknown as Parameters<typeof actions.preview>[0])

        expect(result).toEqual({ error: 'ADMIN_API_KEY is not configured' })
    })

    // Results are paired with films by index, so a length mismatch would
    // write every film after the discrepancy with another film's offers.
    it('refuses rather than mispairing when the scraper returns the wrong number of results', async () => {
        fromMock.mockReturnValue(
            thenableFilms([
                { id: 1, year: 2025, title: 'Film A', justwatch_url: null, services: [] },
                { id: 2, year: 2025, title: 'Film B', justwatch_url: null, services: [] }
            ])
        )
        scrapeManyMock.mockResolvedValue(scraped({ title: 'Film A', service: [offer('Tubi')] }))

        const result = await actions.preview({ locals: {} } as unknown as Parameters<typeof actions.preview>[0])

        expect(result).toMatchObject({ error: expect.stringContaining('1 results for 2 films') })
    })

    it('does not call the scraper when there are no films', async () => {
        fromMock.mockReturnValue(thenableFilms([]))

        const result = await actions.preview({ locals: {} } as unknown as Parameters<typeof actions.preview>[0])

        expect(result).toEqual({ preview: [], failed: [] })
        expect(scrapeManyMock).not.toHaveBeenCalled()
    })
})

describe('admin refresh applyOne action', () => {
    function formDataRequest(fields: Record<string, string>) {
        const formData = new FormData()
        for (const [key, value] of Object.entries(fields)) formData.set(key, value)
        return { formData: async () => formData } as unknown as Request
    }

    beforeEach(() => {
        fromMock.mockReset()
        scrapeOneMock.mockReset()
        applyFilmOffersMock.mockReset()
    })

    it('re-scrapes the film fresh and applies it', async () => {
        fromMock.mockReturnValue(singleFilm({ title: 'Film A', justwatch_url: null }))
        scrapeOneMock.mockResolvedValue({ ok: true, data: { title: 'Film A', service: [offer('Tubi')] } })
        applyFilmOffersMock.mockResolvedValue({ ok: true })

        const event = {
            request: formDataRequest({ filmId: '1' }),
            locals: {}
        } as unknown as Parameters<typeof actions.applyOne>[0]

        const result = await actions.applyOne(event)

        expect(scrapeOneMock).toHaveBeenCalledWith('Film A', undefined)
        expect(applyFilmOffersMock).toHaveBeenCalledWith(1, [offer('Tubi')])
        expect(result).toEqual({ appliedOne: 1 })
    })

    it('returns an error when the film is not found', async () => {
        fromMock.mockReturnValue(singleFilm(null))

        const event = {
            request: formDataRequest({ filmId: '999' }),
            locals: {}
        } as unknown as Parameters<typeof actions.applyOne>[0]

        const result = await actions.applyOne(event)

        expect(result).toEqual({ error: 'Film not found.' })
        expect(scrapeOneMock).not.toHaveBeenCalled()
    })

    it('returns the inline scrape error without applying', async () => {
        fromMock.mockReturnValue(singleFilm({ title: 'Not A Real Movie', justwatch_url: null }))
        scrapeOneMock.mockResolvedValue({ ok: true, data: { title: 'Not A Real Movie', service: [], error: 'No JustWatch page found' } })

        const event = {
            request: formDataRequest({ filmId: '1' }),
            locals: {}
        } as unknown as Parameters<typeof actions.applyOne>[0]

        const result = await actions.applyOne(event)

        expect(result).toEqual({ error: 'No JustWatch page found' })
        expect(applyFilmOffersMock).not.toHaveBeenCalled()
    })
})

describe('admin refresh applyAll action', () => {
    beforeEach(() => {
        fromMock.mockReset()
        scrapeManyMock.mockReset()
        applyFilmOffersMock.mockReset()
    })

    it('applies every film that scraped cleanly and reports the ones that did not', async () => {
        fromMock.mockReturnValue(
            thenableFilms([
                { id: 1, year: 2025, title: 'Film A', justwatch_url: null, services: [] },
                { id: 2, year: 2025, title: 'Film B', justwatch_url: null, services: [] }
            ])
        )
        scrapeManyMock.mockResolvedValue(
            scraped(
                { title: 'Film A', service: [offer('Tubi')] },
                { title: 'Film B', service: [], error: 'timed out' }
            )
        )
        applyFilmOffersMock.mockResolvedValue({ ok: true })

        const result = await actions.applyAll({ locals: {} } as unknown as Parameters<typeof actions.applyAll>[0])

        expect(applyFilmOffersMock).toHaveBeenCalledTimes(1)
        expect(applyFilmOffersMock).toHaveBeenCalledWith(1, [offer('Tubi')])
        expect(result).toEqual({ appliedAll: 1, errors: ['Film B: timed out'], cleared: [] })
    })

    // The rule: a couple of films streaming nowhere is normal, every film
    // streaming nowhere is a broken scrape.
    it('refuses the whole run when the scrape found offers for nothing', async () => {
        fromMock.mockReturnValue(
            thenableFilms([
                { id: 1, year: 2025, title: 'Film A', justwatch_url: null, services: [offer('Tubi')] },
                { id: 2, year: 2025, title: 'Film B', justwatch_url: null, services: [offer('Netflix')] }
            ])
        )
        scrapeManyMock.mockResolvedValue(
            scraped({ title: 'Film A', service: [] }, { title: 'Film B', service: [] })
        )

        const result = await actions.applyAll({ locals: {} } as unknown as Parameters<typeof actions.applyAll>[0])

        expect(applyFilmOffersMock).not.toHaveBeenCalled()
        expect(result).toMatchObject({ error: expect.stringContaining('no streaming offers for any') })
    })

    it('proceeds when even one film still has offers', async () => {
        fromMock.mockReturnValue(
            thenableFilms([
                { id: 1, year: 2025, title: 'Film A', justwatch_url: null, services: [] },
                { id: 2, year: 2025, title: 'Film B', justwatch_url: null, services: [offer('Netflix')] }
            ])
        )
        scrapeManyMock.mockResolvedValue(
            scraped({ title: 'Film A', service: [offer('Tubi')] }, { title: 'Film B', service: [] })
        )
        applyFilmOffersMock.mockResolvedValue({ ok: true })

        const result = await actions.applyAll({ locals: {} } as unknown as Parameters<typeof actions.applyAll>[0])

        expect(applyFilmOffersMock).toHaveBeenCalledTimes(2)
        expect(result).toMatchObject({ appliedAll: 2 })
    })

    // A failed scrape must not count towards the all-empty guard, or one
    // broken run could look like "every film has offers" and sail through.
    it('does not let failed scrapes satisfy the all-empty guard', async () => {
        fromMock.mockReturnValue(
            thenableFilms([
                { id: 1, year: 2025, title: 'Film A', justwatch_url: null, services: [offer('Tubi')] },
                { id: 2, year: 2025, title: 'Film B', justwatch_url: null, services: [offer('Netflix')] }
            ])
        )
        scrapeManyMock.mockResolvedValue(
            scraped(
                { title: 'Film A', service: [], error: 'timed out' },
                { title: 'Film B', service: [] }
            )
        )

        const result = await actions.applyAll({ locals: {} } as unknown as Parameters<typeof actions.applyAll>[0])

        expect(applyFilmOffersMock).not.toHaveBeenCalled()
        expect(result).toMatchObject({ error: expect.stringContaining('no streaming offers for any') })
    })

    it('names the films that went from having offers to having none', async () => {
        fromMock.mockReturnValue(
            thenableFilms([
                { id: 1, year: 2025, title: 'Film A', justwatch_url: null, services: [] },
                {
                    id: 2,
                    year: 2025,
                    title: 'Bride of Frankenstein',
                    justwatch_url: null,
                    services: [offer('Netflix'), offer('Tubi')]
                }
            ])
        )
        scrapeManyMock.mockResolvedValue(
            scraped({ title: 'Film A', service: [offer('Tubi')] }, { title: 'Bride of Frankenstein', service: [] })
        )
        applyFilmOffersMock.mockResolvedValue({ ok: true })

        const result = await actions.applyAll({ locals: {} } as unknown as Parameters<typeof actions.applyAll>[0])

        expect(result).toMatchObject({
            cleared: ['Bride of Frankenstein — 2 offer(s) removed, now streaming nowhere']
        })
    })

    it('does not flag a film that already had no offers', async () => {
        fromMock.mockReturnValue(
            thenableFilms([
                { id: 1, year: 2025, title: 'Film A', justwatch_url: null, services: [] },
                { id: 2, year: 2025, title: 'Thanksgiving', justwatch_url: null, services: [] }
            ])
        )
        scrapeManyMock.mockResolvedValue(
            scraped({ title: 'Film A', service: [offer('Tubi')] }, { title: 'Thanksgiving', service: [] })
        )
        applyFilmOffersMock.mockResolvedValue({ ok: true })

        const result = await actions.applyAll({ locals: {} } as unknown as Parameters<typeof actions.applyAll>[0])

        expect(result).toMatchObject({ cleared: [] })
    })

    it('refuses rather than mispairing when the scraper returns the wrong number of results', async () => {
        fromMock.mockReturnValue(
            thenableFilms([
                { id: 1, year: 2025, title: 'Film A', justwatch_url: null, services: [] },
                { id: 2, year: 2025, title: 'Film B', justwatch_url: null, services: [] }
            ])
        )
        scrapeManyMock.mockResolvedValue(scraped({ title: 'Film A', service: [offer('Tubi')] }))

        const result = await actions.applyAll({ locals: {} } as unknown as Parameters<typeof actions.applyAll>[0])

        expect(applyFilmOffersMock).not.toHaveBeenCalled()
        expect(result).toMatchObject({ error: expect.stringContaining('1 results for 2 films') })
    })
})
