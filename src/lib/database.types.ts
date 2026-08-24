// Tipos manuales que reflejan supabase/migrations/0001_init.sql.
// Cuando cambies el esquema, actualiza este archivo a mano (o genera uno
// nuevo con `supabase gen types typescript` si usas la CLI de Supabase).

export type Role = 'admin' | 'user'

/**
 * Qué es un rato apuntado. Una baja y un permiso ocupan la jornada igual que
 * el trabajo, por eso viven en la misma tabla: así no se puede estar de baja
 * y en el taller a la vez.
 */
export type TipoRato = 'trabajo' | 'baja' | 'permiso'
export type TaskStatus = 'pending' | 'in_progress' | 'done'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: Role
          puesto: string | null
          // true = todavía usa la contraseña que le dio el administrador.
          must_change_password: boolean
          created_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: Role
          puesto?: string | null
          must_change_password?: boolean
        }
        Update: {
          full_name?: string | null
          role?: Role
          puesto?: string | null
          must_change_password?: boolean
        }
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          title: string
          description: string | null
          status: TaskStatus
          assigned_to: string | null
          created_by: string
          due_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          status?: TaskStatus
          assigned_to?: string | null
          created_by: string
          due_date?: string | null
        }
        Update: {
          title?: string
          description?: string | null
          status?: TaskStatus
          assigned_to?: string | null
          due_date?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          // El cliente manda: es el obligatorio. El nombre del proyecto
          // es opcional (ver 0006_cliente_obligatorio_proyecto_opcional).
          client_name: string
          project_name: string | null
          active: boolean
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          client_name: string
          project_name?: string | null
          active?: boolean
          created_by: string
        }
        Update: {
          client_name?: string
          project_name?: string | null
          active?: boolean
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          project_id: string
          name: string
          active: boolean
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          active?: boolean
          created_by: string
        }
        Update: {
          project_id?: string
          name?: string
          active?: boolean
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          id: string
          task_id: string | null
          product_id: string | null
          user_id: string
          tipo: TipoRato
          started_at: string
          ended_at: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          task_id?: string | null
          product_id?: string | null
          user_id: string
          tipo?: TipoRato
          started_at?: string
          ended_at?: string | null
          notes?: string | null
        }
        Update: {
          task_id?: string | null
          product_id?: string | null
          started_at?: string
          ended_at?: string | null
          notes?: string | null
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          id: string
          title: string
          description: string | null
          start_at: string
          end_at: string | null
          assigned_to: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          start_at: string
          end_at?: string | null
          assigned_to?: string | null
          created_by: string
        }
        Update: {
          title?: string
          description?: string | null
          start_at?: string
          end_at?: string | null
          assigned_to?: string | null
        }
        Relationships: []
      }
      notices: {
        Row: {
          id: string
          title: string
          body: string | null
          assigned_to: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          body?: string | null
          assigned_to?: string | null
          created_by: string
        }
        Update: {
          title?: string
          body?: string | null
          assigned_to?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
