import { requireAdmin } from '$lib/server/requireAdmin'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals }) => {
    const { user } = await requireAdmin(locals)
    return { user }
}
