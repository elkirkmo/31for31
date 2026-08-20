// Runs before `vite dev` so `npm run dev` brings the local Supabase stack up
// with it. Without this the app starts fine and then fails at runtime in ways
// that don't point at the cause: films silently missing, dev login erroring.
//
// Deliberately not a plain `supabase start &&` in the npm script — that exits
// non-zero when the stack is already running (so every dev run after the first
// would refuse to start Vite), and when Docker is down it reports a socket
// error rather than the thing you actually need to do.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const REST_PROBE_TIMEOUT_MS = 2000

function readEnvLocal() {
    try {
        return Object.fromEntries(
            readFileSync('.env.local', 'utf8')
                .split('\n')
                .filter((line) => line.trim() && !line.trim().startsWith('#') && line.includes('='))
                .map((line) => {
                    const [key, ...rest] = line.split('=')
                    return [key.trim(), rest.join('=').trim().replace(/^["']|["']$/g, '')]
                })
        )
    } catch {
        return {}
    }
}

const url = readEnvLocal().PUBLIC_SUPABASE_URL ?? ''

// Pointed at a real project (production, or a remote branch db) — there is no
// local stack to start, and starting one would just burn time and Docker
// memory on containers nothing is talking to.
if (url && !/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(url)) {
    console.log(`• Supabase: .env.local points at ${new URL(url).host}, not the local stack — skipping start.`)
    process.exit(0)
}

// Any HTTP response at all means something is serving the API, which is all we
// need to know. /rest/v1/ answers 401 without an apikey, and that counts.
const isUp = await fetch(new URL('/rest/v1/', url || 'http://127.0.0.1:54321'), {
    signal: AbortSignal.timeout(REST_PROBE_TIMEOUT_MS)
}).then(
    () => true,
    () => false
)

if (isUp) {
    console.log('• Supabase: local stack already running.')
    process.exit(0)
}

if (spawnSync('docker', ['info'], { stdio: 'ignore' }).status !== 0) {
    console.error(
        [
            '',
            '✗ Supabase needs Docker, and the Docker daemon is not running.',
            '',
            '  Start Docker Desktop, wait for it to finish booting, then run `npm run dev` again:',
            '',
            '      open -a Docker',
            '',
            '  To run the app without a local database (e.g. .env.local pointed at a real',
            '  project), use `npm run dev:app` to skip this check entirely.',
            ''
        ].join('\n')
    )
    process.exit(1)
}

console.log('• Supabase: starting local stack (first run pulls images, takes a minute)…')
process.exit(spawnSync('npx', ['supabase', 'start'], { stdio: 'inherit' }).status ?? 1)
