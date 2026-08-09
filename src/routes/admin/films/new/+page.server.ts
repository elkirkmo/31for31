import { requireAdmin } from '$lib/server/requireAdmin'
import { addFilm } from '$lib/server/scraperClient'
import type { Actions } from './$types'

export const actions: Actions = {
    default: async ({ request, locals }) => {
        await requireAdmin(locals)

        const form = await request.formData()
        const year = (form.get('year') as string)?.trim()
        const title = (form.get('title') as string)?.trim()
        const date = (form.get('date') as string)?.trim() || undefined
        const justwatch_url = (form.get('justwatch_url') as string)?.trim() || undefined

        if (!year || !title) {
            return { error: 'Year and title are required.' }
        }

        const result = await addFilm(year, { title, date, justwatch_url })
        if (!result.ok) {
            return { error: result.error }
        }

        return { success: true, film: result.data }
    }
}
