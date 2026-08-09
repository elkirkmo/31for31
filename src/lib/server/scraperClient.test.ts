import { afterEach, describe, expect, it, vi } from 'vitest'
import { addFilm, replaceYear } from './scraperClient'

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
})
