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
      drivers: {
        Row: {
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_name: string
          license_expiry: string | null
          license_number: string | null
          notes: string | null
          owner_id: string
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          license_expiry?: string | null
          license_number?: string | null
          notes?: string | null
          owner_id: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          license_expiry?: string | null
          license_number?: string | null
          notes?: string | null
          owner_id?: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      hipaa_acknowledgments: {
        Row: {
          acknowledged_at: string
          context: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
          version: string
        }
        Insert: {
          acknowledged_at?: string
          context: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
          version?: string
        }
        Update: {
          acknowledged_at?: string
          context?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
          version?: string
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
          membership_tier: Database["public"]["Enums"]["membership_tier"]
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
          membership_tier?: Database["public"]["Enums"]["membership_tier"]
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
          membership_tier?: Database["public"]["Enums"]["membership_tier"]
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
      notification_email_queue: {
        Row: {
          body: string
          created_at: string
          error: string | null
          id: string
          recipient_email: string
          ride_request_id: string | null
          sent_at: string | null
          subject: string
        }
        Insert: {
          body: string
          created_at?: string
          error?: string | null
          id?: string
          recipient_email: string
          ride_request_id?: string | null
          sent_at?: string | null
          subject: string
        }
        Update: {
          body?: string
          created_at?: string
          error?: string | null
          id?: string
          recipient_email?: string
          ride_request_id?: string | null
          sent_at?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_email_queue_ride_request_id_fkey"
            columns: ["ride_request_id"]
            isOneToOne: false
            referencedRelation: "ride_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          ride_request_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          ride_request_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          ride_request_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_ride_request_id_fkey"
            columns: ["ride_request_id"]
            isOneToOne: false
            referencedRelation: "ride_requests"
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
      provider_integrations: {
        Row: {
          api_key_encrypted: string | null
          config: Json
          created_at: string
          enabled: boolean
          id: string
          last_sync_at: string | null
          provider_id: string
          updated_at: string
          vendor: string
          webhook_secret: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          last_sync_at?: string | null
          provider_id: string
          updated_at?: string
          vendor: string
          webhook_secret?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          last_sync_at?: string | null
          provider_id?: string
          updated_at?: string
          vendor?: string
          webhook_secret?: string | null
        }
        Relationships: []
      }
      provider_pricing: {
        Row: {
          additional_passenger: number
          after_hours_addon: number
          after_hours_end: string
          after_hours_start: string
          base_pickup: number
          cancellation: number
          created_at: string
          currency: string
          holiday_surcharge: number
          holidays: string[]
          minimum_fare: number
          no_show: number
          owner_id: string
          pay_additional_passenger: number | null
          pay_after_hours_addon: number | null
          pay_base_pickup: number | null
          pay_cancellation: number | null
          pay_holiday_surcharge: number | null
          pay_no_show: number | null
          pay_per_mile: number | null
          pay_stretcher_addon: number | null
          pay_wait_per_min: number | null
          pay_wheelchair_addon: number | null
          per_mile: number
          stretcher_addon: number
          updated_at: string
          wait_per_min: number
          wheelchair_addon: number
        }
        Insert: {
          additional_passenger?: number
          after_hours_addon?: number
          after_hours_end?: string
          after_hours_start?: string
          base_pickup?: number
          cancellation?: number
          created_at?: string
          currency?: string
          holiday_surcharge?: number
          holidays?: string[]
          minimum_fare?: number
          no_show?: number
          owner_id: string
          pay_additional_passenger?: number | null
          pay_after_hours_addon?: number | null
          pay_base_pickup?: number | null
          pay_cancellation?: number | null
          pay_holiday_surcharge?: number | null
          pay_no_show?: number | null
          pay_per_mile?: number | null
          pay_stretcher_addon?: number | null
          pay_wait_per_min?: number | null
          pay_wheelchair_addon?: number | null
          per_mile?: number
          stretcher_addon?: number
          updated_at?: string
          wait_per_min?: number
          wheelchair_addon?: number
        }
        Update: {
          additional_passenger?: number
          after_hours_addon?: number
          after_hours_end?: string
          after_hours_start?: string
          base_pickup?: number
          cancellation?: number
          created_at?: string
          currency?: string
          holiday_surcharge?: number
          holidays?: string[]
          minimum_fare?: number
          no_show?: number
          owner_id?: string
          pay_additional_passenger?: number | null
          pay_after_hours_addon?: number | null
          pay_base_pickup?: number | null
          pay_cancellation?: number | null
          pay_holiday_surcharge?: number | null
          pay_no_show?: number | null
          pay_per_mile?: number | null
          pay_stretcher_addon?: number | null
          pay_wait_per_min?: number | null
          pay_wheelchair_addon?: number | null
          per_mile?: number
          stretcher_addon?: number
          updated_at?: string
          wait_per_min?: number
          wheelchair_addon?: number
        }
        Relationships: []
      }
      requester_saved_locations: {
        Row: {
          address: string
          city: string
          created_at: string
          id: string
          label: string
          notes: string | null
          updated_at: string
          user_id: string
          zip: string | null
        }
        Insert: {
          address: string
          city: string
          created_at?: string
          id?: string
          label: string
          notes?: string | null
          updated_at?: string
          user_id: string
          zip?: string | null
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          id?: string
          label?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
          zip?: string | null
        }
        Relationships: []
      }
      ride_requests: {
        Row: {
          assigned_provider_id: string | null
          cancel_reason: string | null
          canceled_at: string | null
          created_at: string
          dropoff_address: string
          dropoff_city: string
          hipaa_ack_id: string | null
          id: string
          ip_address: string | null
          last_updated_at: string
          mobility_notes: string | null
          patient_email: string | null
          patient_first_name: string
          patient_last_name: string
          patient_phone: string
          payment_amount_cents: number | null
          payment_status: string
          pickup_address: string
          pickup_city: string
          pickup_date: string
          pickup_time: string
          provider_notes: string | null
          recurrence_end_date: string | null
          recurrence_exceptions: string[]
          recurrence_rule: string | null
          requester_email: string | null
          requester_phone: string | null
          requester_user_id: string | null
          round_trip: boolean
          special_instructions: string | null
          status: string
          transport_type: string
          user_agent: string | null
        }
        Insert: {
          assigned_provider_id?: string | null
          cancel_reason?: string | null
          canceled_at?: string | null
          created_at?: string
          dropoff_address: string
          dropoff_city: string
          hipaa_ack_id?: string | null
          id?: string
          ip_address?: string | null
          last_updated_at?: string
          mobility_notes?: string | null
          patient_email?: string | null
          patient_first_name: string
          patient_last_name: string
          patient_phone: string
          payment_amount_cents?: number | null
          payment_status?: string
          pickup_address: string
          pickup_city: string
          pickup_date: string
          pickup_time: string
          provider_notes?: string | null
          recurrence_end_date?: string | null
          recurrence_exceptions?: string[]
          recurrence_rule?: string | null
          requester_email?: string | null
          requester_phone?: string | null
          requester_user_id?: string | null
          round_trip?: boolean
          special_instructions?: string | null
          status?: string
          transport_type: string
          user_agent?: string | null
        }
        Update: {
          assigned_provider_id?: string | null
          cancel_reason?: string | null
          canceled_at?: string | null
          created_at?: string
          dropoff_address?: string
          dropoff_city?: string
          hipaa_ack_id?: string | null
          id?: string
          ip_address?: string | null
          last_updated_at?: string
          mobility_notes?: string | null
          patient_email?: string | null
          patient_first_name?: string
          patient_last_name?: string
          patient_phone?: string
          payment_amount_cents?: number | null
          payment_status?: string
          pickup_address?: string
          pickup_city?: string
          pickup_date?: string
          pickup_time?: string
          provider_notes?: string | null
          recurrence_end_date?: string | null
          recurrence_exceptions?: string[]
          recurrence_rule?: string | null
          requester_email?: string | null
          requester_phone?: string | null
          requester_user_id?: string | null
          round_trip?: boolean
          special_instructions?: string | null
          status?: string
          transport_type?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ride_requests_hipaa_ack_id_fkey"
            columns: ["hipaa_ack_id"]
            isOneToOne: false
            referencedRelation: "hipaa_acknowledgments"
            referencedColumns: ["id"]
          },
        ]
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
          actual_dropoff_at: string | null
          actual_miles: number | null
          actual_pickup_at: string | null
          additional_passengers: number
          assigned_to: string | null
          cancel_reason: string | null
          contact_id: string | null
          cost_breakdown: Json | null
          cost_total: number | null
          created_at: string
          created_by: string
          driver_id: string | null
          dropoff_address: string
          dropoff_city: string
          dropoff_location_id: string | null
          dropoff_zip: string | null
          estimated_dropoff_at: string | null
          estimated_miles: number | null
          estimated_pickup_at: string | null
          hipaa_ack_id: string | null
          id: string
          mobility_notes: string | null
          no_show_reason: string | null
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
          vehicle_id: string | null
          wait_minutes: number | null
        }
        Insert: {
          actual_dropoff_at?: string | null
          actual_miles?: number | null
          actual_pickup_at?: string | null
          additional_passengers?: number
          assigned_to?: string | null
          cancel_reason?: string | null
          contact_id?: string | null
          cost_breakdown?: Json | null
          cost_total?: number | null
          created_at?: string
          created_by: string
          driver_id?: string | null
          dropoff_address: string
          dropoff_city: string
          dropoff_location_id?: string | null
          dropoff_zip?: string | null
          estimated_dropoff_at?: string | null
          estimated_miles?: number | null
          estimated_pickup_at?: string | null
          hipaa_ack_id?: string | null
          id?: string
          mobility_notes?: string | null
          no_show_reason?: string | null
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
          vehicle_id?: string | null
          wait_minutes?: number | null
        }
        Update: {
          actual_dropoff_at?: string | null
          actual_miles?: number | null
          actual_pickup_at?: string | null
          additional_passengers?: number
          assigned_to?: string | null
          cancel_reason?: string | null
          contact_id?: string | null
          cost_breakdown?: Json | null
          cost_total?: number | null
          created_at?: string
          created_by?: string
          driver_id?: string | null
          dropoff_address?: string
          dropoff_city?: string
          dropoff_location_id?: string | null
          dropoff_zip?: string | null
          estimated_dropoff_at?: string | null
          estimated_miles?: number | null
          estimated_pickup_at?: string | null
          hipaa_ack_id?: string | null
          id?: string
          mobility_notes?: string | null
          no_show_reason?: string | null
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
          vehicle_id?: string | null
          wait_minutes?: number | null
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
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
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
            foreignKeyName: "trips_hipaa_ack_id_fkey"
            columns: ["hipaa_ack_id"]
            isOneToOne: false
            referencedRelation: "hipaa_acknowledgments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_pickup_location_id_fkey"
            columns: ["pickup_location_id"]
            isOneToOne: false
            referencedRelation: "saved_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
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
      vehicles: {
        Row: {
          capacity: number
          created_at: string
          id: string
          name: string
          notes: string | null
          owner_id: string
          plate: string | null
          status: string
          updated_at: string
          vehicle_type: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          owner_id: string
          plate?: string | null
          status?: string
          updated_at?: string
          vehicle_type?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          plate?: string | null
          status?: string
          updated_at?: string
          vehicle_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      member_directory: {
        Row: {
          city: string | null
          company_name: string | null
          display_name: string | null
          membership_tier: Database["public"]["Enums"]["membership_tier"] | null
          preferred_zip_codes: string[] | null
          region: string | null
          user_id: string | null
        }
        Insert: {
          city?: string | null
          company_name?: string | null
          display_name?: never
          membership_tier?:
            | Database["public"]["Enums"]["membership_tier"]
            | null
          preferred_zip_codes?: string[] | null
          region?: string | null
          user_id?: string | null
        }
        Update: {
          city?: string | null
          company_name?: string | null
          display_name?: never
          membership_tier?:
            | Database["public"]["Enums"]["membership_tier"]
            | null
          preferred_zip_codes?: string[] | null
          region?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      trips_admin_metadata: {
        Row: {
          assigned_to: string | null
          cost_total: number | null
          created_at: string | null
          created_by: string | null
          dropoff_city: string | null
          dropoff_zip: string | null
          hipaa_ack_id: string | null
          id: string | null
          payer: string | null
          pickup_city: string | null
          pickup_date: string | null
          pickup_time: string | null
          pickup_zip: string | null
          region: string | null
          round_trip: boolean | null
          source: string | null
          status: string | null
          transport_type: string | null
          trip_number: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          cost_total?: number | null
          created_at?: string | null
          created_by?: string | null
          dropoff_city?: string | null
          dropoff_zip?: string | null
          hipaa_ack_id?: string | null
          id?: string | null
          payer?: string | null
          pickup_city?: string | null
          pickup_date?: string | null
          pickup_time?: string | null
          pickup_zip?: string | null
          region?: string | null
          round_trip?: boolean | null
          source?: string | null
          status?: string | null
          transport_type?: string | null
          trip_number?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          cost_total?: number | null
          created_at?: string | null
          created_by?: string | null
          dropoff_city?: string | null
          dropoff_zip?: string | null
          hipaa_ack_id?: string | null
          id?: string | null
          payer?: string | null
          pickup_city?: string | null
          pickup_date?: string | null
          pickup_time?: string | null
          pickup_zip?: string | null
          region?: string | null
          round_trip?: boolean | null
          source?: string | null
          status?: string | null
          transport_type?: string | null
          trip_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_hipaa_ack_id_fkey"
            columns: ["hipaa_ack_id"]
            isOneToOne: false
            referencedRelation: "hipaa_acknowledgments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_grant_free_membership: {
        Args: { _user_id: string }
        Returns: undefined
      }
      can_send_trips: { Args: { _user_id: string }; Returns: boolean }
      get_trips_admin_metadata: {
        Args: never
        Returns: {
          assigned_to: string | null
          cost_total: number | null
          created_at: string | null
          created_by: string | null
          dropoff_city: string | null
          dropoff_zip: string | null
          hipaa_ack_id: string | null
          id: string | null
          payer: string | null
          pickup_city: string | null
          pickup_date: string | null
          pickup_time: string | null
          pickup_zip: string | null
          region: string | null
          round_trip: boolean | null
          source: string | null
          status: string | null
          transport_type: string | null
          trip_number: string | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "trips_admin_metadata"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "requester"
      membership_tier: "none" | "free" | "paid"
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
      app_role: ["admin", "staff", "requester"],
      membership_tier: ["none", "free", "paid"],
    },
  },
} as const
