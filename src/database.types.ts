export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type WatchedFilms = Record<string, string[]>

export type ServiceType = 'free' | 'subscription' | 'rent' | 'buy' | 'cinema' | 'unknown'

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
          type: ServiceType
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
          type: ServiceType
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
          type?: ServiceType
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
