export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      academic_term: {
        Row: {
          created_at: string
          end_date: string | null
          id: number
          is_active: boolean | null
          name: string | null
          off_days: Json | null
          remote_shifts_allowed: boolean
          start_date: string | null
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: number
          is_active?: boolean | null
          name?: string | null
          off_days?: Json | null
          remote_shifts_allowed?: boolean
          start_date?: string | null
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: number
          is_active?: boolean | null
          name?: string | null
          off_days?: Json | null
          remote_shifts_allowed?: boolean
          start_date?: string | null
        }
        Relationships: []
      }
      admins: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          id: number
          isactive: boolean | null
          last_login: string | null
          last_name: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: number
          isactive?: boolean | null
          last_login?: string | null
          last_name?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: number
          isactive?: boolean | null
          last_login?: string | null
          last_name?: string | null
        }
        Relationships: []
      }
      schedule_blocks: {
        Row: {
          created_at: string
          days: Database["public"]["Enums"]["days"] | null
          end_time: string | null
          id: number
          is_remote: boolean
          schedule_id: number | null
          start_time: string | null
        }
        Insert: {
          created_at?: string
          days?: Database["public"]["Enums"]["days"] | null
          end_time?: string | null
          id?: number
          is_remote?: boolean
          schedule_id?: number | null
          start_time?: string | null
        }
        Update: {
          created_at?: string
          days?: Database["public"]["Enums"]["days"] | null
          end_time?: string | null
          id?: number
          is_remote?: boolean
          schedule_id?: number | null
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_blocks_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          academic_term_id: number | null
          created_at: string
          end_date: string | null
          id: number
          start_date: string | null
          student_assistant_id: number | null
        }
        Insert: {
          academic_term_id?: number | null
          created_at?: string
          end_date?: string | null
          id?: number
          start_date?: string | null
          student_assistant_id?: number | null
        }
        Update: {
          academic_term_id?: number | null
          created_at?: string
          end_date?: string | null
          id?: number
          start_date?: string | null
          student_assistant_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_academic_term_id_fkey1"
            columns: ["academic_term_id"]
            isOneToOne: false
            referencedRelation: "academic_term"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_student_assistant_id_fkey1"
            columns: ["student_assistant_id"]
            isOneToOne: false
            referencedRelation: "student_assistant"
            referencedColumns: ["id"]
          },
        ]
      }
      student_assistant: {
        Row: {
          created_at: string
          first_name: string | null
          id: number
          is_active: boolean | null
          last_name: string | null
          polycard_id: number | null
          position: Database["public"]["Enums"]["student_role"]
          work_email: string | null
        }
        Insert: {
          created_at?: string
          first_name?: string | null
          id?: number
          is_active?: boolean | null
          last_name?: string | null
          polycard_id?: number | null
          position: Database["public"]["Enums"]["student_role"]
          work_email?: string | null
        }
        Update: {
          created_at?: string
          first_name?: string | null
          id?: number
          is_active?: boolean | null
          last_name?: string | null
          polycard_id?: number | null
          position?: Database["public"]["Enums"]["student_role"]
          work_email?: string | null
        }
        Relationships: []
      }
      time_entry: {
        Row: {
          clock_in: string | null
          clock_out: string | null
          created_at: string
          id: number
          schedule_block_id: number | null
          student_assistant_id: number | null
        }
        Insert: {
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          id?: number
          schedule_block_id?: number | null
          student_assistant_id?: number | null
        }
        Update: {
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          id?: number
          schedule_block_id?: number | null
          student_assistant_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entry_schedule_fkey"
            columns: ["schedule_block_id"]
            isOneToOne: false
            referencedRelation: "schedule_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_student_assistant_id_fkey"
            columns: ["student_assistant_id"]
            isOneToOne: false
            referencedRelation: "student_assistant"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      days: "monday" | "tuesday" | "wednesday" | "thursday" | "friday"
      student_role: "student_lead" | "student_assistant"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
      student_role: ["student_lead", "student_assistant"],
    },
  },
} as const
