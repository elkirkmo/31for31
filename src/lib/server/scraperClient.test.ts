import { afterEach, describe, expect, it, vi } from 'vitest'
import { addFilm, replaceYear, scrapeAll, scrapeOne } from './scraperClient'

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

    describe('addFilm', () => {
        it('sends a POST with the X-API-Key header and returns the created film', async () => {
            const fetchMock = vi.fn(async () =>
                fakeResponse(201, { id: 202601, title: 'Some Movie', date: '10/1/2026', service: [] })
            )
            vi.stubGlobal('fetch', fetchMock)

            const result = await addFilm('2026', { title: 'Some Movie', date: '10/1/2026' })

            expect(result).toEqual({
                ok: true,
                data: { id: 202601, title: 'Some Movie', date: '10/1/2026', service: [] }
            })
            expect(fetchMock).toHaveBeenCalledWith(
                'https://31for31scraper.vercel.app/api/years/2026',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({ 'X-API-Key': expect.any(String) }),
                    body: JSON.stringify({ title: 'Some Movie', date: '10/1/2026' })
                })
            )
        })

        it('returns the error message on a 400', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn(async () => fakeResponse(400, { error: 'date collides with a film already in year' }))
            )

            const result = await addFilm('2026', { title: 'Dup' })

            expect(result).toEqual({
                ok: false,
                status: 400,
                error: 'date collides with a film already in year'
            })
        })

        it('returns a fallback error message when the response has no error body', async () => {
            vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(500, {})))

            const result = await addFilm('2026', { title: 'Whatever' })

            expect(result).toEqual({
                ok: false,
                status: 500,
                error: 'Scraper request failed with status 500'
            })
        })
    })

    describe('replaceYear', () => {
        it('sends a PUT with the full film list and returns the stored list', async () => {
            const films = [{ title: 'A', date: '10/1/2026' }, { title: 'B', date: '10/2/2026' }]
            const fetchMock = vi.fn(async () =>
                fakeResponse(200, [
                    { id: 202601, title: 'A', date: '10/1/2026', service: [] },
                    { id: 202602, title: 'B', date: '10/2/2026', service: [] }
                ])
            )
            vi.stubGlobal('fetch', fetchMock)

            const result = await replaceYear('2026', films)

            expect(result.ok).toBe(true)
            expect(fetchMock).toHaveBeenCalledWith(
                'https://31for31scraper.vercel.app/api/years/2026',
                expect.objectContaining({ method: 'PUT', body: JSON.stringify(films) })
            )
        })

        it('returns the error on a 401', async () => {
            vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(401, { error: 'Unauthorized' })))

            const result = await replaceYear('2026', [])

            expect(result).toEqual({ ok: false, status: 401, error: 'Unauthorized' })
        })
    })

    describe('scrapeAll', () => {
        it('GETs /api/scrape with the API key header and returns the batch response', async () => {
            const fetchMock = vi.fn(async () =>
                fakeResponse(200, { '2025': [{ id: 202501, title: 'A', date: '10/1/2025', service: [] }] })
            )
            vi.stubGlobal('fetch', fetchMock)

            const result = await scrapeAll()

            expect(result).toEqual({
                ok: true,
                data: { '2025': [{ id: 202501, title: 'A', date: '10/1/2025', service: [] }] }
            })
            expect(fetchMock).toHaveBeenCalledWith(
                'https://31for31scraper.vercel.app/api/scrape',
                expect.objectContaining({ headers: expect.objectContaining({ 'X-API-Key': expect.any(String) }) })
            )
        })

        it('returns an error on a 500 (unconfigured server)', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn(async () => fakeResponse(500, { error: 'ADMIN_API_KEY is not configured on the server' }))
            )

            const result = await scrapeAll()

            expect(result).toEqual({ ok: false, status: 500, error: 'ADMIN_API_KEY is not configured on the server' })
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
