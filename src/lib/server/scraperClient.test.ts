import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    createFilm,
    deleteFilm,
    getFilm,
    listFilms,
    refreshAllFilms,
    refreshFilm,
    scrapeMany,
    scrapeOne,
    updateFilm
} from './scraperClient'

function fakeResponse(status: number, body: unknown) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body
    } as Response
}

describe('scraperClient', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    describe('scrapeMany', () => {
        it('POSTs the film list with the API key header and returns one result per film', async () => {
            const fetchMock = vi.fn(async () =>
                fakeResponse(200, [
                    { title: 'The Ring', url: 'https://www.justwatch.com/us/movie/le-cercle', service: [] },
                    { title: 'Film B', service: [] }
                ])
            )
            vi.stubGlobal('fetch', fetchMock)

            const result = await scrapeMany([
                { title: 'The Ring', justwatch_url: 'https://www.justwatch.com/us/movie/le-cercle' },
                { title: 'Film B' }
            ])

            expect(result.ok).toBe(true)
            expect(fetchMock).toHaveBeenCalledWith(
                'https://31for31scraper.vercel.app/api/scrape',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({ 'X-API-Key': expect.any(String) }),
                    body: JSON.stringify([
                        { title: 'The Ring', justwatch_url: 'https://www.justwatch.com/us/movie/le-cercle' },
                        { title: 'Film B' }
                    ])
                })
            )
        })

        // A film that couldn't be scraped rides along inside a 200 with an
        // error of its own — it must not look like a failed call.
        it('treats a per-film error inside a 200 as success', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn(async () =>
                    fakeResponse(200, [{ title: 'Obscure', service: [], error: 'No JustWatch page found' }])
                )
            )

            const result = await scrapeMany([{ title: 'Obscure' }])

            expect(result).toEqual({
                ok: true,
                data: [{ title: 'Obscure', service: [], error: 'No JustWatch page found' }]
            })
        })

        it('returns an error on a 400 (malformed body)', async () => {
            vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(400, { error: 'films must be a non-empty array' })))

            const result = await scrapeMany([])

            expect(result).toEqual({ ok: false, status: 400, error: 'films must be a non-empty array' })
        })

        it('returns an error on a 401 (bad key)', async () => {
            vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(401, { error: 'Unauthorized' })))

            const result = await scrapeMany([{ title: 'Film A' }])

            expect(result).toEqual({ ok: false, status: 401, error: 'Unauthorized' })
        })
    })

    describe('scrapeOne', () => {
        it('GETs /api/scrape with title and url params and returns the film result', async () => {
            const fetchMock = vi.fn(async (_url: string) =>
                fakeResponse(200, { title: 'A', url: 'https://justwatch.com/a', service: [] })
            )
            vi.stubGlobal('fetch', fetchMock)

            const result = await scrapeOne('A', 'https://justwatch.com/a-override')

            expect(result).toEqual({ ok: true, data: { title: 'A', url: 'https://justwatch.com/a', service: [] } })
            const calledUrl = fetchMock.mock.calls[0][0]
            expect(calledUrl).toContain('/api/scrape?')
            expect(calledUrl).toContain('title=A')
            expect(calledUrl).toContain('url=')
        })

        it('treats a 404 (no JustWatch page found) as a successful call with an inline error', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn(async () => fakeResponse(404, { title: 'Not A Real Movie', service: [], error: 'No JustWatch page found' }))
            )

            const result = await scrapeOne('Not A Real Movie')

            expect(result).toEqual({
                ok: true,
                data: { title: 'Not A Real Movie', service: [], error: 'No JustWatch page found' }
            })
        })

        it('treats a 502 (JustWatch request failed) as a successful call with an inline error', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn(async () => fakeResponse(502, { title: 'Blood Feast', service: [], error: 'Read timed out.' }))
            )

            const result = await scrapeOne('Blood Feast')

            expect(result.ok).toBe(true)
            expect(result.ok && result.data.error).toBe('Read timed out.')
        })

        it('treats a 401 as a hard client-level error', async () => {
            vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(401, { error: 'Unauthorized' })))

            const result = await scrapeOne('Anything')

            expect(result).toEqual({ ok: false, status: 401, error: 'Unauthorized' })
        })
    })
})

describe('scraperClient catalogue endpoints', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    const film = { id: 20, year: 2024, sort_order: 19, date: '10/20/2024', title: 'The Ring', justwatch_url: null, services: [] }

    it('listFilms GETs /films with the API key', async () => {
        const fetchMock = vi.fn(async () => fakeResponse(200, [film]))
        vi.stubGlobal('fetch', fetchMock)

        const result = await listFilms()

        expect(result).toEqual({ ok: true, data: [film] })
        expect(fetchMock).toHaveBeenCalledWith(
            'https://31for31scraper.vercel.app/films',
            expect.objectContaining({ headers: expect.objectContaining({ 'X-API-Key': expect.any(String) }) })
        )
    })

    it('listFilms passes a year filter through as a query parameter', async () => {
        const fetchMock = vi.fn(async (_url: string) => fakeResponse(200, []))
        vi.stubGlobal('fetch', fetchMock)

        await listFilms(2024)

        expect(fetchMock.mock.calls[0][0]).toBe('https://31for31scraper.vercel.app/films?year=2024')
    })

    // The read is authenticated now, so an unauthorised call must surface as
    // a failure rather than an empty catalogue.
    it('listFilms reports a 401 as a failed result, not an empty list', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(401, { error: 'Unauthorized' })))

        expect(await listFilms()).toEqual({ ok: false, status: 401, error: 'Unauthorized' })
    })

    it('getFilm surfaces a 404 with its status so callers can 404 the page', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(404, { error: 'film not found' })))

        expect(await getFilm(999)).toEqual({ ok: false, status: 404, error: 'film not found' })
    })

    it('createFilm POSTs the body and returns the created film', async () => {
        const fetchMock = vi.fn(async () => fakeResponse(201, film))
        vi.stubGlobal('fetch', fetchMock)

        const result = await createFilm({ year: 2024, date: '10/20/2024', title: 'The Ring' })

        expect(result).toEqual({ ok: true, data: film })
        expect(fetchMock).toHaveBeenCalledWith(
            'https://31for31scraper.vercel.app/films',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ year: 2024, date: '10/20/2024', title: 'The Ring' })
            })
        )
    })

    it('createFilm reports a 409 duplicate with its status', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(409, { error: 'already exists' })))

        expect(await createFilm({ year: 2024, date: 'x', title: 'The Ring' })).toEqual({
            ok: false,
            status: 409,
            error: 'already exists'
        })
    })

    // Sending null is how the override is cleared; it must survive
    // serialisation rather than being dropped as undefined.
    it('updateFilm PATCHes a null justwatch_url through to clear the override', async () => {
        const fetchMock = vi.fn(async () => fakeResponse(200, film))
        vi.stubGlobal('fetch', fetchMock)

        await updateFilm(20, { justwatch_url: null })

        expect(fetchMock).toHaveBeenCalledWith(
            'https://31for31scraper.vercel.app/films/20',
            expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ justwatch_url: null }) })
        )
    })

    // 204 has no body at all, so parsing one would throw.
    it('deleteFilm treats a 204 as success without reading a body', async () => {
        const json = vi.fn(async () => {
            throw new Error('should not parse a 204 body')
        })
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 204, json }) as unknown as Response))

        expect(await deleteFilm(20)).toEqual({ ok: true, data: null })
        expect(json).not.toHaveBeenCalled()
    })

    it('deleteFilm reports a 404 with its status', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(404, { error: 'film not found' })))

        expect(await deleteFilm(999)).toEqual({ ok: false, status: 404, error: 'film not found' })
    })

    it('refreshFilm POSTs and returns the per-film summary', async () => {
        const summary = { film_id: 20, title: 'The Ring', refreshed: true, services_updated: 16 }
        const fetchMock = vi.fn(async () => fakeResponse(200, summary))
        vi.stubGlobal('fetch', fetchMock)

        expect(await refreshFilm(20)).toEqual({ ok: true, data: summary })
        expect(fetchMock).toHaveBeenCalledWith(
            'https://31for31scraper.vercel.app/films/20/refresh',
            expect.objectContaining({ method: 'POST' })
        )
    })

    // 502 means the scrape failed and the stored offers were left alone --
    // the caller distinguishes that from a refresh to zero offers.
    it('refreshFilm reports a 502 with its status', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(502, { error: 'JustWatch unreachable' })))

        expect(await refreshFilm(20)).toEqual({ ok: false, status: 502, error: 'JustWatch unreachable' })
    })

    it('refreshAllFilms returns the batch summary', async () => {
        const batch = { films: 2, refreshed: 2, results: [] }
        vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(200, batch)))

        expect(await refreshAllFilms()).toEqual({ ok: true, data: batch })
    })
})
