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
      invoices: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          issued_on: string
          kind: string
          number: string
          status: string
          user_id: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          id?: string
          issued_on?: string
          kind?: string
          number: string
          status?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          issued_on?: string
          kind?: string
          number?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      offers: {
        Row: {
          category: string
          created_at: string
          featured: boolean
          id: string
          image_key: string
          partner: string
          place: string
          promo: string
          sort_order: number
          title: string
          validity: string
        }
        Insert: {
          category: string
          created_at?: string
          featured?: boolean
          id?: string
          image_key?: string
          partner: string
          place: string
          promo: string
          sort_order?: number
          title: string
          validity: string
        }
        Update: {
          category?: string
          created_at?: string
          featured?: boolean
          id?: string
          image_key?: string
          partner?: string
          place?: string
          promo?: string
          sort_order?: number
          title?: string
          validity?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          concierge_referent: string | null
          concierge_whatsapp: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          member_number: string
          member_since: string
          notify_messages: boolean
          notify_offers: boolean
          notify_requests: boolean
          phone: string | null
          plan: string
          role_label: string
          valid_until: string
        }
        Insert: {
          concierge_referent?: string | null
          concierge_whatsapp?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          member_number?: string
          member_since?: string
          notify_messages?: boolean
          notify_offers?: boolean
          notify_requests?: boolean
          phone?: string | null
          plan?: string
          role_label?: string
          valid_until?: string
        }
        Update: {
          concierge_referent?: string | null
          concierge_whatsapp?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          member_number?: string
          member_since?: string
          notify_messages?: boolean
          notify_offers?: boolean
          notify_requests?: boolean
          phone?: string | null
          plan?: string
          role_label?: string
          valid_until?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          inviter_id: string
          message: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          inviter_id: string
          message?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          inviter_id?: string
          message?: string | null
          status?: string
        }
        Relationships: []
      }
      requests: {
        Row: {
          category: string
          concierge: string
          created_at: string
          description: string
          guests: number | null
          id: string
          image_key: string
          scheduled_date: string | null
          scheduled_time: string | null
          status: Database["public"]["Enums"]["request_status"]
          title: string
          user_id: string
        }
        Insert: {
          category?: string
          concierge?: string
          created_at?: string
          description?: string
          guests?: number | null
          id?: string
          image_key?: string
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          title: string
          user_id: string
        }
        Update: {
          category?: string
          concierge?: string
          created_at?: string
          description?: string
          guests?: number | null
          id?: string
          image_key?: string
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          title?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      request_status:
        | "Nouvelle"
        | "En cours"
        | "Confirmée"
        | "Terminée"
        | "Annulée"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      request_status: [
        "Nouvelle",
        "En cours",
        "Confirmée",
        "Terminée",
        "Annulée",
      ],
    },
  },
} as const
