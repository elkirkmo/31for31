// Regenerate this file after any migration change: `npm run db:types`
// (requires the local stack running: `npm run db:start`). Hand-written for
// now as a placeholder matching supabase gen types typescript's shape --
// this exact content hasn't been verified against a real generation run
// (no Docker available in the environment that wrote it). Don't hand-edit
// after the first real `db:types` run; add hand-written helpers to
// database.types.ts instead, which re-exports from here.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

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
      profiles: {
        Row: {
          id: string
          is_admin: boolean
          created_at: string
        }
        Insert: {
          id: string
          is_admin?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          is_admin?: boolean
          created_at?: string
        }
        Relationships: []
      }
      films: {
        Row: {
          id: number
          year: number
          sort_order: number
          date: string
          title: string
          justwatch_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          year: number
          sort_order?: number
          date: string
          title: string
          justwatch_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          year?: number
          sort_order?: number
          date?: string
          title?: string
          justwatch_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          id: number
          film_id: number
          name: string
          type: 'free' | 'subscription' | 'rent' | 'buy' | 'cinema' | 'unknown'
          price: number | null
          currency: string | null
          link: string | null
          icon: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          film_id: number
          name: string
          type: 'free' | 'subscription' | 'rent' | 'buy' | 'cinema' | 'unknown'
          price?: number | null
          currency?: string | null
          link?: string | null
          icon?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          film_id?: number
          name?: string
          type?: 'free' | 'subscription' | 'rent' | 'buy' | 'cinema' | 'unknown'
          price?: number | null
          currency?: string | null
          link?: string | null
          icon?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
