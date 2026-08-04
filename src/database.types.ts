export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type WatchedFilms = Record<string, string[]>

export type Database = {
  public: {
    Tables: {
      progress: {
        Row: {
          user_id: string
          watched: Json
        }
        Insert: {
          user_id: string
          watched?: Json
        }
        Update: {
          user_id?: string
          watched?: Json
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
