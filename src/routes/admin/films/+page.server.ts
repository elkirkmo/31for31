import { error } from '@sveltejs/kit'
import { requireAdmin } from '$lib/server/requireAdmin'
import { listFilms } from '$lib/server/scraperClient'

export type FilmListEntry = {
    id: number
    year: number
    date: string
    title: string
    justwatch_url: string | null
    serviceCount: number
}

export async function load({ locals }: { locals: App.Locals }) {
    await requireAdmin(locals)

    const result = await listFilms()

    // The old Supabase read discarded its error and fell through to an empty
    // list, which on this page reads as "the catalogue is empty" -- the same
    // confusion the homepage comment warns about. Surface it instead.
    if (!result.ok) {
        console.error('admin films request failed:', result.status, result.error)
        throw error(500, `Couldn't load the films: ${result.error}`)
    }

    const filmsByYear: Record<string, FilmListEntry[]> = {}
    for (const film of result.data) {
        const year = String(film.year)
        if (!filmsByYear[year]) filmsByYear[year] = []
        filmsByYear[year].push({
            id: film.id,
            year: film.year,
            date: film.date,
            title: film.title,
            justwatch_url: film.justwatch_url,
            serviceCount: film.services.length
        })
    }

    return { filmsByYear }
}
