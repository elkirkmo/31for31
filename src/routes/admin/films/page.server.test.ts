import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('$lib/server/requireAdmin', () => ({
    requireAdmin: vi.fn(async () => ({ user: { id: 'admin-1' } }))
}))

const fromMock = vi.fn()
vi.mock('$lib/server/supabaseAdmin', () => ({
    supabaseAdmin: { from: (...args: unknown[]) => fromMock(...args) }
}))

import { load } from './+page.server'

describe('admin films list load', () => {
    beforeEach(() => {
        fromMock.mockReset()
    })

    it('groups films by year with service counts', async () => {
        fromMock.mockReturnValue({
            select: vi.fn(() => ({
                order: vi.fn(() => ({
                    order: vi.fn(async () => ({
                        data: [
                            {
                                id: 1,
                                year: 2025,
                                date: '10/1/2025',
                                title: 'Film A',
                                justwatch_url: null,
                                services: [{ id: 10 }, { id: 11 }]
                            },
                            {
                                id: 2,
                                year: 2024,
                                date: '10/2/2024',
                                title: 'Film B',
                                justwatch_url: 'https://example.com',
                                services: []
                            }
                        ]
                    }))
                }))
            }))
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
})
