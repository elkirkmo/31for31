import { error, fail, redirect } from '@sveltejs/kit'
import { supabaseAdmin } from '$lib/server/supabaseAdmin'
import type { Actions, PageServerLoad } from './$types'
import type { WatchedFilms } from '../../database.types'

export type WatchedEntry = {
    title: string
    // null when the title is in the user's progress but no longer in the
    // films table (renamed or removed since they ticked it off). It's still
    // data we hold about them, so it's still listed.
    date: string | null
}

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession()
    if (!user) throw redirect(303, '/login')

    // Deliberately the RLS-bound client, not supabaseAdmin: the
    // progress_select_own policy means this can only ever read the caller's
    // own row, whatever the query says.
    const { data: progress, error: progressError } = await supabase
        .from('progress')
        .select('watched')
        .eq('user_id', user.id)
        .maybeSingle()

    // Neither query may fail softly. This page's entire claim is that it
    // lists everything held about the user, so an empty read has to mean
    // "we hold nothing", never "the read broke". Swallowing the error would
    // tell them their watched films aren't stored while they still are.
    if (progressError) throw error(500, "Couldn't load your account. Please try again.")

    const watched = ((progress as { watched: WatchedFilms } | null)?.watched ?? {}) as WatchedFilms

    const { data: filmRows, error: filmsError } = await supabase
        .from('films')
        .select('year, date, title')
        .order('year')
        .order('sort_order')

    // Likewise: with no film rows every watched title falls through to the
    // date-less branch and gets flagged "no longer on the list", which is a
    // wrong answer rather than a missing one.
    if (filmsError) throw error(500, "Couldn't load your account. Please try again.")

    // Titles alone are stored against the user, so dates come from joining
    // back to films by title — and that join also gives us the canonical
    // running order the rest of the site uses.
    const filmsByYear: Record<string, { title: string; date: string }[]> = {}
    for (const row of (filmRows ?? []) as { year: number; date: string; title: string }[]) {
        const year = String(row.year)
        if (!filmsByYear[year]) filmsByYear[year] = []
        filmsByYear[year].push({ title: row.title, date: row.date })
    }

    const watchedByYear: Record<string, WatchedEntry[]> = {}
    for (const [year, titles] of Object.entries(watched)) {
        const stored = titles ?? []
        if (stored.length === 0) continue

        const unmatched = new Set(stored)
        const entries: WatchedEntry[] = []
        for (const film of filmsByYear[year] ?? []) {
            if (unmatched.delete(film.title)) entries.push({ title: film.title, date: film.date })
        }
        for (const title of stored) {
            if (unmatched.has(title)) entries.push({ title, date: null })
        }

        watchedByYear[year] = entries
    }

    const years = Object.keys(watchedByYear).sort((a, b) => Number(b) - Number(a))
    const totalWatched = Object.values(watchedByYear).reduce((n, list) => n + list.length, 0)

    return { email: user.email ?? '', watchedByYear, years, totalWatched }
}

export const actions: Actions = {
    // Self-service account deletion. The id passed to deleteUser comes only
    // from safeGetSession (which validates the JWT via getUser) — nothing is
    // read from the request body, so there is no identifier a caller could
    // supply to delete anyone else. Do not add one.
    deleteAccount: async ({ locals: { supabase, safeGetSession } }) => {
        const { user } = await safeGetSession()
        if (!user) throw redirect(303, '/login')

        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id)
        if (deleteError) return fail(500, { error: deleteError.message })

        // The rows in progress and profiles are gone with the user via their
        // ON DELETE CASCADE to auth.users, so only the cookies are left to
        // clear. Local scope, because the remote session died with the user.
        await supabase.auth.signOut({ scope: 'local' })

        throw redirect(303, '/')
    }
}
