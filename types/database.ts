export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      applications: {
        Row: {
          application_type: Database["public"]["Enums"]["application_type"]
          completion_percent: number
          created_at: string
          decision_released_at: string | null
          id: string
          launched_at: string | null
          reference_number: number
          responses: Json
          review_started_at: string | null
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          application_type: Database["public"]["Enums"]["application_type"]
          completion_percent?: number
          created_at?: string
          decision_released_at?: string | null
          id?: string
          launched_at?: string | null
          reference_number?: never
          responses?: Json
          review_started_at?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          application_type?: Database["public"]["Enums"]["application_type"]
          completion_percent?: number
          created_at?: string
          decision_released_at?: string | null
          id?: string
          launched_at?: string | null
          reference_number?: never
          responses?: Json
          review_started_at?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_role: Database["public"]["Enums"]["account_role"]
          application_types: Database["public"]["Enums"]["application_type"][]
          created_at: string
          display_name: string | null
          email: string
          id: string
          updated_at: string
        }
        Insert: {
          account_role: Database["public"]["Enums"]["account_role"]
          application_types?: Database["public"]["Enums"]["application_type"][]
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          updated_at?: string
        }
        Update: {
          account_role?: Database["public"]["Enums"]["account_role"]
          application_types?: Database["public"]["Enums"]["application_type"][]
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          application_id: string
          completed_at: string | null
          created_at: string
          id: string
          notes: string
          overall_score: number | null
          recommendation: Database["public"]["Enums"]["recommendation"] | null
          reviewer_id: string
          rubric_scores: Json
          updated_at: string
        }
        Insert: {
          application_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string
          overall_score?: number | null
          recommendation?: Database["public"]["Enums"]["recommendation"] | null
          reviewer_id: string
          rubric_scores?: Json
          updated_at?: string
        }
        Update: {
          application_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string
          overall_score?: number | null
          recommendation?: Database["public"]["Enums"]["recommendation"] | null
          reviewer_id?: string
          rubric_scores?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_application_status_breakdown: {
        Args: never
        Returns: {
          application_count: number
          application_type: Database["public"]["Enums"]["application_type"]
          status: Database["public"]["Enums"]["application_status"]
        }[]
      }
      get_judge_expertise_counts: {
        Args: never
        Returns: {
          expertise: string
          judge_count: number
        }[]
      }
      get_next_unreviewed_application_id: {
        Args: { p_after_id?: string }
        Returns: string
      }
      get_organizer_overview: {
        Args: never
        Returns: {
          accepted_count: number
          awaiting_review_count: number
          decisions_made_count: number
          draft_count: number
          in_review_count: number
          needs_review_count: number
          ready_for_decision_count: number
          reviews_completed_count: number
          submitted_count: number
          total_applications: number
          waitlisted_count: number
        }[]
      }
      list_review_applications: {
        Args: {
          p_application_type?: Database["public"]["Enums"]["application_type"]
          p_limit?: number
          p_offset?: number
          p_review_state?: string
          p_search?: string
          p_sort?: string
          p_status?: Database["public"]["Enums"]["application_status"]
        }
        Returns: {
          affiliation: string
          applicant_email: string
          applicant_name: string
          application_type: Database["public"]["Enums"]["application_type"]
          decision_released_at: string
          id: string
          launched_at: string
          overall_score: number
          recommendation: Database["public"]["Enums"]["recommendation"]
          reference_number: number
          review_completed_at: string
          review_id: string
          review_started_at: string
          reviewer_id: string
          status: Database["public"]["Enums"]["application_status"]
          total_count: number
        }[]
      }
    }
    Enums: {
      account_role: "hacker" | "judge" | "organizer"
      application_status:
        | "draft"
        | "submitted"
        | "in_review"
        | "accepted"
        | "waitlisted"
      application_type: "hacker" | "judge"
      recommendation: "strong_yes" | "yes" | "maybe" | "no"
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
      account_role: ["hacker", "judge", "organizer"],
      application_status: [
        "draft",
        "submitted",
        "in_review",
        "accepted",
        "waitlisted",
      ],
      application_type: ["hacker", "judge"],
      recommendation: ["strong_yes", "yes", "maybe", "no"],
    },
  },
} as const

