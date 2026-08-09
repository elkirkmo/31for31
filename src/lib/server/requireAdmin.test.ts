import { describe, expect, it, vi, beforeEach } from 'vitest'
import { isHttpError, isRedirect } from '@sveltejs/kit'

function fakeLocals({
    user = { id: 'user-1' } as { id: string } | null,
    isAdmin = false
}: { user?: { id: string } | null; isAdmin?: boolean } = {}) {
    const single = vi.fn(async () => ({ data: { is_admin: isAdmin } }))
    const eq = vi.fn(() => ({ single }))
    const select = vi.fn(() => ({ eq }))
    const from = vi.fn(() => ({ select }))

    return {
        locals: {
            safeGetSession: vi.fn(async () => ({ user })),
            supabase: { from }
        } as unknown as App.Locals,
        from
    }
}

describe('requireAdmin', () => {
    beforeEach(() => {
        vi.resetModules()
    })

    it('redirects to /login when not logged in', async () => {
        vi.doMock('$app/environment', () => ({ dev: false }))
        const { requireAdmin } = await import('./requireAdmin')
        const { locals } = fakeLocals({ user: null })

        try {
            await requireAdmin(locals)
            expect.unreachable('should have thrown')
        } catch (e) {
            expect(isRedirect(e)).toBe(true)
            expect((e as { status: number; location: string }).status).toBe(303)
            expect((e as { status: number; location: string }).location).toBe('/login')
        }
    })

    it('throws 403 for a logged-in non-admin when not in dev', async () => {
        vi.doMock('$app/environment', () => ({ dev: false }))
        const { requireAdmin } = await import('./requireAdmin')
        const { locals } = fakeLocals({ isAdmin: false })

        try {
            await requireAdmin(locals)
            expect.unreachable('should have thrown')
        } catch (e) {
            expect(isHttpError(e)).toBe(true)
            expect((e as { status: number }).status).toBe(403)
        }
    })

    it('passes through for a logged-in admin when not in dev', async () => {
        vi.doMock('$app/environment', () => ({ dev: false }))
        const { requireAdmin } = await import('./requireAdmin')
        const { locals } = fakeLocals({ isAdmin: true })

        await expect(requireAdmin(locals)).resolves.toEqual({ user: { id: 'user-1' } })
    })

    it('bypasses the admin check for a logged-in non-admin in dev', async () => {
        vi.doMock('$app/environment', () => ({ dev: true }))
        const { requireAdmin } = await import('./requireAdmin')
        const { locals, from } = fakeLocals({ isAdmin: false })

        await expect(requireAdmin(locals)).resolves.toEqual({ user: { id: 'user-1' } })
        expect(from).not.toHaveBeenCalled()
    })

    it('still requires login in dev', async () => {
        vi.doMock('$app/environment', () => ({ dev: true }))
        const { requireAdmin } = await import('./requireAdmin')
        const { locals } = fakeLocals({ user: null })

        try {
            await requireAdmin(locals)
            expect.unreachable('should have thrown')
        } catch (e) {
            expect(isRedirect(e)).toBe(true)
        }
    })
})
