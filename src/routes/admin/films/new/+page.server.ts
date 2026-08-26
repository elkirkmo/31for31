import { requireAdmin } from '$lib/server/requireAdmin'
import { supabaseAdmin } from '$lib/server/supabaseAdmin'
import type { Actions } from './$types'

export const actions: Actions = {
    default: async ({ request, locals }) => {
        await requireAdmin(locals)

        const form = await request.formData()
        const year = (form.get('year') as string)?.trim()
        const title = (form.get('title') as string)?.trim()
        const date = (form.get('date') as string)?.trim()
        const justwatch_url = (form.get('justwatch_url') as string)?.trim() || null

        if (!year || !title) return { error: 'Year and title are required.' }
        if (!/^\d{4}$/.test(year)) return { error: 'Year must be a 4-digit number.' }
        // films.date is NOT NULL, and it's what the film displays as on the
        // list. Asking for it here beats surfacing a Postgres constraint.
        if (!date) return { error: 'Date is required.' }

        // Append to the end of the year. Existing rows took their sort_order
        // from their position in data.json, so defaulting to 0 would file a
        // new film alongside whatever opened that year.
        const { data: last } = await supabaseAdmin
            .from('films')
            .select('sort_order')
            .eq('year', Number(year))
            .order('sort_order', { ascending: false })
            .limit(1)
            .maybeSingle()

        const { data: film, error: insertError } = await supabaseAdmin
            .from('films')
            .insert({
                year: Number(year),
                title,
                date,
                justwatch_url,
                sort_order: ((last as { sort_order: number } | null)?.sort_order ?? -1) + 1
            })
            .select('id, year, title, date, justwatch_url')
            .single()

        if (insertError) {
            // unique (year, title)
            if (insertError.code === '23505') return { error: `${title} is already on the ${year} list.` }
            return { error: insertError.message }
        }

        // Offers aren't fetched here — the film lands with none until a
        // rescrape, same as before. Its justwatch_url now travels with that
        // scrape, so an override set at creation is honoured immediately.
        return { success: true, film }
    }
}
