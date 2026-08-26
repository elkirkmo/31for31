import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('$lib/server/requireAdmin', () => ({
    requireAdmin: vi.fn(async () => ({ user: { id: 'admin-1' } }))
}))

const insertMock = vi.fn()
const fromMock = vi.fn()
vi.mock('$lib/server/supabaseAdmin', () => ({
    supabaseAdmin: { from: (...args: unknown[]) => fromMock(...args) }
}))

// films is written directly now, so the fake covers the two shapes the
// action uses: the sort_order lookup, and the insert.
function filmsTable({
    lastSortOrder = null as number | null,
    insertResult = { data: { id: 1 }, error: null } as Record<string, unknown>
} = {}) {
    insertMock.mockImplementation(() => ({
        select: vi.fn(() => ({ single: vi.fn(async () => insertResult) }))
    }))
    return {
        select: vi.fn(() => ({
            eq: vi.fn(() => ({
                order: vi.fn(() => ({
                    limit: vi.fn(() => ({
                        maybeSingle: vi.fn(async () => ({
                            data: lastSortOrder === null ? null : { sort_order: lastSortOrder }
                        }))
                    }))
                }))
            }))
        })),
        insert: (...args: unknown[]) => insertMock(...args)
    }
}

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
        fromMock.mockReset()
        insertMock.mockReset()
    })

    it('returns an error and skips the scraper when year or title is missing', async () => {
        const event = {
            request: formDataRequest({ year: '', title: '' }),
            locals: {}
        } as unknown as Parameters<typeof actions.default>[0]

        const result = await actions.default(event);

        expect(result).toEqual({ error: 'Year and title are required.' })
        expect(fromMock).not.toHaveBeenCalled()
    })

    it('returns an error and skips the scraper when year is not a 4-digit number', async () => {
        const event = {
            request: formDataRequest({ year: '25', title: 'Whatever' }),
            locals: {}
        } as unknown as Parameters<typeof actions.default>[0]

        const result = await actions.default(event)

        expect(result).toEqual({ error: 'Year must be a 4-digit number.' })
        expect(fromMock).not.toHaveBeenCalled()
    })

    it('rejects a year with a non-numeric or path-like value', async () => {
        const event = {
            request: formDataRequest({ year: '2026/../etc', title: 'Whatever' }),
            locals: {}
        } as unknown as Parameters<typeof actions.default>[0]

        const result = await actions.default(event)

        expect(result).toEqual({ error: 'Year must be a 4-digit number.' })
        expect(fromMock).not.toHaveBeenCalled()
    })

    it('requires a date, which the films table will not accept as null', async () => {
        const event = {
            request: formDataRequest({ year: '2026', title: 'Some Movie', date: '' }),
            locals: {}
        } as unknown as Parameters<typeof actions.default>[0]

        const result = await actions.default(event)

        expect(result).toEqual({ error: 'Date is required.' })
        expect(fromMock).not.toHaveBeenCalled()
    })

    it('inserts the film with trimmed fields and returns the created row', async () => {
        fromMock.mockReturnValue(
            filmsTable({
                lastSortOrder: 4,
                insertResult: { data: { id: 77, year: 2026, title: 'Some Movie' }, error: null }
            })
        )
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

        expect(insertMock).toHaveBeenCalledWith({
            year: 2026,
            title: 'Some Movie',
            date: '10/1/2026',
            justwatch_url: null,
            sort_order: 5
        })
        expect(result).toEqual({ success: true, film: { id: 77, year: 2026, title: 'Some Movie' } })
    })

    // Existing rows took their sort_order from their data.json position, so
    // a new film has to land after them rather than defaulting to 0.
    it('appends to the end of the year, and starts at 0 for a brand new year', async () => {
        fromMock.mockReturnValue(filmsTable({ lastSortOrder: null }))
        const event = {
            request: formDataRequest({ year: '2027', title: 'First One', date: '10/1/2027' }),
            locals: {}
        } as unknown as Parameters<typeof actions.default>[0]

        await actions.default(event)

        expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ sort_order: 0 }))
    })

    it('keeps a justwatch_url override so the first scrape honours it', async () => {
        fromMock.mockReturnValue(filmsTable({ lastSortOrder: 0 }))
        const event = {
            request: formDataRequest({
                year: '2024',
                title: 'The Ring',
                date: '10/20/2024',
                justwatch_url: ' https://www.justwatch.com/us/movie/le-cercle '
            }),
            locals: {}
        } as unknown as Parameters<typeof actions.default>[0]

        await actions.default(event)

        expect(insertMock).toHaveBeenCalledWith(
            expect.objectContaining({ justwatch_url: 'https://www.justwatch.com/us/movie/le-cercle' })
        )
    })

    it('explains a duplicate title rather than leaking the constraint error', async () => {
        fromMock.mockReturnValue(
            filmsTable({
                lastSortOrder: 0,
                insertResult: { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } }
            })
        )
        const event = {
            request: formDataRequest({ year: '2026', title: 'Hereditary', date: '10/2/2026' }),
            locals: {}
        } as unknown as Parameters<typeof actions.default>[0]

        const result = await actions.default(event)

        expect(result).toEqual({ error: 'Hereditary is already on the 2026 list.' })
    })

    it('surfaces any other insert error', async () => {
        fromMock.mockReturnValue(
            filmsTable({
                lastSortOrder: 0,
                insertResult: { data: null, error: { code: '42501', message: 'permission denied for table films' } }
            })
        )
        const event = {
            request: formDataRequest({ year: '2026', title: 'Whatever', date: '10/3/2026' }),
            locals: {}
        } as unknown as Parameters<typeof actions.default>[0]

        const result = await actions.default(event)

        expect(result).toEqual({ error: 'permission denied for table films' })
    })
})
