import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('$lib/server/requireAdmin', () => ({
    requireAdmin: vi.fn(async () => ({ user: { id: 'admin-1' } }))
}))

const scrapeAllMock = vi.fn()
const scrapeOneMock = vi.fn()
vi.mock('$lib/server/scraperClient', () => ({
    scrapeAll: (...args: unknown[]) => scrapeAllMock(...args),
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

// .from('films').select(...) awaited directly (no .eq/.single) — used by
// loadFilmsWithServices in preview/applyAll.
function thenableFilms(rows: Record<string, unknown>[]) {
    return { select: vi.fn(() => ({ then: (resolve: (v: unknown) => void) => resolve({ data: rows }) })) }
}

// .from('films').select(...).eq(...).single() — used by applyOne.
function singleFilm(row: Record<string, unknown> | null) {
    return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: row })) })) })) }
}

describe('admin refresh preview action', () => {
    beforeEach(() => {
        scrapeAllMock.mockReset()
        fromMock.mockReset()
    })

    it('diffs matched films and lists unmatched scraper entries', async () => {
        scrapeAllMock.mockResolvedValue({
            ok: true,
            data: {
                '2025': [
                    { id: 202501, title: 'Film A', date: '10/1/2025', service: [offer('Tubi', { type: 'free' })] },
                    { id: 202502, title: 'Unknown Film', date: '10/2/2025', service: [] }
                ],
                textContent: { heading: 'not a film list' }
            }
        })
        fromMock.mockReturnValue(
            thenableFilms([{ id: 1, year: 2025, title: 'Film A', services: [offer('Netflix', { type: 'subscription' })] }])
        )

        const result = await actions.preview({ locals: {} } as unknown as Parameters<typeof actions.preview>[0])

        expect(result).toEqual({
            preview: [
                { filmId: 1, year: 2025, title: 'Film A', oldCount: 1, newCount: 1, added: 1, removed: 1, changed: 0 }
            ],
            unmatched: ['Unknown Film (2025)']
        })
    })

    it('returns the scraper error and does not query films when scrapeAll fails', async () => {
        scrapeAllMock.mockResolvedValue({ ok: false, status: 500, error: 'ADMIN_API_KEY is not configured' })

        const result = await actions.preview({ locals: {} } as unknown as Parameters<typeof actions.preview>[0])

        expect(result).toEqual({ error: 'ADMIN_API_KEY is not configured' })
        expect(fromMock).not.toHaveBeenCalled()
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
        scrapeAllMock.mockReset()
        applyFilmOffersMock.mockReset()
    })

    it('applies every matched film and reports per-film scrape errors', async () => {
        scrapeAllMock.mockResolvedValue({
            ok: true,
            data: {
                '2025': [
                    { id: 202501, title: 'Film A', date: '10/1/2025', service: [offer('Tubi')] },
                    { id: 202502, title: 'Film B', date: '10/2/2025', service: [], error: 'timed out' },
                    { id: 202503, title: 'Unmatched Film', date: '10/3/2025', service: [] }
                ]
            }
        })
        fromMock.mockReturnValue(
            thenableFilms([
                { id: 1, year: 2025, title: 'Film A', services: [] },
                { id: 2, year: 2025, title: 'Film B', services: [] }
            ])
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
        scrapeAllMock.mockResolvedValue({
            ok: true,
            data: {
                '2025': [
                    { id: 202501, title: 'Film A', date: '10/1/2025', service: [] },
                    { id: 202502, title: 'Film B', date: '10/2/2025', service: [] }
                ]
            }
        })
        fromMock.mockReturnValue(
            thenableFilms([
                { id: 1, year: 2025, title: 'Film A', services: [offer('Tubi')] },
                { id: 2, year: 2025, title: 'Film B', services: [offer('Netflix')] }
            ])
        )

        const result = await actions.applyAll({ locals: {} } as unknown as Parameters<typeof actions.applyAll>[0])

        expect(applyFilmOffersMock).not.toHaveBeenCalled()
        expect(result).toMatchObject({ error: expect.stringContaining('no streaming offers for any') })
    })

    it('proceeds when even one film still has offers', async () => {
        scrapeAllMock.mockResolvedValue({
            ok: true,
            data: {
                '2025': [
                    { id: 202501, title: 'Film A', date: '10/1/2025', service: [offer('Tubi')] },
                    { id: 202502, title: 'Film B', date: '10/2/2025', service: [] }
                ]
            }
        })
        fromMock.mockReturnValue(
            thenableFilms([
                { id: 1, year: 2025, title: 'Film A', services: [] },
                { id: 2, year: 2025, title: 'Film B', services: [offer('Netflix')] }
            ])
        )
        applyFilmOffersMock.mockResolvedValue({ ok: true })

        const result = await actions.applyAll({ locals: {} } as unknown as Parameters<typeof actions.applyAll>[0])

        expect(applyFilmOffersMock).toHaveBeenCalledTimes(2)
        expect(result).toMatchObject({ appliedAll: 2 })
    })

    it('names the films that went from having offers to having none', async () => {
        scrapeAllMock.mockResolvedValue({
            ok: true,
            data: {
                '2025': [
                    { id: 202501, title: 'Film A', date: '10/1/2025', service: [offer('Tubi')] },
                    { id: 202502, title: 'Bride of Frankenstein', date: '10/2/2025', service: [] }
                ]
            }
        })
        fromMock.mockReturnValue(
            thenableFilms([
                { id: 1, year: 2025, title: 'Film A', services: [] },
                {
                    id: 2,
                    year: 2025,
                    title: 'Bride of Frankenstein',
                    services: [offer('Netflix'), offer('Tubi')]
                }
            ])
        )
        applyFilmOffersMock.mockResolvedValue({ ok: true })

        const result = await actions.applyAll({ locals: {} } as unknown as Parameters<typeof actions.applyAll>[0])

        expect(result).toMatchObject({
            cleared: ['Bride of Frankenstein — 2 offer(s) removed, now streaming nowhere']
        })
    })

    it('does not flag a film that already had no offers', async () => {
        scrapeAllMock.mockResolvedValue({
            ok: true,
            data: {
                '2025': [
                    { id: 202501, title: 'Film A', date: '10/1/2025', service: [offer('Tubi')] },
                    { id: 202502, title: 'Thanksgiving', date: '10/2/2025', service: [] }
                ]
            }
        })
        fromMock.mockReturnValue(
            thenableFilms([
                { id: 1, year: 2025, title: 'Film A', services: [] },
                { id: 2, year: 2025, title: 'Thanksgiving', services: [] }
            ])
        )
        applyFilmOffersMock.mockResolvedValue({ ok: true })

        const result = await actions.applyAll({ locals: {} } as unknown as Parameters<typeof actions.applyAll>[0])

        expect(result).toMatchObject({ cleared: [] })
    })
})
