
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public'
import { createServerClient } from '@supabase/ssr'
import type { Handle } from '@sveltejs/kit'
import ws from 'ws'
import type { Database } from './database.types'

export const handle: Handle = async ({ event, resolve }) => {
    event.locals.supabase = createServerClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
        realtime: { transport: ws as unknown as typeof WebSocket },
        cookies: {
            getAll() {
                return event.cookies.getAll()
            },
            setAll(cookiesToSet, headers) {
                /**
                 * Note: You have to add the `path` variable to the
                 * set and remove method due to sveltekit's cookie API
                 * requiring this to be set, setting the path to an empty string
                 * will replicate previous/standard behavior (https://kit.svelte.dev/docs/types#public-types-cookies)
                 */
                cookiesToSet.forEach(({ name, value, options }) =>
                    event.cookies.set(name, value, { ...options, path: '/' })
                )
                if (Object.keys(headers).length > 0) {
                    event.setHeaders(headers)
                }
            },
        },
    })

    /**
     * Unlike `supabase.auth.getSession()`, which returns the session _without_
     * validating the JWT, this function also calls `getUser()` to validate the
     * JWT before returning the session.
     */
    event.locals.safeGetSession = async () => {
        const {
            data: { session },
        } = await event.locals.supabase.auth.getSession()
        if (!session) {
            return { session: null, user: null }
        }

        const {
            data: { user },
            error,
        } = await event.locals.supabase.auth.getUser()
        if (error || !user) {
            // JWT validation has failed, or the token is valid but resolves to
            // no user. Either way there is nobody authenticated here.
            return { session: null, user: null }
        }

        // The session from getSession() carries a `user` read straight out of
        // the cookie, which supabase-js wraps in a proxy that warns the moment
        // any of its properties are read — and SvelteKit reads all of them when
        // it serializes layout data for the client. Swap in the `user` that
        // getUser() just authenticated, so anything reading `session.user`
        // downstream gets the verified one rather than the cookie's claim.
        return { session: { ...session, user }, user }
    }

    return resolve(event, {
        filterSerializedResponseHeaders(name) {
            return name === 'content-range' || name === 'x-supabase-api-version'
        },
    })
}