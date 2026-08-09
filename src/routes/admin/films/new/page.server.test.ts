import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('$lib/server/requireAdmin', () => ({
    requireAdmin: vi.fn(async () => ({ user: { id: 'admin-1' } }))
}))

const addFilmMock = vi.fn()
vi.mock('$lib/server/scraperClient', () => ({
    addFilm: (...args: unknown[]) => addFilmMock(...args)
}))

import { actions } from './+page.server'

function formDataRequest(fields: Record<string, string>) {
    const formData = new FormData()
    for (const [key, value] of Object.entries(fields)) {
        formData.set(key, value)
    }
    return { formData: async () => formData } as unknown as Request
}

describe('admin new film action', () => {
    beforeEach(() => {
        addFilmMock.mockReset()
    })

    it('returns an error and skips the scraper when year or title is missing', async () => {
        const event = {
            request: formDataRequest({ year: '', title: '' }),
            locals: {}
        } as unknown as Parameters<typeof actions.default>[0]

        const result = await actions.default(event);

        expect(result).toEqual({ error: 'Year and title are required.' })
        expect(addFilmMock).not.toHaveBeenCalled()
    })

    it('calls addFilm with trimmed fields and returns the created film on success', async () => {
        addFilmMock.mockResolvedValue({ ok: true, data: { id: 202601, title: 'Some Movie' } })
        const event = {
            request: formDataRequest({
                year: '2026',
                title: ' Some Movie ',
                date: '10/1/2026',
                justwatch_url: ''
            }),
            locals: {}
        } as unknown as Parameters<typeof actions.default>[0]

        const result = await actions.default(event)

        expect(addFilmMock).toHaveBeenCalledWith('2026', {
            title: 'Some Movie',
            date: '10/1/2026',
            justwatch_url: undefined
        })
        expect(result).toEqual({ success: true, film: { id: 202601, title: 'Some Movie' } })
    })

    it('returns the scraper error message on failure', async () => {
        addFilmMock.mockResolvedValue({ ok: false, status: 400, error: 'date collides with a film already in year' })
        const event = {
            request: formDataRequest({ year: '2026', title: 'Whatever' }),
            locals: {}
        } as unknown as Parameters<typeof actions.default>[0]

        const result = await actions.default(event)

        expect(result).toEqual({ error: 'date collides with a film already in year' })
    })
})
