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
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_address: string | null
          message: string
          name: string
          phone: string | null
          subject: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
          message: string
          name: string
          phone?: string | null
          subject?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          message?: string
          name?: string
          phone?: string | null
          subject?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      member_profiles: {
        Row: {
          city: string | null
          company_name: string | null
          created_at: string
          current_period_end: string | null
          dispatch_email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          membership_status: string
          phone: string | null
          preferred_zip_codes: string[]
          provider_application_id: string | null
          region: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          company_name?: string | null
          created_at?: string
          current_period_end?: string | null
          dispatch_email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          membership_status?: string
          phone?: string | null
          preferred_zip_codes?: string[]
          provider_application_id?: string | null
          region?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          company_name?: string | null
          created_at?: string
          current_period_end?: string | null
          dispatch_email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          membership_status?: string
          phone?: string | null
          preferred_zip_codes?: string[]
          provider_application_id?: string | null
          region?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_profiles_provider_application_id_fkey"
            columns: ["provider_application_id"]
            isOneToOne: false
            referencedRelation: "provider_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_applications: {
        Row: {
          city: string
          company_name: string
          contact_name: string | null
          county: string | null
          created_at: string
          dispatch_email: string | null
          documents: Json
          driver_license_number: string | null
          ein: string | null
          email: string
          first_name: string | null
          fleet_size: number | null
          id: string
          insurance_carrier: string | null
          insurance_policy_number: string | null
          last_name: string | null
          notes: string | null
          npi: string | null
          phone: string
          preferred_zip_codes: string[]
          region: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          service_types: string[]
          status: string
          zip_code: string | null
        }
        Insert: {
          city: string
          company_name: string
          contact_name?: string | null
          county?: string | null
          created_at?: string
          dispatch_email?: string | null
          documents?: Json
          driver_license_number?: string | null
          ein?: string | null
          email: string
          first_name?: string | null
          fleet_size?: number | null
          id?: string
          insurance_carrier?: string | null
          insurance_policy_number?: string | null
          last_name?: string | null
          notes?: string | null
          npi?: string | null
          phone: string
          preferred_zip_codes?: string[]
          region?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_types?: string[]
          status?: string
          zip_code?: string | null
        }
        Update: {
          city?: string
          company_name?: string
          contact_name?: string | null
          county?: string | null
          created_at?: string
          dispatch_email?: string | null
          documents?: Json
          driver_license_number?: string | null
          ein?: string | null
          email?: string
          first_name?: string | null
          fleet_size?: number | null
          id?: string
          insurance_carrier?: string | null
          insurance_policy_number?: string | null
          last_name?: string | null
          notes?: string | null
          npi?: string | null
          phone?: string
          preferred_zip_codes?: string[]
          region?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_types?: string[]
          status?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      provider_contacts: {
        Row: {
          company_name: string | null
          contact_type: string
          created_at: string
          default_dropoff_location_id: string | null
          default_pickup_location_id: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          mobility_notes: string | null
          notes: string | null
          owner_id: string
          payer: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          contact_type: string
          created_at?: string
          default_dropoff_location_id?: string | null
          default_pickup_location_id?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          mobility_notes?: string | null
          notes?: string | null
          owner_id: string
          payer?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          contact_type?: string
          created_at?: string
          default_dropoff_location_id?: string | null
          default_pickup_location_id?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          mobility_notes?: string | null
          notes?: string | null
          owner_id?: string
          payer?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_contacts_default_dropoff_fk"
            columns: ["default_dropoff_location_id"]
            isOneToOne: false
            referencedRelation: "saved_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_contacts_default_pickup_fk"
            columns: ["default_pickup_location_id"]
            isOneToOne: false
            referencedRelation: "saved_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_requests: {
        Row: {
          created_at: string
          dropoff_address: string
          dropoff_city: string
          id: string
          ip_address: string | null
          mobility_notes: string | null
          patient_email: string | null
          patient_first_name: string
          patient_last_name: string
          patient_phone: string
          pickup_address: string
          pickup_city: string
          pickup_date: string
          pickup_time: string
          round_trip: boolean
          special_instructions: string | null
          status: string
          transport_type: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          dropoff_address: string
          dropoff_city: string
          id?: string
          ip_address?: string | null
          mobility_notes?: string | null
          patient_email?: string | null
          patient_first_name: string
          patient_last_name: string
          patient_phone: string
          pickup_address: string
          pickup_city: string
          pickup_date: string
          pickup_time: string
          round_trip?: boolean
          special_instructions?: string | null
          status?: string
          transport_type: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          dropoff_address?: string
          dropoff_city?: string
          id?: string
          ip_address?: string | null
          mobility_notes?: string | null
          patient_email?: string | null
          patient_first_name?: string
          patient_last_name?: string
          patient_phone?: string
          pickup_address?: string
          pickup_city?: string
          pickup_date?: string
          pickup_time?: string
          round_trip?: boolean
          special_instructions?: string | null
          status?: string
          transport_type?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      saved_locations: {
        Row: {
          address: string
          city: string | null
          contact_id: string | null
          created_at: string
          id: string
          label: string
          lat: number | null
          lng: number | null
          notes: string | null
          owner_id: string
          state: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          address: string
          city?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          label: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          owner_id: string
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address?: string
          city?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          label?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          owner_id?: string
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_locations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "provider_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      trips: {
        Row: {
          assigned_to: string | null
          contact_id: string | null
          created_at: string
          created_by: string
          dropoff_address: string
          dropoff_city: string
          dropoff_location_id: string | null
          dropoff_zip: string | null
          id: string
          mobility_notes: string | null
          patient_first_name: string
          patient_last_name: string
          patient_phone: string | null
          payer: string | null
          pickup_address: string
          pickup_city: string
          pickup_date: string
          pickup_location_id: string | null
          pickup_time: string
          pickup_zip: string | null
          region: string | null
          round_trip: boolean
          source: string
          special_instructions: string | null
          status: string
          transport_type: string | null
          trip_number: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string
          created_by: string
          dropoff_address: string
          dropoff_city: string
          dropoff_location_id?: string | null
          dropoff_zip?: string | null
          id?: string
          mobility_notes?: string | null
          patient_first_name: string
          patient_last_name: string
          patient_phone?: string | null
          payer?: string | null
          pickup_address: string
          pickup_city: string
          pickup_date: string
          pickup_location_id?: string | null
          pickup_time: string
          pickup_zip?: string | null
          region?: string | null
          round_trip?: boolean
          source?: string
          special_instructions?: string | null
          status?: string
          transport_type?: string | null
          trip_number?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string
          dropoff_address?: string
          dropoff_city?: string
          dropoff_location_id?: string | null
          dropoff_zip?: string | null
          id?: string
          mobility_notes?: string | null
          patient_first_name?: string
          patient_last_name?: string
          patient_phone?: string | null
          payer?: string | null
          pickup_address?: string
          pickup_city?: string
          pickup_date?: string
          pickup_location_id?: string | null
          pickup_time?: string
          pickup_zip?: string | null
          region?: string | null
          round_trip?: boolean
          source?: string
          special_instructions?: string | null
          status?: string
          transport_type?: string | null
          trip_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "provider_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_dropoff_location_id_fkey"
            columns: ["dropoff_location_id"]
            isOneToOne: false
            referencedRelation: "saved_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_pickup_location_id_fkey"
            columns: ["pickup_location_id"]
            isOneToOne: false
            referencedRelation: "saved_locations"
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff"
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
      app_role: ["admin", "staff"],
    },
  },
} as const
