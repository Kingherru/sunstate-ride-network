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
      course_attempts: {
        Row: {
          answers: Json
          created_at: string
          enrollment_id: string
          id: string
          passed: boolean | null
          score: number | null
          started_at: string
          submitted_at: string | null
          user_id: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          enrollment_id: string
          id?: string
          passed?: boolean | null
          score?: number | null
          started_at?: string
          submitted_at?: string | null
          user_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          enrollment_id?: string
          id?: string
          passed?: boolean | null
          score?: number | null
          started_at?: string
          submitted_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_attempts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "course_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      course_certificates: {
        Row: {
          cert_number: string
          course_id: string
          created_at: string
          enrollment_id: string
          expires_at: string | null
          holder_name: string
          id: string
          issued_at: string
          pdf_storage_path: string | null
          user_id: string
          verify_token: string
        }
        Insert: {
          cert_number: string
          course_id: string
          created_at?: string
          enrollment_id: string
          expires_at?: string | null
          holder_name: string
          id?: string
          issued_at?: string
          pdf_storage_path?: string | null
          user_id: string
          verify_token: string
        }
        Update: {
          cert_number?: string
          course_id?: string
          created_at?: string
          enrollment_id?: string
          expires_at?: string | null
          holder_name?: string
          id?: string
          issued_at?: string
          pdf_storage_path?: string | null
          user_id?: string
          verify_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_certificates_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "course_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      course_enrollments: {
        Row: {
          completed_at: string | null
          course_id: string
          created_at: string
          id: string
          progress: Json
          purchased_at: string
          status: string
          stripe_session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          created_at?: string
          id?: string
          progress?: Json
          purchased_at?: string
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          created_at?: string
          id?: string
          progress?: Json
          purchased_at?: string
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules: {
        Row: {
          body_markdown: string
          course_id: string
          created_at: string
          id: string
          ord: number
          title: string
          video_url: string | null
        }
        Insert: {
          body_markdown?: string
          course_id: string
          created_at?: string
          id?: string
          ord: number
          title: string
          video_url?: string | null
        }
        Update: {
          body_markdown?: string
          course_id?: string
          created_at?: string
          id?: string
          ord?: number
          title?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_questions: {
        Row: {
          choices: Json
          correct_index: number
          course_id: string
          created_at: string
          explanation: string | null
          id: string
          ord: number
          prompt: string
        }
        Insert: {
          choices?: Json
          correct_index: number
          course_id: string
          created_at?: string
          explanation?: string | null
          id?: string
          ord: number
          prompt: string
        }
        Update: {
          choices?: Json
          correct_index?: number
          course_id?: string
          created_at?: string
          explanation?: string | null
          id?: string
          ord?: number
          prompt?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_questions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          cert_validity_months: number
          cover_image: string | null
          created_at: string
          description: string
          duration_min: number
          id: string
          is_published: boolean
          passing_score: number
          price_cents: number
          price_id: string | null
          slug: string
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          cert_validity_months?: number
          cover_image?: string | null
          created_at?: string
          description?: string
          duration_min?: number
          id?: string
          is_published?: boolean
          passing_score?: number
          price_cents?: number
          price_id?: string | null
          slug: string
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          cert_validity_months?: number
          cover_image?: string | null
          created_at?: string
          description?: string
          duration_min?: number
          id?: string
          is_published?: boolean
          passing_score?: number
          price_cents?: number
          price_id?: string | null
          slug?: string
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      dispatch_zone_zips: {
        Row: {
          created_at: string
          updated_at: string
          zip: string
          zone_id: string
        }
        Insert: {
          created_at?: string
          updated_at?: string
          zip: string
          zone_id: string
        }
        Update: {
          created_at?: string
          updated_at?: string
          zip?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_zone_zips_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "dispatch_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_zone_zips_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zone_pricing_averages"
            referencedColumns: ["zone_id"]
          },
        ]
      }
      dispatch_zones: {
        Row: {
          code: string
          created_at: string
          id: string
          is_preset: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_preset?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_preset?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      driver_earning_adjustments: {
        Row: {
          amount_cents: number
          applied_on: string
          created_at: string
          created_by: string | null
          driver_id: string
          id: string
          owner_id: string
          reason: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          applied_on?: string
          created_at?: string
          created_by?: string | null
          driver_id: string
          id?: string
          owner_id: string
          reason?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          applied_on?: string
          created_at?: string
          created_by?: string | null
          driver_id?: string
          id?: string
          owner_id?: string
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_earning_adjustments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_earnings_reports: {
        Row: {
          created_at: string
          driver_id: string
          id: string
          notes: string | null
          owner_id: string
          period_end: string
          period_start: string
          recipient_email: string
          sent_at: string
          sent_by: string | null
          snapshot: Json
          status: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          id?: string
          notes?: string | null
          owner_id: string
          period_end: string
          period_start: string
          recipient_email: string
          sent_at?: string
          sent_by?: string | null
          snapshot?: Json
          status?: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          id?: string
          notes?: string | null
          owner_id?: string
          period_end?: string
          period_start?: string
          recipient_email?: string
          sent_at?: string
          sent_by?: string | null
          snapshot?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_earnings_reports_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_payments: {
        Row: {
          amount_paid_cents: number
          created_at: string
          created_by: string | null
          driver_id: string
          gross_cents: number
          id: string
          method: string | null
          notes: string | null
          owner_id: string
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_paid_cents?: number
          created_at?: string
          created_by?: string | null
          driver_id: string
          gross_cents?: number
          id?: string
          method?: string | null
          notes?: string | null
          owner_id: string
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_paid_cents?: number
          created_at?: string
          created_by?: string | null
          driver_id?: string
          gross_cents?: number
          id?: string
          method?: string | null
          notes?: string | null
          owner_id?: string
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          reference?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_payments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          availability: Json
          contractor_pricing: Json
          created_at: string
          email: string | null
          employment_type: string | null
          first_name: string
          id: string
          last_name: string
          license_expiry: string | null
          license_number: string | null
          notes: string | null
          owner_id: string
          pay_type: string | null
          phone: string | null
          primary_vehicle_id: string | null
          service_capabilities: string[]
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          availability?: Json
          contractor_pricing?: Json
          created_at?: string
          email?: string | null
          employment_type?: string | null
          first_name: string
          id?: string
          last_name: string
          license_expiry?: string | null
          license_number?: string | null
          notes?: string | null
          owner_id: string
          pay_type?: string | null
          phone?: string | null
          primary_vehicle_id?: string | null
          service_capabilities?: string[]
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          availability?: Json
          contractor_pricing?: Json
          created_at?: string
          email?: string | null
          employment_type?: string | null
          first_name?: string
          id?: string
          last_name?: string
          license_expiry?: string | null
          license_number?: string | null
          notes?: string | null
          owner_id?: string
          pay_type?: string | null
          phone?: string | null
          primary_vehicle_id?: string | null
          service_capabilities?: string[]
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_primary_vehicle_id_fkey"
            columns: ["primary_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      facility_saved_providers: {
        Row: {
          created_at: string
          facility_user_id: string
          id: string
          notes: string | null
          provider_user_id: string
        }
        Insert: {
          created_at?: string
          facility_user_id: string
          id?: string
          notes?: string | null
          provider_user_id: string
        }
        Update: {
          created_at?: string
          facility_user_id?: string
          id?: string
          notes?: string | null
          provider_user_id?: string
        }
        Relationships: []
      }
      feedback_submissions: {
        Row: {
          admin_notes: string | null
          category: string
          created_at: string
          id: string
          message: string
          portal: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          subject: string
          submitter_display_id: string | null
          submitter_email: string | null
          submitter_user_id: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          category: string
          created_at?: string
          id?: string
          message: string
          portal: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject: string
          submitter_display_id?: string | null
          submitter_email?: string | null
          submitter_user_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          category?: string
          created_at?: string
          id?: string
          message?: string
          portal?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject?: string
          submitter_display_id?: string | null
          submitter_email?: string | null
          submitter_user_id?: string | null
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
      medicaid_contacts: {
        Row: {
          contact_name: string
          created_at: string
          email: string | null
          id: string
          is_public: boolean
          notes: string | null
          organization: string | null
          phone: string | null
          provider_user_id: string | null
          updated_at: string
        }
        Insert: {
          contact_name: string
          created_at?: string
          email?: string | null
          id?: string
          is_public?: boolean
          notes?: string | null
          organization?: string | null
          phone?: string | null
          provider_user_id?: string | null
          updated_at?: string
        }
        Update: {
          contact_name?: string
          created_at?: string
          email?: string | null
          id?: string
          is_public?: boolean
          notes?: string | null
          organization?: string | null
          phone?: string | null
          provider_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      medicaid_eligibility_checks: {
        Row: {
          created_at: string
          id: string
          medicaid_number: string
          patient_dob: string | null
          patient_last_name: string | null
          provider_user_id: string
          result_details: Json
          result_plan: string | null
          result_status: string
        }
        Insert: {
          created_at?: string
          id?: string
          medicaid_number: string
          patient_dob?: string | null
          patient_last_name?: string | null
          provider_user_id: string
          result_details?: Json
          result_plan?: string | null
          result_status?: string
        }
        Update: {
          created_at?: string
          id?: string
          medicaid_number?: string
          patient_dob?: string | null
          patient_last_name?: string | null
          provider_user_id?: string
          result_details?: Json
          result_plan?: string | null
          result_status?: string
        }
        Relationships: []
      }
      medicaid_packet_events: {
        Row: {
          action: string
          actor_display_id: string | null
          actor_user_id: string | null
          created_at: string
          from_status: string | null
          id: string
          metadata: Json
          packet_id: string
          to_status: string | null
        }
        Insert: {
          action: string
          actor_display_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          packet_id: string
          to_status?: string | null
        }
        Update: {
          action?: string
          actor_display_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          packet_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medicaid_packet_events_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: false
            referencedRelation: "medicaid_packets"
            referencedColumns: ["id"]
          },
        ]
      }
      medicaid_packet_items: {
        Row: {
          created_at: string
          doc_path: string | null
          id: string
          kind: string
          label: string | null
          meta: Json
          packet_id: string
          trip_id: string | null
        }
        Insert: {
          created_at?: string
          doc_path?: string | null
          id?: string
          kind: string
          label?: string | null
          meta?: Json
          packet_id: string
          trip_id?: string | null
        }
        Update: {
          created_at?: string
          doc_path?: string | null
          id?: string
          kind?: string
          label?: string | null
          meta?: Json
          packet_id?: string
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medicaid_packet_items_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: false
            referencedRelation: "medicaid_packets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicaid_packet_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_financial_ledger"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "medicaid_packet_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicaid_packet_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips_admin_metadata"
            referencedColumns: ["id"]
          },
        ]
      }
      medicaid_packets: {
        Row: {
          created_at: string
          decided_at: string | null
          id: string
          medicaid_contact_id: string | null
          notes: string | null
          provider_user_id: string
          status: string
          submission_reference: string | null
          submitted_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          id?: string
          medicaid_contact_id?: string | null
          notes?: string | null
          provider_user_id: string
          status?: string
          submission_reference?: string | null
          submitted_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          id?: string
          medicaid_contact_id?: string | null
          notes?: string | null
          provider_user_id?: string
          status?: string
          submission_reference?: string | null
          submitted_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicaid_packets_medicaid_contact_id_fkey"
            columns: ["medicaid_contact_id"]
            isOneToOne: false
            referencedRelation: "medicaid_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      member_profiles: {
        Row: {
          allow_live_medicaid_verification: boolean
          auto_upgraded_to_facility_at: string | null
          billing_contact: Json | null
          business_address: string | null
          center_lat: number | null
          center_lng: number | null
          city: string | null
          company_name: string | null
          created_at: string
          current_period_end: string | null
          date_of_birth: string | null
          dispatch_email: string | null
          dispatch_zone_id: string | null
          display_id: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string | null
          id: string
          last_name: string | null
          long_distance_ok: boolean
          medicaid_cert_doc_path: string | null
          medicaid_cert_expires_at: string | null
          medicaid_number: string | null
          medicaid_plan: string | null
          medicaid_verified: boolean
          medicaid_verified_at: string | null
          membership_status: string
          membership_tier: Database["public"]["Enums"]["membership_tier"]
          npi: string | null
          patient_relationship: string | null
          patient_relationship_other: string | null
          patient_type: string | null
          patient_type_other: string | null
          phone: string | null
          postal_code: string | null
          preferred_zip_codes: string[]
          provider_application_id: string | null
          referral_fee_amount: number | null
          referral_fee_type: string | null
          region: string | null
          service_radius_miles: number
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
          work_hours_end: string | null
          work_hours_start: string | null
          work_hours_weekly: Json
        }
        Insert: {
          allow_live_medicaid_verification?: boolean
          auto_upgraded_to_facility_at?: string | null
          billing_contact?: Json | null
          business_address?: string | null
          center_lat?: number | null
          center_lng?: number | null
          city?: string | null
          company_name?: string | null
          created_at?: string
          current_period_end?: string | null
          date_of_birth?: string | null
          dispatch_email?: string | null
          dispatch_zone_id?: string | null
          display_id?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          long_distance_ok?: boolean
          medicaid_cert_doc_path?: string | null
          medicaid_cert_expires_at?: string | null
          medicaid_number?: string | null
          medicaid_plan?: string | null
          medicaid_verified?: boolean
          medicaid_verified_at?: string | null
          membership_status?: string
          membership_tier?: Database["public"]["Enums"]["membership_tier"]
          npi?: string | null
          patient_relationship?: string | null
          patient_relationship_other?: string | null
          patient_type?: string | null
          patient_type_other?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_zip_codes?: string[]
          provider_application_id?: string | null
          referral_fee_amount?: number | null
          referral_fee_type?: string | null
          region?: string | null
          service_radius_miles?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
          work_hours_end?: string | null
          work_hours_start?: string | null
          work_hours_weekly?: Json
        }
        Update: {
          allow_live_medicaid_verification?: boolean
          auto_upgraded_to_facility_at?: string | null
          billing_contact?: Json | null
          business_address?: string | null
          center_lat?: number | null
          center_lng?: number | null
          city?: string | null
          company_name?: string | null
          created_at?: string
          current_period_end?: string | null
          date_of_birth?: string | null
          dispatch_email?: string | null
          dispatch_zone_id?: string | null
          display_id?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          long_distance_ok?: boolean
          medicaid_cert_doc_path?: string | null
          medicaid_cert_expires_at?: string | null
          medicaid_number?: string | null
          medicaid_plan?: string | null
          medicaid_verified?: boolean
          medicaid_verified_at?: string | null
          membership_status?: string
          membership_tier?: Database["public"]["Enums"]["membership_tier"]
          npi?: string | null
          patient_relationship?: string | null
          patient_relationship_other?: string | null
          patient_type?: string | null
          patient_type_other?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_zip_codes?: string[]
          provider_application_id?: string | null
          referral_fee_amount?: number | null
          referral_fee_type?: string | null
          region?: string | null
          service_radius_miles?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
          work_hours_end?: string | null
          work_hours_start?: string | null
          work_hours_weekly?: Json
        }
        Relationships: [
          {
            foreignKeyName: "member_profiles_dispatch_zone_id_fkey"
            columns: ["dispatch_zone_id"]
            isOneToOne: false
            referencedRelation: "dispatch_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_profiles_dispatch_zone_id_fkey"
            columns: ["dispatch_zone_id"]
            isOneToOne: false
            referencedRelation: "zone_pricing_averages"
            referencedColumns: ["zone_id"]
          },
          {
            foreignKeyName: "member_profiles_provider_application_id_fkey"
            columns: ["provider_application_id"]
            isOneToOne: false
            referencedRelation: "provider_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_opportunity_email_log: {
        Row: {
          batch_period_start: string
          estimated_revenue_cents: number
          id: string
          provider_user_id: string
          sent_at: string
          trip_count: number
        }
        Insert: {
          batch_period_start: string
          estimated_revenue_cents?: number
          id?: string
          provider_user_id: string
          sent_at?: string
          trip_count?: number
        }
        Update: {
          batch_period_start?: string
          estimated_revenue_cents?: number
          id?: string
          provider_user_id?: string
          sent_at?: string
          trip_count?: number
        }
        Relationships: []
      }
      message_threads: {
        Row: {
          created_at: string
          created_by: string
          feedback_id: string | null
          id: string
          kind: string
          last_message_at: string
          subject: string | null
          zone_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          feedback_id?: string | null
          id?: string
          kind?: string
          last_message_at?: string
          subject?: string | null
          zone_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          feedback_id?: string | null
          id?: string
          kind?: string
          last_message_at?: string
          subject?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "dispatch_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zone_pricing_averages"
            referencedColumns: ["zone_id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_id: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_id: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
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
      payer_payment_methods: {
        Row: {
          brand: string | null
          created_at: string
          environment: string
          exp_month: number | null
          exp_year: number | null
          id: string
          is_default: boolean
          label: string | null
          last4: string | null
          payer_id: string
          stripe_payment_method_id: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          environment?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          label?: string | null
          last4?: string | null
          payer_id: string
          stripe_payment_method_id: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          environment?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          label?: string | null
          last4?: string | null
          payer_id?: string
          stripe_payment_method_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payer_payment_methods_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
        ]
      }
      payer_stripe_customers: {
        Row: {
          created_at: string
          environment: string
          payer_id: string
          stripe_customer_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          environment?: string
          payer_id: string
          stripe_customer_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          environment?: string
          payer_id?: string
          stripe_customer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payer_stripe_customers_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
        ]
      }
      payers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          owner_user_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_user_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_user_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          id: boolean
          market_pricing: Json
          medicaid_pricing: Json
          platform_fee_pct: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          market_pricing?: Json
          medicaid_pricing?: Json
          platform_fee_pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          market_pricing?: Json
          medicaid_pricing?: Json
          platform_fee_pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      platform_theme: {
        Row: {
          accent_color: string
          background_color: string
          border_color: string
          card_color: string
          card_style: string
          created_at: string
          custom_css: string | null
          footer_style: string
          foreground_color: string
          form_accent_color: string | null
          form_primary_color: string | null
          header_style: string
          id: string
          is_active: boolean
          layout_style: string
          muted_color: string
          portal_accent_color: string | null
          portal_background_color: string | null
          portal_border_color: string | null
          portal_card_color: string | null
          portal_foreground_color: string | null
          portal_primary_color: string | null
          primary_color: string
          radius_scale: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          background_color?: string
          border_color?: string
          card_color?: string
          card_style?: string
          created_at?: string
          custom_css?: string | null
          footer_style?: string
          foreground_color?: string
          form_accent_color?: string | null
          form_primary_color?: string | null
          header_style?: string
          id?: string
          is_active?: boolean
          layout_style?: string
          muted_color?: string
          portal_accent_color?: string | null
          portal_background_color?: string | null
          portal_border_color?: string | null
          portal_card_color?: string | null
          portal_foreground_color?: string | null
          portal_primary_color?: string | null
          primary_color?: string
          radius_scale?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          background_color?: string
          border_color?: string
          card_color?: string
          card_style?: string
          created_at?: string
          custom_css?: string | null
          footer_style?: string
          foreground_color?: string
          form_accent_color?: string | null
          form_primary_color?: string | null
          header_style?: string
          id?: string
          is_active?: boolean
          layout_style?: string
          muted_color?: string
          portal_accent_color?: string | null
          portal_background_color?: string | null
          portal_border_color?: string | null
          portal_card_color?: string | null
          portal_foreground_color?: string | null
          portal_primary_color?: string | null
          primary_color?: string
          radius_scale?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_webhook_endpoints: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          enabled: boolean
          events: string[]
          id: string
          label: string
          signing_secret: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          events?: string[]
          id?: string
          label: string
          signing_secret?: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          events?: string[]
          id?: string
          label?: string
          signing_secret?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      provider_applications: {
        Row: {
          city: string
          company_name: string
          compliance_last_escalated_at: string | null
          compliance_notes: string | null
          compliance_review_started_at: string | null
          compliance_status: string
          compliance_updated_at: string | null
          compliance_updated_by: string | null
          contact_name: string | null
          county: string | null
          created_at: string
          dispatch_email: string | null
          display_id: string | null
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
          compliance_last_escalated_at?: string | null
          compliance_notes?: string | null
          compliance_review_started_at?: string | null
          compliance_status?: string
          compliance_updated_at?: string | null
          compliance_updated_by?: string | null
          contact_name?: string | null
          county?: string | null
          created_at?: string
          dispatch_email?: string | null
          display_id?: string | null
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
          compliance_last_escalated_at?: string | null
          compliance_notes?: string | null
          compliance_review_started_at?: string | null
          compliance_status?: string
          compliance_updated_at?: string | null
          compliance_updated_by?: string | null
          contact_name?: string | null
          county?: string | null
          created_at?: string
          dispatch_email?: string | null
          display_id?: string | null
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
      provider_credentials: {
        Row: {
          created_at: string
          doc_path: string | null
          expires_at: string | null
          id: string
          kind: string
          label: string
          notes: string | null
          provider_user_id: string
          required: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          doc_path?: string | null
          expires_at?: string | null
          id?: string
          kind: string
          label: string
          notes?: string | null
          provider_user_id: string
          required?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          doc_path?: string | null
          expires_at?: string | null
          id?: string
          kind?: string
          label?: string
          notes?: string | null
          provider_user_id?: string
          required?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      provider_embed_tokens: {
        Row: {
          created_at: string
          id: string
          provider_user_id: string
          revoked_at: string | null
          token: string
        }
        Insert: {
          created_at?: string
          id?: string
          provider_user_id: string
          revoked_at?: string | null
          token: string
        }
        Update: {
          created_at?: string
          id?: string
          provider_user_id?: string
          revoked_at?: string | null
          token?: string
        }
        Relationships: []
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
      provider_payout_accounts: {
        Row: {
          charges_enabled: boolean
          created_at: string
          details_submitted: boolean
          payouts_enabled: boolean
          requirements_due: Json | null
          status: Database["public"]["Enums"]["payout_account_status"]
          stripe_account_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          charges_enabled?: boolean
          created_at?: string
          details_submitted?: boolean
          payouts_enabled?: boolean
          requirements_due?: Json | null
          status?: Database["public"]["Enums"]["payout_account_status"]
          stripe_account_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          charges_enabled?: boolean
          created_at?: string
          details_submitted?: boolean
          payouts_enabled?: boolean
          requirements_due?: Json | null
          status?: Database["public"]["Enums"]["payout_account_status"]
          stripe_account_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      provider_payout_transfers: {
        Row: {
          created_at: string
          failure_reason: string | null
          fee_cents: number
          gross_cents: number
          id: string
          net_cents: number
          provider_user_id: string
          status: string
          stripe_account_id: string
          stripe_transfer_id: string | null
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          failure_reason?: string | null
          fee_cents: number
          gross_cents: number
          id?: string
          net_cents: number
          provider_user_id: string
          status?: string
          stripe_account_id: string
          stripe_transfer_id?: string | null
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          failure_reason?: string | null
          fee_cents?: number
          gross_cents?: number
          id?: string
          net_cents?: number
          provider_user_id?: string
          status?: string
          stripe_account_id?: string
          stripe_transfer_id?: string | null
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_payout_transfers_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_financial_ledger"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "provider_payout_transfers_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_payout_transfers_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips_admin_metadata"
            referencedColumns: ["id"]
          },
        ]
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
          delivery_base: number
          delivery_cold_chain_surcharge: number
          delivery_enabled: boolean
          delivery_min_fee: number
          delivery_per_mile: number
          delivery_rush_surcharge: number
          delivery_signature_surcharge: number
          delivery_wait_per_unit: number
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
          pay_wait_unit: string | null
          pay_wheelchair_addon: number | null
          per_mile: number
          stretcher_addon: number
          updated_at: string
          wait_per_min: number
          wait_unit: string
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
          delivery_base?: number
          delivery_cold_chain_surcharge?: number
          delivery_enabled?: boolean
          delivery_min_fee?: number
          delivery_per_mile?: number
          delivery_rush_surcharge?: number
          delivery_signature_surcharge?: number
          delivery_wait_per_unit?: number
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
          pay_wait_unit?: string | null
          pay_wheelchair_addon?: number | null
          per_mile?: number
          stretcher_addon?: number
          updated_at?: string
          wait_per_min?: number
          wait_unit?: string
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
          delivery_base?: number
          delivery_cold_chain_surcharge?: number
          delivery_enabled?: boolean
          delivery_min_fee?: number
          delivery_per_mile?: number
          delivery_rush_surcharge?: number
          delivery_signature_surcharge?: number
          delivery_wait_per_unit?: number
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
          pay_wait_unit?: string | null
          pay_wheelchair_addon?: number | null
          per_mile?: number
          stretcher_addon?: number
          updated_at?: string
          wait_per_min?: number
          wait_unit?: string
          wheelchair_addon?: number
        }
        Relationships: []
      }
      provider_ratings: {
        Row: {
          cleanliness: number | null
          comment: string | null
          completed_pickup: number | null
          created_at: string
          id: string
          on_time_arrival: number | null
          on_time_pickup: number | null
          overall: number
          professionalism: number | null
          provider_id: string
          rater_id: string
          trip_id: string
        }
        Insert: {
          cleanliness?: number | null
          comment?: string | null
          completed_pickup?: number | null
          created_at?: string
          id?: string
          on_time_arrival?: number | null
          on_time_pickup?: number | null
          overall: number
          professionalism?: number | null
          provider_id: string
          rater_id: string
          trip_id: string
        }
        Update: {
          cleanliness?: number | null
          comment?: string | null
          completed_pickup?: number | null
          created_at?: string
          id?: string
          on_time_arrival?: number | null
          on_time_pickup?: number | null
          overall?: number
          professionalism?: number | null
          provider_id?: string
          rater_id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_ratings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_financial_ledger"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "provider_ratings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_ratings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips_admin_metadata"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_schedule_entries: {
        Row: {
          created_at: string
          dropoff_address: string
          dropoff_time: string | null
          id: string
          notes: string | null
          owner_id: string
          passenger_first_name: string
          passenger_last_name: string
          passenger_phone: string | null
          pickup_address: string
          pickup_date: string
          pickup_time: string
          round_trip: boolean
          updated_at: string
          week_start: string
        }
        Insert: {
          created_at?: string
          dropoff_address: string
          dropoff_time?: string | null
          id?: string
          notes?: string | null
          owner_id: string
          passenger_first_name: string
          passenger_last_name: string
          passenger_phone?: string | null
          pickup_address: string
          pickup_date: string
          pickup_time: string
          round_trip?: boolean
          updated_at?: string
          week_start: string
        }
        Update: {
          created_at?: string
          dropoff_address?: string
          dropoff_time?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          passenger_first_name?: string
          passenger_last_name?: string
          passenger_phone?: string | null
          pickup_address?: string
          pickup_date?: string
          pickup_time?: string
          round_trip?: boolean
          updated_at?: string
          week_start?: string
        }
        Relationships: []
      }
      provider_webhook_endpoints: {
        Row: {
          created_at: string
          enabled: boolean
          events: string[]
          id: string
          label: string
          last_failure_at: string | null
          last_success_at: string | null
          provider_user_id: string
          signing_secret: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          events?: string[]
          id?: string
          label: string
          last_failure_at?: string | null
          last_success_at?: string | null
          provider_user_id: string
          signing_secret?: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          events?: string[]
          id?: string
          label?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          provider_user_id?: string
          signing_secret?: string
          updated_at?: string
          url?: string
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
      ride_request_history: {
        Row: {
          action: string
          changed_by: string | null
          changed_by_email: string | null
          changed_by_role: string | null
          changes: Json
          created_at: string
          id: string
          ride_request_id: string
          summary: string | null
        }
        Insert: {
          action?: string
          changed_by?: string | null
          changed_by_email?: string | null
          changed_by_role?: string | null
          changes?: Json
          created_at?: string
          id?: string
          ride_request_id: string
          summary?: string | null
        }
        Update: {
          action?: string
          changed_by?: string | null
          changed_by_email?: string | null
          changed_by_role?: string | null
          changes?: Json
          created_at?: string
          id?: string
          ride_request_id?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ride_request_history_ride_request_id_fkey"
            columns: ["ride_request_id"]
            isOneToOne: false
            referencedRelation: "ride_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_request_revisions: {
        Row: {
          change_summary: string | null
          changed_by: string | null
          changed_by_email: string | null
          changed_by_role: string | null
          created_at: string
          id: string
          revision_number: number
          ride_request_id: string
          snapshot: Json
        }
        Insert: {
          change_summary?: string | null
          changed_by?: string | null
          changed_by_email?: string | null
          changed_by_role?: string | null
          created_at?: string
          id?: string
          revision_number: number
          ride_request_id: string
          snapshot: Json
        }
        Update: {
          change_summary?: string | null
          changed_by?: string | null
          changed_by_email?: string | null
          changed_by_role?: string | null
          created_at?: string
          id?: string
          revision_number?: number
          ride_request_id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ride_request_revisions_ride_request_id_fkey"
            columns: ["ride_request_id"]
            isOneToOne: false
            referencedRelation: "ride_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_requests: {
        Row: {
          additional_stops: Json
          appointment_time: string | null
          assigned_driver_id: string | null
          assigned_provider_id: string | null
          assigned_vehicle_id: string | null
          authorization_number: string | null
          black_tie_quote_cents: number | null
          black_tie_quote_notes: string | null
          black_tie_quote_status: string
          black_tie_vehicle: string | null
          cancel_reason: string | null
          canceled_at: string | null
          created_at: string
          delivery_hazmat: boolean
          delivery_item_description: string | null
          delivery_item_type:
            | Database["public"]["Enums"]["delivery_item_type"]
            | null
          delivery_recipient_name: string | null
          delivery_recipient_phone: string | null
          delivery_rush: boolean
          delivery_signature_required: boolean
          delivery_temperature_sensitive: boolean
          delivery_weight_lbs: number | null
          diagnosis_code: string | null
          dispatch_source: string
          distance_miles: number | null
          dropoff_address: string
          dropoff_city: string
          dropoff_lat: number | null
          dropoff_lng: number | null
          dropoff_zip: string | null
          embed_provider_id: string | null
          embed_token: string | null
          estimated_cost_cents: number | null
          estimated_duration_seconds: number | null
          estimated_duration_traffic_seconds: number | null
          has_passenger: boolean
          hipaa_ack_id: string | null
          id: string
          ip_address: string | null
          is_black_tie: boolean
          last_updated_at: string
          medicaid_number: string | null
          medicaid_plan: string | null
          mobility_notes: string | null
          needs_assistance_to_vehicle: boolean
          needs_surgery_signin: boolean
          needs_surgery_signout: boolean
          needs_wheelchair: boolean
          patient_date_of_birth: string | null
          patient_email: string | null
          patient_first_name: string
          patient_gender: string | null
          patient_last_name: string
          patient_phone: string
          payer: string | null
          payer_id: string | null
          payment_amount_cents: number | null
          payment_status: string
          pickup_address: string
          pickup_address_details: string | null
          pickup_city: string
          pickup_date: string
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_time: string
          pickup_zip: string | null
          provider_notes: string | null
          recurrence_end_date: string | null
          recurrence_exceptions: string[]
          recurrence_rule: string | null
          requester_email: string | null
          requester_phone: string | null
          requester_user_id: string | null
          return_dropoff_time: string | null
          return_pickup_time: string | null
          round_trip: boolean
          route_computed_at: string | null
          route_polyline: string | null
          scheduled_start_time: string | null
          service_level: Database["public"]["Enums"]["service_level"] | null
          special_instructions: string | null
          status: string
          transport_type: string
          trip_billing_email: string | null
          trip_billing_first_name: string | null
          trip_billing_last_name: string | null
          trip_billing_phone: string | null
          trip_billing_source: string | null
          trip_kind: Database["public"]["Enums"]["trip_kind"]
          trip_type: string
          user_agent: string | null
        }
        Insert: {
          additional_stops?: Json
          appointment_time?: string | null
          assigned_driver_id?: string | null
          assigned_provider_id?: string | null
          assigned_vehicle_id?: string | null
          authorization_number?: string | null
          black_tie_quote_cents?: number | null
          black_tie_quote_notes?: string | null
          black_tie_quote_status?: string
          black_tie_vehicle?: string | null
          cancel_reason?: string | null
          canceled_at?: string | null
          created_at?: string
          delivery_hazmat?: boolean
          delivery_item_description?: string | null
          delivery_item_type?:
            | Database["public"]["Enums"]["delivery_item_type"]
            | null
          delivery_recipient_name?: string | null
          delivery_recipient_phone?: string | null
          delivery_rush?: boolean
          delivery_signature_required?: boolean
          delivery_temperature_sensitive?: boolean
          delivery_weight_lbs?: number | null
          diagnosis_code?: string | null
          dispatch_source?: string
          distance_miles?: number | null
          dropoff_address: string
          dropoff_city: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_zip?: string | null
          embed_provider_id?: string | null
          embed_token?: string | null
          estimated_cost_cents?: number | null
          estimated_duration_seconds?: number | null
          estimated_duration_traffic_seconds?: number | null
          has_passenger?: boolean
          hipaa_ack_id?: string | null
          id?: string
          ip_address?: string | null
          is_black_tie?: boolean
          last_updated_at?: string
          medicaid_number?: string | null
          medicaid_plan?: string | null
          mobility_notes?: string | null
          needs_assistance_to_vehicle?: boolean
          needs_surgery_signin?: boolean
          needs_surgery_signout?: boolean
          needs_wheelchair?: boolean
          patient_date_of_birth?: string | null
          patient_email?: string | null
          patient_first_name: string
          patient_gender?: string | null
          patient_last_name: string
          patient_phone: string
          payer?: string | null
          payer_id?: string | null
          payment_amount_cents?: number | null
          payment_status?: string
          pickup_address: string
          pickup_address_details?: string | null
          pickup_city: string
          pickup_date: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_time: string
          pickup_zip?: string | null
          provider_notes?: string | null
          recurrence_end_date?: string | null
          recurrence_exceptions?: string[]
          recurrence_rule?: string | null
          requester_email?: string | null
          requester_phone?: string | null
          requester_user_id?: string | null
          return_dropoff_time?: string | null
          return_pickup_time?: string | null
          round_trip?: boolean
          route_computed_at?: string | null
          route_polyline?: string | null
          scheduled_start_time?: string | null
          service_level?: Database["public"]["Enums"]["service_level"] | null
          special_instructions?: string | null
          status?: string
          transport_type: string
          trip_billing_email?: string | null
          trip_billing_first_name?: string | null
          trip_billing_last_name?: string | null
          trip_billing_phone?: string | null
          trip_billing_source?: string | null
          trip_kind?: Database["public"]["Enums"]["trip_kind"]
          trip_type?: string
          user_agent?: string | null
        }
        Update: {
          additional_stops?: Json
          appointment_time?: string | null
          assigned_driver_id?: string | null
          assigned_provider_id?: string | null
          assigned_vehicle_id?: string | null
          authorization_number?: string | null
          black_tie_quote_cents?: number | null
          black_tie_quote_notes?: string | null
          black_tie_quote_status?: string
          black_tie_vehicle?: string | null
          cancel_reason?: string | null
          canceled_at?: string | null
          created_at?: string
          delivery_hazmat?: boolean
          delivery_item_description?: string | null
          delivery_item_type?:
            | Database["public"]["Enums"]["delivery_item_type"]
            | null
          delivery_recipient_name?: string | null
          delivery_recipient_phone?: string | null
          delivery_rush?: boolean
          delivery_signature_required?: boolean
          delivery_temperature_sensitive?: boolean
          delivery_weight_lbs?: number | null
          diagnosis_code?: string | null
          dispatch_source?: string
          distance_miles?: number | null
          dropoff_address?: string
          dropoff_city?: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_zip?: string | null
          embed_provider_id?: string | null
          embed_token?: string | null
          estimated_cost_cents?: number | null
          estimated_duration_seconds?: number | null
          estimated_duration_traffic_seconds?: number | null
          has_passenger?: boolean
          hipaa_ack_id?: string | null
          id?: string
          ip_address?: string | null
          is_black_tie?: boolean
          last_updated_at?: string
          medicaid_number?: string | null
          medicaid_plan?: string | null
          mobility_notes?: string | null
          needs_assistance_to_vehicle?: boolean
          needs_surgery_signin?: boolean
          needs_surgery_signout?: boolean
          needs_wheelchair?: boolean
          patient_date_of_birth?: string | null
          patient_email?: string | null
          patient_first_name?: string
          patient_gender?: string | null
          patient_last_name?: string
          patient_phone?: string
          payer?: string | null
          payer_id?: string | null
          payment_amount_cents?: number | null
          payment_status?: string
          pickup_address?: string
          pickup_address_details?: string | null
          pickup_city?: string
          pickup_date?: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_time?: string
          pickup_zip?: string | null
          provider_notes?: string | null
          recurrence_end_date?: string | null
          recurrence_exceptions?: string[]
          recurrence_rule?: string | null
          requester_email?: string | null
          requester_phone?: string | null
          requester_user_id?: string | null
          return_dropoff_time?: string | null
          return_pickup_time?: string | null
          round_trip?: boolean
          route_computed_at?: string | null
          route_polyline?: string | null
          scheduled_start_time?: string | null
          service_level?: Database["public"]["Enums"]["service_level"] | null
          special_instructions?: string | null
          status?: string
          transport_type?: string
          trip_billing_email?: string | null
          trip_billing_first_name?: string | null
          trip_billing_last_name?: string | null
          trip_billing_phone?: string | null
          trip_billing_source?: string | null
          trip_kind?: Database["public"]["Enums"]["trip_kind"]
          trip_type?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ride_requests_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_requests_assigned_vehicle_id_fkey"
            columns: ["assigned_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_requests_hipaa_ack_id_fkey"
            columns: ["hipaa_ack_id"]
            isOneToOne: false
            referencedRelation: "hipaa_acknowledgments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_requests_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
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
      saved_patients: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          authorization_number: string | null
          city: string | null
          created_at: string
          default_dropoff_address: string | null
          default_dropoff_city: string | null
          default_payer_id: string | null
          default_pickup_address: string | null
          default_pickup_city: string | null
          diagnosis_code: string | null
          dob: string | null
          email: string | null
          first_name: string
          gender: string | null
          id: string
          kind: string
          last_name: string
          medicaid_id: string | null
          medicaid_number: string | null
          medicaid_plan: string | null
          mobility: string | null
          notes: string | null
          owner_id: string
          payer: string | null
          phone: string | null
          state: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          authorization_number?: string | null
          city?: string | null
          created_at?: string
          default_dropoff_address?: string | null
          default_dropoff_city?: string | null
          default_payer_id?: string | null
          default_pickup_address?: string | null
          default_pickup_city?: string | null
          diagnosis_code?: string | null
          dob?: string | null
          email?: string | null
          first_name: string
          gender?: string | null
          id?: string
          kind?: string
          last_name: string
          medicaid_id?: string | null
          medicaid_number?: string | null
          medicaid_plan?: string | null
          mobility?: string | null
          notes?: string | null
          owner_id: string
          payer?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          authorization_number?: string | null
          city?: string | null
          created_at?: string
          default_dropoff_address?: string | null
          default_dropoff_city?: string | null
          default_payer_id?: string | null
          default_pickup_address?: string | null
          default_pickup_city?: string | null
          diagnosis_code?: string | null
          dob?: string | null
          email?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          kind?: string
          last_name?: string
          medicaid_id?: string | null
          medicaid_number?: string | null
          medicaid_plan?: string | null
          mobility?: string | null
          notes?: string | null
          owner_id?: string
          payer?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_patients_default_payer_id_fkey"
            columns: ["default_payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_payment_methods: {
        Row: {
          brand: string | null
          created_at: string
          environment: string
          exp_month: number | null
          exp_year: number | null
          id: string
          is_default: boolean
          label: string | null
          last4: string | null
          patient_id: string | null
          stripe_payment_method_id: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          environment?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          label?: string | null
          last4?: string | null
          patient_id?: string | null
          stripe_payment_method_id: string
          user_id: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          environment?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          label?: string | null
          last4?: string | null
          patient_id?: string | null
          stripe_payment_method_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_payment_methods_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "saved_patients"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_audit_log: {
        Row: {
          action: string
          actor_display_id: string | null
          actor_email: string | null
          actor_user_id: string | null
          created_at: string
          id: string
          metadata: Json
          target_id: string | null
          target_kind: string | null
        }
        Insert: {
          action: string
          actor_display_id?: string | null
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_kind?: string | null
        }
        Update: {
          action?: string
          actor_display_id?: string | null
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_kind?: string | null
        }
        Relationships: []
      }
      stripe_customers: {
        Row: {
          created_at: string
          environment: string
          stripe_customer_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          environment?: string
          stripe_customer_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          environment?: string
          stripe_customer_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscription_cancellation_reasons: {
        Row: {
          canceled_at: string
          comment: string | null
          created_at: string
          effective_at: string | null
          environment: string | null
          id: string
          plan_tier: string | null
          price_id: string | null
          reason_code: string
          reason_label: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          user_id: string
        }
        Insert: {
          canceled_at?: string
          comment?: string | null
          created_at?: string
          effective_at?: string | null
          environment?: string | null
          id?: string
          plan_tier?: string | null
          price_id?: string | null
          reason_code: string
          reason_label?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          user_id: string
        }
        Update: {
          canceled_at?: string
          comment?: string | null
          created_at?: string
          effective_at?: string | null
          environment?: string | null
          id?: string
          plan_tier?: string | null
          price_id?: string | null
          reason_code?: string
          reason_label?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          user_id?: string
        }
        Relationships: []
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
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tab_view_marks: {
        Row: {
          last_viewed_at: string
          tab_key: string
          user_id: string
        }
        Insert: {
          last_viewed_at?: string
          tab_key: string
          user_id: string
        }
        Update: {
          last_viewed_at?: string
          tab_key?: string
          user_id?: string
        }
        Relationships: []
      }
      thread_participants: {
        Row: {
          joined_at: string
          last_read_at: string | null
          thread_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          last_read_at?: string | null
          thread_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          last_read_at?: string | null
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_participants_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_payments: {
        Row: {
          amount_cents: number
          created_at: string
          environment: string
          id: string
          payer_user_id: string
          platform_fee_cents: number
          provider_user_id: string | null
          ride_request_id: string | null
          status: string
          stripe_payment_intent_id: string
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          environment?: string
          id?: string
          payer_user_id: string
          platform_fee_cents?: number
          provider_user_id?: string | null
          ride_request_id?: string | null
          status?: string
          stripe_payment_intent_id: string
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          environment?: string
          id?: string
          payer_user_id?: string
          platform_fee_cents?: number
          provider_user_id?: string | null
          ride_request_id?: string | null
          status?: string
          stripe_payment_intent_id?: string
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_payments_ride_request_id_fkey"
            columns: ["ride_request_id"]
            isOneToOne: false
            referencedRelation: "ride_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_payments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_financial_ledger"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_payments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_payments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips_admin_metadata"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_quotes: {
        Row: {
          amount_cents: number
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          note: string | null
          provider_user_id: string
          status: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          note?: string | null
          provider_user_id: string
          status?: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          note?: string | null
          provider_user_id?: string
          status?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_quotes_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_financial_ledger"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_quotes_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_quotes_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips_admin_metadata"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_summary_logs: {
        Row: {
          created_at: string
          dropoff_arrival_at: string | null
          id: string
          incidents: string | null
          notes: string | null
          odometer_end: number | null
          odometer_start: number | null
          pickup_arrival_at: string | null
          provider_user_id: string
          total_miles: number | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dropoff_arrival_at?: string | null
          id?: string
          incidents?: string | null
          notes?: string | null
          odometer_end?: number | null
          odometer_start?: number | null
          pickup_arrival_at?: string | null
          provider_user_id: string
          total_miles?: number | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dropoff_arrival_at?: string | null
          id?: string
          incidents?: string | null
          notes?: string | null
          odometer_end?: number | null
          odometer_start?: number | null
          pickup_arrival_at?: string | null
          provider_user_id?: string
          total_miles?: number | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_summary_logs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_financial_ledger"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_summary_logs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_summary_logs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips_admin_metadata"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          actual_dropoff_at: string | null
          actual_miles: number | null
          actual_pickup_at: string | null
          additional_passengers: number
          appointment_time: string | null
          assigned_to: string | null
          authorization_number: string | null
          cancel_reason: string | null
          completed_at: string | null
          completed_by: string | null
          completion_source: string | null
          contact_id: string | null
          cost_breakdown: Json | null
          cost_total: number | null
          created_at: string
          created_by: string | null
          delivery_hazmat: boolean
          delivery_item_description: string | null
          delivery_item_type:
            | Database["public"]["Enums"]["delivery_item_type"]
            | null
          delivery_proof_url: string | null
          delivery_recipient_name: string | null
          delivery_recipient_phone: string | null
          delivery_rush: boolean
          delivery_signature_required: boolean
          delivery_temperature_sensitive: boolean
          delivery_weight_lbs: number | null
          diagnosis_code: string | null
          dispatch_zone_id: string | null
          display_id: string | null
          driver_id: string | null
          dropoff_address: string
          dropoff_city: string
          dropoff_lat: number | null
          dropoff_lng: number | null
          dropoff_location_id: string | null
          dropoff_zip: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          estimated_cost_cents: number | null
          estimated_dropoff_at: string | null
          estimated_duration_seconds: number | null
          estimated_duration_traffic_seconds: number | null
          estimated_miles: number | null
          estimated_pickup_at: string | null
          financial_locked_at: string | null
          has_passenger: boolean
          hipaa_ack_id: string | null
          id: string
          manually_completed_at: string | null
          manually_completed_by: string | null
          medicaid_number: string | null
          medicaid_plan: string | null
          medicaid_remit_received_at: string | null
          mileage: number | null
          mobility_notes: string | null
          needs_assistance_to_vehicle: boolean
          needs_surgery_signin: boolean
          needs_surgery_signout: boolean
          needs_wheelchair: boolean
          no_show_reason: string | null
          odometer_end: number | null
          odometer_start: number | null
          patient_date_of_birth: string | null
          patient_first_name: string
          patient_last_name: string
          patient_phone: string | null
          payer: string | null
          payer_id: string | null
          payer_kind: string | null
          payer_user_id: string | null
          payment_source: string | null
          payment_status: string
          payout_eligible_at: string | null
          payout_hold_reasons: string[]
          payout_is_medicaid: boolean
          payout_released_at: string | null
          payout_released_by: string | null
          payout_status: Database["public"]["Enums"]["trip_payout_status"]
          payout_transfer_id: string | null
          payout_validated_at: string | null
          payout_validated_by: string | null
          pickup_address: string
          pickup_address_details: string | null
          pickup_city: string
          pickup_date: string
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_location_id: string | null
          pickup_time: string
          pickup_zip: string | null
          platform_fee_cents: number | null
          priority_offer_created_at: string | null
          priority_offer_expires_at: string | null
          priority_offer_provider_id: string | null
          priority_offer_refused_at: string | null
          provider_payout_cents: number | null
          referral_fee_cents: number
          referral_fee_source_user_id: string | null
          region: string | null
          return_dropoff_time: string | null
          return_pickup_time: string | null
          ride_request_id: string | null
          round_trip: boolean
          route_computed_at: string | null
          route_polyline: string | null
          service_level: Database["public"]["Enums"]["service_level"] | null
          signature_name: string | null
          signature_relation: string | null
          signature_signed_at: string | null
          source: string
          special_instructions: string | null
          status: string
          transport_type: string | null
          trip_kind: Database["public"]["Enums"]["trip_kind"]
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
          appointment_time?: string | null
          assigned_to?: string | null
          authorization_number?: string | null
          cancel_reason?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_source?: string | null
          contact_id?: string | null
          cost_breakdown?: Json | null
          cost_total?: number | null
          created_at?: string
          created_by?: string | null
          delivery_hazmat?: boolean
          delivery_item_description?: string | null
          delivery_item_type?:
            | Database["public"]["Enums"]["delivery_item_type"]
            | null
          delivery_proof_url?: string | null
          delivery_recipient_name?: string | null
          delivery_recipient_phone?: string | null
          delivery_rush?: boolean
          delivery_signature_required?: boolean
          delivery_temperature_sensitive?: boolean
          delivery_weight_lbs?: number | null
          diagnosis_code?: string | null
          dispatch_zone_id?: string | null
          display_id?: string | null
          driver_id?: string | null
          dropoff_address: string
          dropoff_city: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_location_id?: string | null
          dropoff_zip?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          estimated_cost_cents?: number | null
          estimated_dropoff_at?: string | null
          estimated_duration_seconds?: number | null
          estimated_duration_traffic_seconds?: number | null
          estimated_miles?: number | null
          estimated_pickup_at?: string | null
          financial_locked_at?: string | null
          has_passenger?: boolean
          hipaa_ack_id?: string | null
          id?: string
          manually_completed_at?: string | null
          manually_completed_by?: string | null
          medicaid_number?: string | null
          medicaid_plan?: string | null
          medicaid_remit_received_at?: string | null
          mileage?: number | null
          mobility_notes?: string | null
          needs_assistance_to_vehicle?: boolean
          needs_surgery_signin?: boolean
          needs_surgery_signout?: boolean
          needs_wheelchair?: boolean
          no_show_reason?: string | null
          odometer_end?: number | null
          odometer_start?: number | null
          patient_date_of_birth?: string | null
          patient_first_name: string
          patient_last_name: string
          patient_phone?: string | null
          payer?: string | null
          payer_id?: string | null
          payer_kind?: string | null
          payer_user_id?: string | null
          payment_source?: string | null
          payment_status?: string
          payout_eligible_at?: string | null
          payout_hold_reasons?: string[]
          payout_is_medicaid?: boolean
          payout_released_at?: string | null
          payout_released_by?: string | null
          payout_status?: Database["public"]["Enums"]["trip_payout_status"]
          payout_transfer_id?: string | null
          payout_validated_at?: string | null
          payout_validated_by?: string | null
          pickup_address: string
          pickup_address_details?: string | null
          pickup_city: string
          pickup_date: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_location_id?: string | null
          pickup_time: string
          pickup_zip?: string | null
          platform_fee_cents?: number | null
          priority_offer_created_at?: string | null
          priority_offer_expires_at?: string | null
          priority_offer_provider_id?: string | null
          priority_offer_refused_at?: string | null
          provider_payout_cents?: number | null
          referral_fee_cents?: number
          referral_fee_source_user_id?: string | null
          region?: string | null
          return_dropoff_time?: string | null
          return_pickup_time?: string | null
          ride_request_id?: string | null
          round_trip?: boolean
          route_computed_at?: string | null
          route_polyline?: string | null
          service_level?: Database["public"]["Enums"]["service_level"] | null
          signature_name?: string | null
          signature_relation?: string | null
          signature_signed_at?: string | null
          source?: string
          special_instructions?: string | null
          status?: string
          transport_type?: string | null
          trip_kind?: Database["public"]["Enums"]["trip_kind"]
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
          appointment_time?: string | null
          assigned_to?: string | null
          authorization_number?: string | null
          cancel_reason?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_source?: string | null
          contact_id?: string | null
          cost_breakdown?: Json | null
          cost_total?: number | null
          created_at?: string
          created_by?: string | null
          delivery_hazmat?: boolean
          delivery_item_description?: string | null
          delivery_item_type?:
            | Database["public"]["Enums"]["delivery_item_type"]
            | null
          delivery_proof_url?: string | null
          delivery_recipient_name?: string | null
          delivery_recipient_phone?: string | null
          delivery_rush?: boolean
          delivery_signature_required?: boolean
          delivery_temperature_sensitive?: boolean
          delivery_weight_lbs?: number | null
          diagnosis_code?: string | null
          dispatch_zone_id?: string | null
          display_id?: string | null
          driver_id?: string | null
          dropoff_address?: string
          dropoff_city?: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_location_id?: string | null
          dropoff_zip?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          estimated_cost_cents?: number | null
          estimated_dropoff_at?: string | null
          estimated_duration_seconds?: number | null
          estimated_duration_traffic_seconds?: number | null
          estimated_miles?: number | null
          estimated_pickup_at?: string | null
          financial_locked_at?: string | null
          has_passenger?: boolean
          hipaa_ack_id?: string | null
          id?: string
          manually_completed_at?: string | null
          manually_completed_by?: string | null
          medicaid_number?: string | null
          medicaid_plan?: string | null
          medicaid_remit_received_at?: string | null
          mileage?: number | null
          mobility_notes?: string | null
          needs_assistance_to_vehicle?: boolean
          needs_surgery_signin?: boolean
          needs_surgery_signout?: boolean
          needs_wheelchair?: boolean
          no_show_reason?: string | null
          odometer_end?: number | null
          odometer_start?: number | null
          patient_date_of_birth?: string | null
          patient_first_name?: string
          patient_last_name?: string
          patient_phone?: string | null
          payer?: string | null
          payer_id?: string | null
          payer_kind?: string | null
          payer_user_id?: string | null
          payment_source?: string | null
          payment_status?: string
          payout_eligible_at?: string | null
          payout_hold_reasons?: string[]
          payout_is_medicaid?: boolean
          payout_released_at?: string | null
          payout_released_by?: string | null
          payout_status?: Database["public"]["Enums"]["trip_payout_status"]
          payout_transfer_id?: string | null
          payout_validated_at?: string | null
          payout_validated_by?: string | null
          pickup_address?: string
          pickup_address_details?: string | null
          pickup_city?: string
          pickup_date?: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_location_id?: string | null
          pickup_time?: string
          pickup_zip?: string | null
          platform_fee_cents?: number | null
          priority_offer_created_at?: string | null
          priority_offer_expires_at?: string | null
          priority_offer_provider_id?: string | null
          priority_offer_refused_at?: string | null
          provider_payout_cents?: number | null
          referral_fee_cents?: number
          referral_fee_source_user_id?: string | null
          region?: string | null
          return_dropoff_time?: string | null
          return_pickup_time?: string | null
          ride_request_id?: string | null
          round_trip?: boolean
          route_computed_at?: string | null
          route_polyline?: string | null
          service_level?: Database["public"]["Enums"]["service_level"] | null
          signature_name?: string | null
          signature_relation?: string | null
          signature_signed_at?: string | null
          source?: string
          special_instructions?: string | null
          status?: string
          transport_type?: string | null
          trip_kind?: Database["public"]["Enums"]["trip_kind"]
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
            foreignKeyName: "trips_dispatch_zone_id_fkey"
            columns: ["dispatch_zone_id"]
            isOneToOne: false
            referencedRelation: "dispatch_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_dispatch_zone_id_fkey"
            columns: ["dispatch_zone_id"]
            isOneToOne: false
            referencedRelation: "zone_pricing_averages"
            referencedColumns: ["zone_id"]
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
            foreignKeyName: "trips_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
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
            foreignKeyName: "trips_ride_request_id_fkey"
            columns: ["ride_request_id"]
            isOneToOne: false
            referencedRelation: "ride_requests"
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
          assigned_driver_id: string | null
          capacity: number
          created_at: string
          id: string
          insurance_doc_path: string | null
          insurance_expiry: string | null
          name: string
          notes: string | null
          owner_id: string
          plate: string | null
          registration_doc_path: string | null
          registration_expiry: string | null
          service_capabilities: string[]
          status: string
          updated_at: string
          vehicle_type: string
        }
        Insert: {
          assigned_driver_id?: string | null
          capacity?: number
          created_at?: string
          id?: string
          insurance_doc_path?: string | null
          insurance_expiry?: string | null
          name: string
          notes?: string | null
          owner_id: string
          plate?: string | null
          registration_doc_path?: string | null
          registration_expiry?: string | null
          service_capabilities?: string[]
          status?: string
          updated_at?: string
          vehicle_type?: string
        }
        Update: {
          assigned_driver_id?: string | null
          capacity?: number
          created_at?: string
          id?: string
          insurance_doc_path?: string | null
          insurance_expiry?: string | null
          name?: string
          notes?: string | null
          owner_id?: string
          plate?: string | null
          registration_doc_path?: string | null
          registration_expiry?: string | null
          service_capabilities?: string[]
          status?: string
          updated_at?: string
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          attempts: number
          created_at: string
          delivered_at: string | null
          event_type: string
          id: string
          last_attempted_at: string | null
          last_response_body: string | null
          last_response_status: number | null
          payload: Json
          platform_endpoint_id: string | null
          provider_endpoint_id: string | null
          provider_user_id: string | null
          scope: string
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          event_type: string
          id?: string
          last_attempted_at?: string | null
          last_response_body?: string | null
          last_response_status?: number | null
          payload?: Json
          platform_endpoint_id?: string | null
          provider_endpoint_id?: string | null
          provider_user_id?: string | null
          scope: string
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          event_type?: string
          id?: string
          last_attempted_at?: string | null
          last_response_body?: string | null
          last_response_status?: number | null
          payload?: Json
          platform_endpoint_id?: string | null
          provider_endpoint_id?: string | null
          provider_user_id?: string | null
          scope?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_platform_endpoint_id_fkey"
            columns: ["platform_endpoint_id"]
            isOneToOne: false
            referencedRelation: "platform_webhook_endpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_provider_endpoint_id_fkey"
            columns: ["provider_endpoint_id"]
            isOneToOne: false
            referencedRelation: "provider_webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      zone_manager_assignments: {
        Row: {
          created_at: string
          id: string
          user_id: string
          zone_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          zone_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zone_manager_assignments_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "dispatch_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zone_manager_assignments_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zone_pricing_averages"
            referencedColumns: ["zone_id"]
          },
        ]
      }
    }
    Views: {
      expiring_provider_credentials: {
        Row: {
          company_name: string | null
          days_until_expiry: number | null
          expires_at: string | null
          kind: string | null
          label: string | null
          provider_display_id: string | null
          provider_user_id: string | null
        }
        Relationships: []
      }
      member_directory: {
        Row: {
          city: string | null
          company_name: string | null
          display_id: string | null
          first_name: string | null
          last_name: string | null
          membership_status: string | null
          membership_tier: Database["public"]["Enums"]["membership_tier"] | null
          preferred_zip_codes: string[] | null
          region: string | null
          user_id: string | null
        }
        Insert: {
          city?: string | null
          company_name?: string | null
          display_id?: string | null
          first_name?: string | null
          last_name?: string | null
          membership_status?: string | null
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
          display_id?: string | null
          first_name?: string | null
          last_name?: string | null
          membership_status?: string | null
          membership_tier?:
            | Database["public"]["Enums"]["membership_tier"]
            | null
          preferred_zip_codes?: string[] | null
          region?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      patient_last_provider: {
        Row: {
          dob_key: string | null
          first_key: string | null
          last_key: string | null
          last_trip_at: string | null
          provider_user_id: string | null
        }
        Relationships: []
      }
      provider_rating_summary: {
        Row: {
          avg_cleanliness: number | null
          avg_completed_pickup: number | null
          avg_on_time_arrival: number | null
          avg_on_time_pickup: number | null
          avg_overall: number | null
          avg_professionalism: number | null
          provider_id: string | null
          ratings_count: number | null
        }
        Relationships: []
      }
      trip_financial_ledger: {
        Row: {
          completed_at: string | null
          created_at: string | null
          display_id: string | null
          financial_locked_at: string | null
          gross_cents: number | null
          medicaid_remit_received_at: string | null
          payer_kind: string | null
          payer_label: string | null
          payment_source: string | null
          payment_status: string | null
          payout_eligible_at: string | null
          payout_hold_reasons: string[] | null
          payout_is_medicaid: boolean | null
          payout_released_at: string | null
          payout_status:
            | Database["public"]["Enums"]["trip_payout_status"]
            | null
          platform_fee_cents: number | null
          provider_name: string | null
          provider_payout_cents: number | null
          provider_user_id: string | null
          referral_fee_cents: number | null
          referral_fee_source_user_id: string | null
          referral_source_name: string | null
          trip_id: string | null
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
      zone_pricing_averages: {
        Row: {
          avg_base_pickup: number | null
          avg_minimum_fare: number | null
          avg_per_mile: number | null
          avg_stretcher_addon: number | null
          avg_wait_per_min: number | null
          avg_wheelchair_addon: number | null
          last_updated_at: string | null
          provider_count: number | null
          zone_code: string | null
          zone_id: string | null
          zone_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_trip: { Args: { _trip_id: string }; Returns: undefined }
      admin_grant_free_membership: {
        Args: { _user_id: string }
        Returns: undefined
      }
      admin_user_ids: { Args: never; Returns: string[] }
      can_message: { Args: { _a: string; _b: string }; Returns: boolean }
      can_send_trips: { Args: { _user_id: string }; Returns: boolean }
      decide_trip_quote: {
        Args: { _approve: boolean; _decision_note?: string; _quote_id: string }
        Returns: undefined
      }
      decline_trip: {
        Args: { _reason?: string; _trip_id: string }
        Returns: undefined
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      enqueue_platform_webhook_event: {
        Args: { _event_type: string; _payload?: Json }
        Returns: number
      }
      enqueue_provider_webhook_event: {
        Args: {
          _event_type: string
          _payload?: Json
          _provider_user_id: string
        }
        Returns: number
      }
      ensure_member_display_id: { Args: never; Returns: string }
      escalate_overdue_compliance_reviews: { Args: never; Returns: undefined }
      gen_webhook_secret: { Args: never; Returns: string }
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
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      haversine_miles: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      is_approved_provider: { Args: { _user_id: string }; Returns: boolean }
      is_facility_or_provider: { Args: { _user_id: string }; Returns: boolean }
      is_ops_staff: { Args: { _user_id: string }; Returns: boolean }
      is_thread_participant: {
        Args: { _thread_id: string; _user_id: string }
        Returns: boolean
      }
      list_expiring_provider_credentials: {
        Args: never
        Returns: {
          company_name: string | null
          days_until_expiry: number | null
          expires_at: string | null
          kind: string | null
          label: string | null
          provider_display_id: string | null
          provider_user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "expiring_provider_credentials"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      log_staff_action: {
        Args: {
          _action: string
          _metadata?: Json
          _target_id: string
          _target_kind: string
        }
        Returns: string
      }
      manages_zone: {
        Args: { _user_id: string; _zone_id: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      offer_trip_priority: {
        Args: { _provider_user_id: string; _trip_id: string }
        Returns: undefined
      }
      open_dispatch_thread: { Args: { _zone_id?: string }; Returns: string }
      open_zone_manager_thread: { Args: { _zone_id: string }; Returns: string }
      promote_ride_request_to_trip: {
        Args: { _ride_request_id: string }
        Returns: string
      }
      provider_covers_pickup: {
        Args: {
          _pickup_lat: number
          _pickup_lng: number
          _provider_id: string
          _trip_miles: number
        }
        Returns: boolean
      }
      provider_has_valid_credentials: {
        Args: { _user_id: string }
        Returns: boolean
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      respond_priority_offer: {
        Args: { _accept: boolean; _trip_id: string }
        Returns: undefined
      }
      set_trip_payment_status: {
        Args: {
          _status: Database["public"]["Enums"]["trip_payment_status"]
          _trip_id: string
        }
        Returns: undefined
      }
      start_direct_thread: { Args: { _recipient: string }; Returns: string }
      start_staff_thread: { Args: never; Returns: string }
      submit_feedback_message: {
        Args: { _body: string; _category?: string; _subject: string }
        Returns: string
      }
      submit_trip_quote:
        | {
            Args: { _amount_cents: number; _note?: string; _trip_id: string }
            Returns: string
          }
        | {
            Args: {
              _allow_over_cap?: boolean
              _amount_cents: number
              _note?: string
              _trip_id: string
            }
            Returns: string
          }
      suggest_providers_for_trip: {
        Args: { _trip_id: string }
        Returns: {
          affinity_active: boolean
          affinity_score: number
          area_score: number
          company_name: string
          display_id: string
          fairness_score: number
          fleet_score: number
          price_score: number
          provider_user_id: string
          rating_score: number
          reason: string
          score: number
          vehicle_score: number
        }[]
      }
      verify_course_certificate: {
        Args: { _token: string }
        Returns: {
          cert_number: string
          course_title: string
          expires_at: string
          holder_name: string
          issued_at: string
          valid: boolean
        }[]
      }
      zone_id_for_zip: { Args: { _zip: string }; Returns: string }
    }
    Enums: {
      app_role:
        | "admin"
        | "staff"
        | "requester"
        | "app_manager"
        | "zone_manager"
        | "dispatcher"
      delivery_item_type:
        | "prescription"
        | "lab_sample"
        | "medical_supplies"
        | "equipment"
        | "dme"
        | "other"
      membership_tier: "none" | "free" | "paid"
      payout_account_status:
        | "not_connected"
        | "pending"
        | "active"
        | "restricted"
      service_level:
        | "door_to_door"
        | "bed_to_bed"
        | "curb_to_curb"
        | "driveway_pickup"
      trip_kind: "passenger" | "medical_delivery"
      trip_payment_status:
        | "not_confirmed"
        | "pending"
        | "confirmed"
        | "refunded"
      trip_payout_status: "pending" | "held" | "released" | "canceled"
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
      app_role: [
        "admin",
        "staff",
        "requester",
        "app_manager",
        "zone_manager",
        "dispatcher",
      ],
      delivery_item_type: [
        "prescription",
        "lab_sample",
        "medical_supplies",
        "equipment",
        "dme",
        "other",
      ],
      membership_tier: ["none", "free", "paid"],
      payout_account_status: [
        "not_connected",
        "pending",
        "active",
        "restricted",
      ],
      service_level: [
        "door_to_door",
        "bed_to_bed",
        "curb_to_curb",
        "driveway_pickup",
      ],
      trip_kind: ["passenger", "medical_delivery"],
      trip_payment_status: [
        "not_confirmed",
        "pending",
        "confirmed",
        "refunded",
      ],
      trip_payout_status: ["pending", "held", "released", "canceled"],
    },
  },
} as const
