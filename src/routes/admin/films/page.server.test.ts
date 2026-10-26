import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('$lib/server/requireAdmin', () => ({
    requireAdmin: vi.fn(async () => ({ user: { id: 'admin-1' } }))
}))

const listFilms = vi.fn()
vi.mock('$lib/server/scraperClient', () => ({
    listFilms: (...args: unknown[]) => listFilms(...args)
}))

import { load } from './+page.server'

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

describe('admin films list load', () => {
    beforeEach(() => {
        listFilms.mockReset()
    })

    it('groups films by year with service counts', async () => {
        listFilms.mockResolvedValue({
            ok: true,
            data: [
                film({ id: 1, year: 2025, services: [{ id: 10 }, { id: 11 }] }),
                film({
                    id: 2,
                    year: 2024,
                    date: '10/2/2024',
                    title: 'Film B',
                    justwatch_url: 'https://example.com',
                    services: []
                })
            ]
        })

        const result = await load({ locals: {} } as unknown as Parameters<typeof load>[0])

        expect(result.filmsByYear).toEqual({
            '2025': [
                { id: 1, year: 2025, date: '10/1/2025', title: 'Film A', justwatch_url: null, serviceCount: 2 }
            ],
            '2024': [
                {
                    id: 2,
                    year: 2024,
                    date: '10/2/2024',
                    title: 'Film B',
                    justwatch_url: 'https://example.com',
                    serviceCount: 0
                }
            ]
        })
    })

    // The Supabase version discarded its error and rendered an empty list,
    // which on this page reads as "the catalogue is empty".
    it('throws rather than rendering an empty catalogue when the read fails', async () => {
        listFilms.mockResolvedValue({ ok: false, status: 502, error: 'Supabase unreachable' })

        await expect(load({ locals: {} } as unknown as Parameters<typeof load>[0])).rejects.toMatchObject({
            status: 500
        })
    })
})
