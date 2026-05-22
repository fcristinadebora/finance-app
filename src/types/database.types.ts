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
      periods: {
        Row: {
          id: string
          user_id: string
          started_on: string
          label: string | null
          created_at: string
          total_balance: number | null
          expenses: number | null
          incomes: number | null
          savings: number | null
        }
        Insert: {
          id?: string
          user_id: string
          started_on: string
          label?: string | null
          created_at?: string
          total_balance?: number | null
          expenses?: number | null
          incomes?: number | null
          savings?: number | null
        }
        Update: {
          id?: string
          user_id?: string
          started_on?: string
          label?: string | null
          created_at?: string
          total_balance?: number | null
          expenses?: number | null
          incomes?: number | null
          savings?: number | null
        }
        Relationships: []
      }
      period_account_snapshots: {
        Row: {
          id: string
          period_id: string
          account_id: string
          user_id: string
          balance: number
          created_at: string
        }
        Insert: {
          id?: string
          period_id: string
          account_id: string
          user_id: string
          balance: number
          created_at?: string
        }
        Update: {
          id?: string
          period_id?: string
          account_id?: string
          user_id?: string
          balance?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "period_account_snapshots_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "period_account_snapshots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          id: string
          name: string
          starting_balance: number
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          name: string
          starting_balance?: number
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          name?: string
          starting_balance?: number
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          category_id: string
          created_at: string
          id: string
          monthly_limit: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          monthly_limit: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          monthly_limit?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          exclude_from_totals: boolean
          is_savings: boolean
          icon: string | null
          id: string
          kind: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          exclude_from_totals?: boolean | null
          is_savings?: boolean | null
          icon?: string | null
          id?: string
          kind: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          exclude_from_totals?: boolean | null
          is_savings?: boolean | null
          icon?: string | null
          id?: string
          kind?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      share_payments: {
        Row: {
          id: string
          share_id: string
          user_id: string
          payers: string[]
          amount: number
          paid_on: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          share_id: string
          user_id: string
          payers: string[]
          amount: number
          paid_on?: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          share_id?: string
          user_id?: string
          payers?: string[]
          amount?: number
          paid_on?: string
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_payments_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "shared_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_expenses: {
        Row: {
          id: string
          user_id: string
          title: string
          extra_info: string | null
          participants: string[]
          share_token: string
          password: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          extra_info?: string | null
          participants?: string[]
          share_token: string
          password?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          extra_info?: string | null
          participants?: string[]
          share_token?: string
          password?: string | null
          created_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          category_id: string | null
          created_at: string
          description: string
          id: string
          kind: string
          notes: string | null
          occurred_on: string
          share_id: string | null
          transfer_pair_id: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          category_id?: string | null
          created_at?: string
          description: string
          id?: string
          kind: string
          notes?: string | null
          occurred_on?: string
          share_id?: string | null
          transfer_pair_id?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          category_id?: string | null
          created_at?: string
          description?: string
          id?: string
          kind?: string
          notes?: string | null
          occurred_on?: string
          share_id?: string | null
          transfer_pair_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_transfer_pair_id_fkey"
            columns: ["transfer_pair_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      account_balances: {
        Row: {
          account_id: string | null
          current_balance: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_share_meta: {
        Args: { p_token: string }
        Returns: Json
      }
      get_share_by_token: {
        Args: { p_token: string; p_password?: string }
        Returns: Json
      }
      create_transfer: {
        Args: {
          amount: number
          description: string
          from_account: string
          notes?: string
          occurred_on: string
          to_account: string
        }
        Returns: {
          account_id: string
          amount: number
          category_id: string | null
          created_at: string
          description: string
          id: string
          kind: string
          notes: string | null
          occurred_on: string
          transfer_pair_id: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const