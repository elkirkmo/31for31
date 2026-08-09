import { describe, expect, it, vi, beforeEach } from 'vitest'

describe('devLogin action', () => {
    beforeEach(() => {
        vi.resetModules()
    })

    it('returns an error and does not attempt sign-in when dev is false', async () => {
        vi.doMock('$app/environment', () => ({ dev: false }))
        const { actions } = await import('./+page.server')

        const signInWithPassword = vi.fn()
        const event = {
            locals: { supabase: { auth: { signInWithPassword } } }
        } as unknown as Parameters<typeof actions.devLogin>[0]

        const result = await actions.devLogin(event)

        expect(result).toEqual({ error: 'Dev login is not available.' })
        expect(signInWithPassword).not.toHaveBeenCalled()
    })
})
