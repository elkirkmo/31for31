import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('$lib/server/requireAdmin', () => ({
    requireAdmin: vi.fn(async () => ({ user: { id: 'admin-1' } }))
}))

const createFilm = vi.fn()
vi.mock('$lib/server/scraperClient', () => ({
    createFilm: (...args: unknown[]) => createFilm(...args)
}))

import { actions } from './+page.server'

function formDataRequest(fields: Record<string, string>) {
    const formData = new FormData()
    for (const [key, value] of Object.entries(fields)) {
        formData.set(key, value)
    }
    return { formData: async () => formData } as unknown as Request
}

const created = (over: Record<string, unknown> = {}) => ({
    ok: true as const,
    data: {
        id: 77,
        year: 2026,
        sort_order: 5,
        date: '10/1/2026',
        title: 'Some Movie',
        justwatch_url: null,
        services: [],
        ...over
    }
})

const event = (fields: Record<string, string>) =>
    ({ request: formDataRequest(fields), locals: {} }) as unknown as Parameters<typeof actions.default>[0]

describe('admin new film action', () => {
    beforeEach(() => {
        createFilm.mockReset()
        createFilm.mockResolvedValue(created())
    })

    it('returns an error and skips the scraper when year or title is missing', async () => {
        const result = await actions.default(event({ year: '', title: '' }))

        expect(result).toEqual({ error: 'Year and title are required.' })
        expect(createFilm).not.toHaveBeenCalled()
    })

    it('returns an error and skips the scraper when year is not a 4-digit number', async () => {
        const result = await actions.default(event({ year: '25', title: 'Whatever' }))

        expect(result).toEqual({ error: 'Year must be a 4-digit number.' })
        expect(createFilm).not.toHaveBeenCalled()
    })

    it('rejects a year with a non-numeric or path-like value', async () => {
        const result = await actions.default(event({ year: '2026/../etc', title: 'Whatever' }))

        expect(result).toEqual({ error: 'Year must be a 4-digit number.' })
        expect(createFilm).not.toHaveBeenCalled()
    })

    it('requires a date, which the catalogue will not accept as null', async () => {
        const result = await actions.default(event({ year: '2026', title: 'Some Movie', date: '' }))

        expect(result).toEqual({ error: 'Date is required.' })
        expect(createFilm).not.toHaveBeenCalled()
    })

    it('posts the film with trimmed fields and returns the created row', async () => {
        const result = await actions.default(
            event({ year: '2026', title: ' Some Movie ', date: '10/1/2026', justwatch_url: '' })
        )

        expect(createFilm).toHaveBeenCalledWith({
            year: 2026,
            title: 'Some Movie',
            date: '10/1/2026',
            justwatch_url: null
        })
        expect(result).toEqual({
            success: true,
            film: { id: 77, year: 2026, title: 'Some Movie', date: '10/1/2026', justwatch_url: null }
        })
    })

    // Deciding where a new film lands in the year is a decision about film
    // data, so it moved to the scraper: omitting sort_order is what asks it
    // to append. Sending one would override that.
    it('omits sort_order entirely so the scraper appends to the year', async () => {
        await actions.default(event({ year: '2027', title: 'First One', date: '10/1/2027' }))

        expect(createFilm).toHaveBeenCalledWith(expect.not.objectContaining({ sort_order: expect.anything() }))
    })

    it('keeps a justwatch_url override so the first scrape honours it', async () => {
        await actions.default(
            event({
                year: '2024',
                title: 'The Ring',
                date: '10/20/2024',
                justwatch_url: ' https://www.justwatch.com/us/movie/le-cercle '
            })
        )

        expect(createFilm).toHaveBeenCalledWith(
            expect.objectContaining({ justwatch_url: 'https://www.justwatch.com/us/movie/le-cercle' })
        )
    })

    // Was Postgres 23505 read off the insert error; the same collision is an
    // HTTP status now, and the message the admin sees is unchanged.
    it('explains a duplicate title rather than leaking the API error', async () => {
        createFilm.mockResolvedValue({ ok: false, status: 409, error: 'film already exists for that year' })

        const result = await actions.default(event({ year: '2026', title: 'Hereditary', date: '10/2/2026' }))

        expect(result).toEqual({ error: 'Hereditary is already on the 2026 list.' })
    })

    it('surfaces any other create error', async () => {
        createFilm.mockResolvedValue({ ok: false, status: 502, error: 'Supabase request failed' })

        const result = await actions.default(event({ year: '2026', title: 'Whatever', date: '10/3/2026' }))

        expect(result).toEqual({ error: 'Supabase request failed' })
    })
})
