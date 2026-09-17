import { describe, expect, it, vi, beforeEach } from 'vitest'
import { isHttpError } from '@sveltejs/kit'

vi.mock('$lib/server/requireAdmin', () => ({
    requireAdmin: vi.fn(async () => ({ user: { id: 'admin-1' } }))
}))

const getFilm = vi.fn()
const updateFilm = vi.fn()
const deleteFilm = vi.fn()
const refreshFilm = vi.fn()
const scrapeOne = vi.fn()
vi.mock('$lib/server/scraperClient', () => ({
    getFilm: (...a: unknown[]) => getFilm(...a),
    updateFilm: (...a: unknown[]) => updateFilm(...a),
    deleteFilm: (...a: unknown[]) => deleteFilm(...a),
    refreshFilm: (...a: unknown[]) => refreshFilm(...a),
    scrapeOne: (...a: unknown[]) => scrapeOne(...a)
}))

import { load, actions } from './+page.server'

const offer = (over: Record<string, unknown> = {}) => ({
    name: 'Netflix',
    type: 'subscription',
    price: null,
    currency: 'USD',
    link: 'https://netflix.com/1',
    icon: 'https://img/1.webp',
    ...over
})

const film = (over: Record<string, unknown> = {}) => ({
    id: 20,
    year: 2024,
    sort_order: 19,
    date: '10/20/2024',
    title: 'The Ring',
    justwatch_url: null,
    services: [],
    ...over
})

const evt = (over: Record<string, unknown> = {}) =>
    ({ params: { id: '20' }, locals: {}, ...over }) as never

function formEvent(fields: Record<string, string>) {
    const formData = new FormData()
    for (const [k, v] of Object.entries(fields)) formData.set(k, v)
    return evt({ request: { formData: async () => formData } })
}

beforeEach(() => {
    for (const m of [getFilm, updateFilm, deleteFilm, refreshFilm, scrapeOne]) m.mockReset()
})

describe('admin film [id] load', () => {
    it('throws a 404 when the film does not exist', async () => {
        getFilm.mockResolvedValue({ ok: false, status: 404, error: 'not found' })

        try {
            await load(evt({ params: { id: '999' } }))
            expect.unreachable('should have thrown')
        } catch (e) {
            expect(isHttpError(e)).toBe(true)
            expect((e as { status: number }).status).toBe(404)
        }
    })

    it('returns the film with its services', async () => {
        const row = film({ services: [{ id: 1, film_id: 20, ...offer() }] })
        getFilm.mockResolvedValue({ ok: true, data: row })

        const result = await load(evt())

        expect(getFilm).toHaveBeenCalledWith(20)
        expect(result.film).toEqual(row)
    })

    // A read that fails for any other reason must not render as a film with
    // no offers -- that would look like a film streaming nowhere.
    it('throws a 500 when the read fails for any other reason', async () => {
        getFilm.mockResolvedValue({ ok: false, status: 502, error: 'Supabase unreachable' })

        await expect(load(evt())).rejects.toMatchObject({ status: 500 })
    })
})

describe('admin film [id] update / delete', () => {
    it('update patches the film through the API', async () => {
        updateFilm.mockResolvedValue({ ok: true, data: film() })

        const result = await actions.update(formEvent({ title: ' The Ring ', date: ' 10/20/2024 ' }))

        expect(updateFilm).toHaveBeenCalledWith(20, {
            title: 'The Ring',
            date: '10/20/2024',
            justwatch_url: null
        })
        expect(result).toEqual({ success: true })
    })

    it('update stores a justwatch_url override', async () => {
        updateFilm.mockResolvedValue({ ok: true, data: film() })

        await actions.update(
            formEvent({
                title: 'The Ring',
                date: '10/20/2024',
                justwatch_url: ' https://www.justwatch.com/us/movie/le-cercle '
            })
        )

        expect(updateFilm).toHaveBeenCalledWith(
            20,
            expect.objectContaining({ justwatch_url: 'https://www.justwatch.com/us/movie/le-cercle' })
        )
    })

    // Sending null rather than omitting the field is what clears the
    // override; omitting it would leave the old one in place.
    it('update clears the override by sending null when the field is blank', async () => {
        updateFilm.mockResolvedValue({ ok: true, data: film() })

        await actions.update(formEvent({ title: 'The Ring', date: '10/20/2024', justwatch_url: '   ' }))

        expect(updateFilm).toHaveBeenCalledWith(20, expect.objectContaining({ justwatch_url: null }))
    })

    it('update returns an error when title is blank', async () => {
        const result = await actions.update(formEvent({ title: '  ', date: '10/20/2024' }))

        expect(result).toEqual({ error: 'Title is required.' })
        expect(updateFilm).not.toHaveBeenCalled()
    })

    it('update returns an error when date is blank', async () => {
        const result = await actions.update(formEvent({ title: 'The Ring', date: '' }))

        expect(result).toEqual({ error: 'Date is required.' })
        expect(updateFilm).not.toHaveBeenCalled()
    })

    it('update explains a duplicate title rather than leaking the API error', async () => {
        updateFilm.mockResolvedValue({ ok: false, status: 409, error: 'already exists' })

        const result = await actions.update(formEvent({ title: 'Hereditary', date: '10/2/2026' }))

        expect(result).toEqual({ error: 'Another film that year is already called Hereditary.' })
    })

    it('update reports a missing film', async () => {
        updateFilm.mockResolvedValue({ ok: false, status: 404, error: 'not found' })

        const result = await actions.update(formEvent({ title: 'The Ring', date: '10/20/2024' }))

        expect(result).toEqual({ error: 'Film not found.' })
    })

    it('delete removes the film, letting its offers cascade', async () => {
        deleteFilm.mockResolvedValue({ ok: true, data: null })

        const result = await actions.delete(evt())

        expect(deleteFilm).toHaveBeenCalledWith(20)
        expect(result).toEqual({ success: true, deleted: true })
    })

    it('delete reports a missing film', async () => {
        deleteFilm.mockResolvedValue({ ok: false, status: 404, error: 'not found' })

        expect(await actions.delete(evt())).toEqual({ error: 'Film not found.' })
    })
})

describe('admin film [id] rescrape actions', () => {
    it('rescrape diffs a fresh scrape against stored offers without writing', async () => {
        getFilm.mockResolvedValue({
            ok: true,
            data: film({
                justwatch_url: 'https://www.justwatch.com/us/movie/le-cercle',
                services: [
                    { id: 1, film_id: 20, ...offer({ name: 'Netflix' }) },
                    { id: 2, film_id: 20, ...offer({ name: 'Hulu' }) }
                ]
            })
        })
        scrapeOne.mockResolvedValue({
            ok: true,
            data: {
                title: 'The Ring',
                service: [offer({ name: 'Netflix' }), offer({ name: 'Shudder' })]
            }
        })

        const result = await actions.rescrape(evt())

        expect(scrapeOne).toHaveBeenCalledWith('The Ring', 'https://www.justwatch.com/us/movie/le-cercle')
        expect(result).toEqual({
            rescrapePreview: { added: 1, removed: 1, changed: 0, unchanged: 1 }
        })
        expect(refreshFilm).not.toHaveBeenCalled()
    })

    it('rescrape returns the inline scrape error', async () => {
        getFilm.mockResolvedValue({ ok: true, data: film() })
        scrapeOne.mockResolvedValue({ ok: true, data: { title: 'The Ring', service: [], error: 'no page found' } })

        expect(await actions.rescrape(evt())).toEqual({ error: 'no page found' })
    })

    it('applyRescrape refreshes server-side and never sees the offers', async () => {
        refreshFilm.mockResolvedValue({
            ok: true,
            data: { film_id: 20, title: 'The Ring', refreshed: true, services_updated: 16 }
        })

        const result = await actions.applyRescrape(evt())

        expect(refreshFilm).toHaveBeenCalledWith(20)
        expect(result).toEqual({ rescraped: true })
    })

    // A failed scrape leaves the stored offers alone. Saying so matters --
    // otherwise the admin reads it as the film having been wiped.
    it('applyRescrape says the offers were left alone when the scrape fails', async () => {
        refreshFilm.mockResolvedValue({ ok: false, status: 502, error: 'JustWatch unreachable.' })

        const result = await actions.applyRescrape(evt())

        expect(result).toEqual({ error: 'JustWatch unreachable. The existing offers were left unchanged.' })
    })

    it('applyRescrape treats refreshed:false inside a 200 as a failure too', async () => {
        refreshFilm.mockResolvedValue({
            ok: true,
            data: { film_id: 20, title: 'The Ring', refreshed: false, error: 'no page found.' }
        })

        const result = await actions.applyRescrape(evt())

        expect(result).toEqual({ error: 'no page found. The existing offers were left unchanged.' })
    })
})
