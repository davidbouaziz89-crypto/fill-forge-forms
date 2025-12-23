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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      client_custom_values: {
        Row: {
          client_id: string
          custom_field_id: string
          id: string
          updated_at: string | null
          value_text: string | null
        }
        Insert: {
          client_id: string
          custom_field_id: string
          id?: string
          updated_at?: string | null
          value_text?: string | null
        }
        Update: {
          client_id?: string
          custom_field_id?: string
          id?: string
          updated_at?: string | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_custom_values_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_custom_values_custom_field_id_fkey"
            columns: ["custom_field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          assigned_user_id: string | null
          category: string | null
          city: string | null
          code_naf: string | null
          company_name: string
          country: string | null
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          siret: string | null
          tags: Json | null
          type_client: string | null
          updated_at: string | null
          zip: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          assigned_user_id?: string | null
          category?: string | null
          city?: string | null
          code_naf?: string | null
          company_name: string
          country?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          siret?: string | null
          tags?: Json | null
          type_client?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          assigned_user_id?: string | null
          category?: string | null
          city?: string | null
          code_naf?: string | null
          company_name?: string
          country?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          siret?: string | null
          tags?: Json | null
          type_client?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_fields: {
        Row: {
          created_at: string | null
          default_value: string | null
          id: string
          key: string
          label: string
          options_json: Json | null
          required_bool: boolean | null
          sort_order: number | null
          type: Database["public"]["Enums"]["field_type"]
          visibility: Database["public"]["Enums"]["field_visibility"] | null
        }
        Insert: {
          created_at?: string | null
          default_value?: string | null
          id?: string
          key: string
          label: string
          options_json?: Json | null
          required_bool?: boolean | null
          sort_order?: number | null
          type?: Database["public"]["Enums"]["field_type"]
          visibility?: Database["public"]["Enums"]["field_visibility"] | null
        }
        Update: {
          created_at?: string | null
          default_value?: string | null
          id?: string
          key?: string
          label?: string
          options_json?: Json | null
          required_bool?: boolean | null
          sort_order?: number | null
          type?: Database["public"]["Enums"]["field_type"]
          visibility?: Database["public"]["Enums"]["field_visibility"] | null
        }
        Relationships: []
      }
      generated_documents: {
        Row: {
          client_id: string
          created_at: string | null
          generated_by_user_id: string | null
          generated_pdf_storage_path: string
          id: string
          meta_json: Json | null
          template_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          generated_by_user_id?: string | null
          generated_pdf_storage_path: string
          id?: string
          meta_json?: Json | null
          template_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          generated_by_user_id?: string | null
          generated_pdf_storage_path?: string
          id?: string
          meta_json?: Json | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_generated_by_user_id_fkey"
            columns: ["generated_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "pdf_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_template_fields: {
        Row: {
          align: Database["public"]["Enums"]["text_align"] | null
          created_at: string | null
          fallback_value: string | null
          field_key: string
          field_source: Database["public"]["Enums"]["field_source"]
          font_size: number | null
          height: number | null
          id: string
          page: number
          template_id: string
          transform: Database["public"]["Enums"]["text_transform"] | null
          width: number | null
          x: number
          y: number
        }
        Insert: {
          align?: Database["public"]["Enums"]["text_align"] | null
          created_at?: string | null
          fallback_value?: string | null
          field_key: string
          field_source?: Database["public"]["Enums"]["field_source"]
          font_size?: number | null
          height?: number | null
          id?: string
          page?: number
          template_id: string
          transform?: Database["public"]["Enums"]["text_transform"] | null
          width?: number | null
          x?: number
          y?: number
        }
        Update: {
          align?: Database["public"]["Enums"]["text_align"] | null
          created_at?: string | null
          fallback_value?: string | null
          field_key?: string
          field_source?: Database["public"]["Enums"]["field_source"]
          font_size?: number | null
          height?: number | null
          id?: string
          page?: number
          template_id?: string
          transform?: Database["public"]["Enums"]["text_transform"] | null
          width?: number | null
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "pdf_template_fields_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "pdf_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_templates: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          source_pdf_storage_path: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          source_pdf_storage_path?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          source_pdf_storage_path?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      no_admin_exists: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "sales"
      field_source: "standard" | "custom"
      field_type: "text" | "number" | "date" | "select" | "boolean"
      field_visibility: "admin_only" | "editable" | "read_only"
      text_align: "left" | "center" | "right"
      text_transform: "none" | "uppercase" | "lowercase" | "capitalize"
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
      app_role: ["admin", "sales"],
      field_source: ["standard", "custom"],
      field_type: ["text", "number", "date", "select", "boolean"],
      field_visibility: ["admin_only", "editable", "read_only"],
      text_align: ["left", "center", "right"],
      text_transform: ["none", "uppercase", "lowercase", "capitalize"],
    },
  },
} as const
