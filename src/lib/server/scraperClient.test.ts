import { afterEach, describe, expect, it, vi } from 'vitest'
import { scrapeMany, scrapeOne } from './scraperClient'

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
