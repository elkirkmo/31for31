// Hand-written helpers only -- the Database shape itself lives in
// database.generated.types.ts (CLI-generated, see `npm run db:types`).
// Add convenience types here, not in the generated file.

export type { Json, Database } from './database.generated.types'
import type { Database } from './database.generated.types'

export type WatchedFilms = Record<string, string[]>

export type ServiceType = Database['public']['Tables']['services']['Row']['type']
