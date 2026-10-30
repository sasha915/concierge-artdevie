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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      admin_gate_attempts: {
        Row: {
          created_at: string
          id: number
          succeeded: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          succeeded: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          succeeded?: boolean
          user_id?: string
        }
        Relationships: []
      }
      invoice_counter: {
        Row: {
          id: number
          last: number
        }
        Insert: {
          id?: number
          last?: number
        }
        Update: {
          id?: number
          last?: number
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount_cents: number
          commission_cents: number | null
          commission_rate: number | null
          created_at: string
          id: string
          issued_on: string
          kind: string
          mollie_payment_id: string | null
          number: string
          request_id: string | null
          service_cents: number | null
          status: string
          user_id: string
        }
        Insert: {
          amount_cents?: number
          commission_cents?: number | null
          commission_rate?: number | null
          created_at?: string
          id?: string
          issued_on?: string
          kind?: string
          mollie_payment_id?: string | null
          number: string
          request_id?: string | null
          service_cents?: number | null
          status?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          commission_cents?: number | null
          commission_rate?: number | null
          created_at?: string
          id?: string
          issued_on?: string
          kind?: string
          mollie_payment_id?: string | null
          number?: string
          request_id?: string | null
          service_cents?: number | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      member_delegates: {
        Row: {
          decided_at: string | null
          decided_by: string | null
          delegate_id: string | null
          email: string
          full_name: string
          id: string
          invited_at: string
          member_id: string
          relation: string | null
          revoked_at: string | null
          revoked_by: string | null
          status: string
        }
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          delegate_id?: string | null
          email: string
          full_name: string
          id?: string
          invited_at?: string
          member_id: string
          relation?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          delegate_id?: string | null
          email?: string
          full_name?: string
          id?: string
          invited_at?: string
          member_id?: string
          relation?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_delegates_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          read_at: string | null
          request_id: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind: string
          read_at?: string | null
          request_id?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          request_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_notifications_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_preferences: {
        Row: {
          calendrier: string
          dates_cles: string
          dates_membre: string
          member_updated_at: string | null
          sejours: string
          sejours_choix: string[]
          tables: string
          tables_choix: string[]
          transferts: string
          transferts_choix: string[]
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          calendrier?: string
          dates_cles?: string
          dates_membre?: string
          member_updated_at?: string | null
          sejours?: string
          sejours_choix?: string[]
          tables?: string
          tables_choix?: string[]
          transferts?: string
          transferts_choix?: string[]
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          calendrier?: string
          dates_cles?: string
          dates_membre?: string
          member_updated_at?: string | null
          sejours?: string
          sejours_choix?: string[]
          tables?: string
          tables_choix?: string[]
          transferts?: string
          transferts_choix?: string[]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_plans: {
        Row: {
          min_commitment_months: number | null
          name: string
          period: string
          price_cents: number
          updated_at: string
        }
        Insert: {
          min_commitment_months?: number | null
          name: string
          period: string
          price_cents: number
          updated_at?: string
        }
        Update: {
          min_commitment_months?: number | null
          name?: string
          period?: string
          price_cents?: number
          updated_at?: string
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
          image_url: string | null
          partner: string
          place: string
          promo: string
          published: boolean
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
          image_url?: string | null
          partner: string
          place: string
          promo: string
          published?: boolean
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
          image_url?: string | null
          partner?: string
          place?: string
          promo?: string
          published?: boolean
          sort_order?: number
          title?: string
          validity?: string
        }
        Relationships: []
      }
      payment_failures: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          mollie_payment_id: string
          resolved_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          mollie_payment_id: string
          resolved_at?: string | null
          status: string
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          mollie_payment_id?: string
          resolved_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_failures_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          concierge_referent: string | null
          concierge_whatsapp: string | null
          created_at: string
          disabled_at: string | null
          email: string | null
          full_name: string
          id: string
          language: string
          member_number: string
          member_since: string
          mollie_customer_id: string | null
          mollie_subscription_id: string | null
          notify_messages: boolean
          notify_offers: boolean
          notify_requests: boolean
          onboarded_at: string | null
          phone: string | null
          plan: string
          role_label: string
          valid_until: string
        }
        Insert: {
          concierge_referent?: string | null
          concierge_whatsapp?: string | null
          created_at?: string
          disabled_at?: string | null
          email?: string | null
          full_name?: string
          id: string
          language?: string
          member_number?: string
          member_since?: string
          mollie_customer_id?: string | null
          mollie_subscription_id?: string | null
          notify_messages?: boolean
          notify_offers?: boolean
          notify_requests?: boolean
          onboarded_at?: string | null
          phone?: string | null
          plan?: string
          role_label?: string
          valid_until?: string
        }
        Update: {
          concierge_referent?: string | null
          concierge_whatsapp?: string | null
          created_at?: string
          disabled_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          language?: string
          member_number?: string
          member_since?: string
          mollie_customer_id?: string | null
          mollie_subscription_id?: string | null
          notify_messages?: boolean
          notify_offers?: boolean
          notify_requests?: boolean
          onboarded_at?: string | null
          phone?: string | null
          plan?: string
          role_label?: string
          valid_until?: string
        }
        Relationships: []
      }
      recurring_requests: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          dates: string[]
          description: string
          end_date: string | null
          guests: number | null
          id: string
          image_key: string
          last_occurrence: string | null
          paused: boolean
          rhythm: string
          scheduled_time: string | null
          start_date: string | null
          title: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          dates?: string[]
          description?: string
          end_date?: string | null
          guests?: number | null
          id?: string
          image_key?: string
          last_occurrence?: string | null
          paused?: boolean
          rhythm: string
          scheduled_time?: string | null
          start_date?: string | null
          title: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          dates?: string[]
          description?: string
          end_date?: string | null
          guests?: number | null
          id?: string
          image_key?: string
          last_occurrence?: string | null
          paused?: boolean
          rhythm?: string
          scheduled_time?: string | null
          start_date?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          converted_member_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          inviter_id: string
          message: string | null
          status: string
        }
        Insert: {
          converted_member_id?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          inviter_id: string
          message?: string | null
          status?: string
        }
        Update: {
          converted_member_id?: string | null
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
      reply_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          label: string
          sort_order?: number
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      request_changes: {
        Row: {
          body: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          kind: string
          request_id: string
          status: string
        }
        Insert: {
          body?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          kind: string
          request_id: string
          status?: string
        }
        Update: {
          body?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          kind?: string
          request_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_changes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_events: {
        Row: {
          actor_id: string | null
          created_at: string
          detail: string | null
          id: string
          kind: string
          request_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          kind: string
          request_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          kind?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_files: {
        Row: {
          created_at: string
          id: string
          mime: string
          name: string
          path: string
          request_id: string
          size: number
          uploaded_by: string | null
          visible_to_member: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          mime: string
          name: string
          path: string
          request_id: string
          size: number
          uploaded_by?: string | null
          visible_to_member?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          mime?: string
          name?: string
          path?: string
          request_id?: string
          size?: number
          uploaded_by?: string | null
          visible_to_member?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "request_files_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_messages: {
        Row: {
          author_id: string | null
          author_role: string
          body: string
          created_at: string
          id: string
          request_id: string
        }
        Insert: {
          author_id?: string | null
          author_role: string
          body: string
          created_at?: string
          id?: string
          request_id: string
        }
        Update: {
          author_id?: string | null
          author_role?: string
          body?: string
          created_at?: string
          id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_notes: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          request_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          request_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_notes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_proposal_options: {
        Row: {
          chosen: boolean
          detail: string
          estimate_cents: number | null
          id: string
          label: string
          proposal_id: string
          sort_order: number
        }
        Insert: {
          chosen?: boolean
          detail?: string
          estimate_cents?: number | null
          id?: string
          label: string
          proposal_id: string
          sort_order?: number
        }
        Update: {
          chosen?: boolean
          detail?: string
          estimate_cents?: number | null
          id?: string
          label?: string
          proposal_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "request_proposal_options_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "request_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      request_proposals: {
        Row: {
          created_at: string
          created_by: string | null
          decided_at: string | null
          id: string
          request_id: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          id?: string
          request_id: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          id?: string
          request_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_proposals_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_reviews: {
        Row: {
          comment: string
          created_at: string
          rating: string
          request_id: string
          user_id: string
        }
        Insert: {
          comment?: string
          created_at?: string
          rating: string
          request_id: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          rating?: string
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_reviews_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          amount_cents: number | null
          clickup_state: Json | null
          clickup_task_id: string | null
          category: string
          concierge: string
          concierge_id: string | null
          created_at: string
          delegate_record: string | null
          description: string
          guests: number | null
          id: string
          image_key: string
          recurring_id: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          status: Database["public"]["Enums"]["request_status"]
          team_reply: string | null
          team_reply_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          amount_cents?: number | null
          clickup_state?: Json | null
          clickup_task_id?: string | null
          category?: string
          concierge?: string
          concierge_id?: string | null
          created_at?: string
          delegate_record?: string | null
          description?: string
          guests?: number | null
          id?: string
          image_key?: string
          recurring_id?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          team_reply?: string | null
          team_reply_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          amount_cents?: number | null
          clickup_state?: Json | null
          clickup_task_id?: string | null
          category?: string
          concierge?: string
          concierge_id?: string | null
          created_at?: string
          delegate_record?: string | null
          description?: string
          guests?: number | null
          id?: string
          image_key?: string
          recurring_id?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          team_reply?: string | null
          team_reply_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_delegate_record_fkey"
            columns: ["delegate_record"]
            isOneToOne: false
            referencedRelation: "member_delegates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_recurring_id_fkey"
            columns: ["recurring_id"]
            isOneToOne: false
            referencedRelation: "recurring_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_invoice: {
        Args: {
          _amount_cents: number
          _commission_cents?: number
          _commission_rate?: number
          _kind: string
          _mollie_payment_id?: string
          _request_id?: string
          _service_cents?: number
          _status: string
          _user_id: string
        }
        Returns: {
          id: string
          number: string
        }[]
      }
      generate_recurring_requests: {
        Args: { _today?: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_member: { Args: { _user_id: string }; Returns: boolean }
      is_team: { Args: { _user_id: string }; Returns: boolean }
      mark_request_notifications_read: {
        Args: { _request_id: string }
        Returns: undefined
      }
      next_invoice_number: { Args: never; Returns: string }
      notify_webhook_secret: { Args: never; Returns: string }
      team_member_counts: {
        Args: never
        Returns: {
          invoices_count: number
          requests_count: number
          user_id: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "member" | "concierge"
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
      app_role: ["admin", "member", "concierge"],
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
