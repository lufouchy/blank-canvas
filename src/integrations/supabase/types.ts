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
      adjustment_requests: {
        Row: {
          absence_dates: string[] | null
          absence_reason: string | null
          absence_type: Database["public"]["Enums"]["absence_type"] | null
          attachment_url: string | null
          created_at: string
          end_time: string | null
          id: string
          organization_id: string
          reason: string
          record_type: Database["public"]["Enums"]["time_record_type"]
          request_type: string
          requested_time: string
          reviewed_at: string | null
          reviewed_by: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["adjustment_status"]
          user_id: string
        }
        Insert: {
          absence_dates?: string[] | null
          absence_reason?: string | null
          absence_type?: Database["public"]["Enums"]["absence_type"] | null
          attachment_url?: string | null
          created_at?: string
          end_time?: string | null
          id?: string
          organization_id: string
          reason: string
          record_type: Database["public"]["Enums"]["time_record_type"]
          request_type: string
          requested_time: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["adjustment_status"]
          user_id: string
        }
        Update: {
          absence_dates?: string[] | null
          absence_reason?: string | null
          absence_type?: Database["public"]["Enums"]["absence_type"] | null
          attachment_url?: string | null
          created_at?: string
          end_time?: string | null
          id?: string
          organization_id?: string
          reason?: string
          record_type?: Database["public"]["Enums"]["time_record_type"]
          request_type?: string
          requested_time?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["adjustment_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adjustment_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_admins: {
        Row: {
          company_id: string
          cpf: string
          created_at: string
          email: string
          full_name: string
          id: string
          organization_id: string
          position: Database["public"]["Enums"]["admin_position"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company_id: string
          cpf: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          organization_id: string
          position: Database["public"]["Enums"]["admin_position"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string
          cpf?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          organization_id?: string
          position?: Database["public"]["Enums"]["admin_position"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_admins_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_admins_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_branches: {
        Row: {
          address_cep: string | null
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          cnpj: string
          company_id: string
          created_at: string
          financial_email: string | null
          id: string
          organization_id: string
          phone: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address_cep?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          cnpj: string
          company_id: string
          created_at?: string
          financial_email?: string | null
          id?: string
          organization_id: string
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address_cep?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          cnpj?: string
          company_id?: string
          created_at?: string
          financial_email?: string | null
          id?: string
          organization_id?: string
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_branches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_info: {
        Row: {
          address_cep: string | null
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          business_sector: Database["public"]["Enums"]["business_sector"]
          cnpj: string
          created_at: string
          financial_email: string | null
          has_branches: boolean
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          logo_url: string | null
          nome_fantasia: string
          organization_id: string
          phone: string | null
          razao_social: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address_cep?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          business_sector?: Database["public"]["Enums"]["business_sector"]
          cnpj: string
          created_at?: string
          financial_email?: string | null
          has_branches?: boolean
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logo_url?: string | null
          nome_fantasia: string
          organization_id: string
          phone?: string | null
          razao_social: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address_cep?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          business_sector?: Database["public"]["Enums"]["business_sector"]
          cnpj?: string
          created_at?: string
          financial_email?: string | null
          has_branches?: boolean
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logo_url?: string | null
          nome_fantasia?: string
          organization_id?: string
          phone?: string | null
          razao_social?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_info_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          document_type: string
          expires_at: string | null
          file_url: string | null
          id: string
          organization_id: string
          reference_month: string
          signature_data: string | null
          signed_at: string | null
          status: Database["public"]["Enums"]["document_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_type?: string
          expires_at?: string | null
          file_url?: string | null
          id?: string
          organization_id: string
          reference_month: string
          signature_data?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_type?: string
          expires_at?: string | null
          file_url?: string | null
          id?: string
          organization_id?: string
          reference_month?: string
          signature_data?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          city_name: string | null
          created_at: string
          date: string
          id: string
          is_custom: boolean
          name: string
          organization_id: string
          state_code: string | null
          type: string
          updated_at: string
        }
        Insert: {
          city_name?: string | null
          created_at?: string
          date: string
          id?: string
          is_custom?: boolean
          name: string
          organization_id: string
          state_code?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          city_name?: string | null
          created_at?: string
          date?: string
          id?: string
          is_custom?: boolean
          name?: string
          organization_id?: string
          state_code?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "holidays_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hours_balance: {
        Row: {
          balance_minutes: number
          id: string
          last_calculated_at: string
          organization_id: string
          user_id: string
        }
        Insert: {
          balance_minutes?: number
          id?: string
          last_calculated_at?: string
          organization_id: string
          user_id: string
        }
        Update: {
          balance_minutes?: number
          id?: string
          last_calculated_at?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hours_balance_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_settings: {
        Row: {
          address_cep: string | null
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          allowed_radius_meters: number | null
          company_latitude: number | null
          company_longitude: number | null
          created_at: string
          id: string
          location_mode: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          address_cep?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          allowed_radius_meters?: number | null
          company_latitude?: number | null
          company_longitude?: number | null
          created_at?: string
          id?: string
          location_mode?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          address_cep?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          allowed_radius_meters?: number | null
          company_latitude?: number | null
          company_longitude?: number | null
          created_at?: string
          id?: string
          location_mode?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_overtime_decisions: {
        Row: {
          bank_minutes: number | null
          created_at: string
          destination: string
          finalized: boolean | null
          finalized_at: string | null
          finalized_by: string | null
          id: string
          is_edited: boolean | null
          organization_id: string
          overtime_minutes: number
          payment_amount: number | null
          payment_minutes: number | null
          reference_month: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_minutes?: number | null
          created_at?: string
          destination?: string
          finalized?: boolean | null
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          is_edited?: boolean | null
          organization_id: string
          overtime_minutes?: number
          payment_amount?: number | null
          payment_minutes?: number | null
          reference_month: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_minutes?: number | null
          created_at?: string
          destination?: string
          finalized?: boolean | null
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          is_edited?: boolean | null
          organization_id?: string
          overtime_minutes?: number
          payment_amount?: number | null
          payment_minutes?: number | null
          reference_month?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_overtime_decisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          org_code: string | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_code?: string | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_code?: string | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payroll_settings: {
        Row: {
          auto_decision_enabled: boolean | null
          auto_decision_threshold_hours: number | null
          bank_compensation_ratio: number | null
          bank_custom_months: number | null
          bank_daily_limit_hours: number | null
          bank_holiday_multiplier: number | null
          bank_sunday_multiplier: number | null
          bank_validity: Database["public"]["Enums"]["bank_validity"] | null
          created_at: string
          cycle_start_day: number
          id: string
          mixed_bank_days: string[] | null
          mixed_hours_threshold: number | null
          mixed_payment_days: string[] | null
          mixed_rule_type: Database["public"]["Enums"]["mixed_rule_type"] | null
          organization_id: string
          overtime_strategy: Database["public"]["Enums"]["overtime_strategy"]
          payment_holiday_percent: number | null
          payment_saturday_percent: number | null
          payment_sunday_percent: number | null
          payment_weekday_percent: number | null
          schedule_flexibility_mode: string
          tolerance_entry_minutes: number
          tolerance_minutes: number
          updated_at: string
        }
        Insert: {
          auto_decision_enabled?: boolean | null
          auto_decision_threshold_hours?: number | null
          bank_compensation_ratio?: number | null
          bank_custom_months?: number | null
          bank_daily_limit_hours?: number | null
          bank_holiday_multiplier?: number | null
          bank_sunday_multiplier?: number | null
          bank_validity?: Database["public"]["Enums"]["bank_validity"] | null
          created_at?: string
          cycle_start_day?: number
          id?: string
          mixed_bank_days?: string[] | null
          mixed_hours_threshold?: number | null
          mixed_payment_days?: string[] | null
          mixed_rule_type?:
            | Database["public"]["Enums"]["mixed_rule_type"]
            | null
          organization_id: string
          overtime_strategy?: Database["public"]["Enums"]["overtime_strategy"]
          payment_holiday_percent?: number | null
          payment_saturday_percent?: number | null
          payment_sunday_percent?: number | null
          payment_weekday_percent?: number | null
          schedule_flexibility_mode?: string
          tolerance_entry_minutes?: number
          tolerance_minutes?: number
          updated_at?: string
        }
        Update: {
          auto_decision_enabled?: boolean | null
          auto_decision_threshold_hours?: number | null
          bank_compensation_ratio?: number | null
          bank_custom_months?: number | null
          bank_daily_limit_hours?: number | null
          bank_holiday_multiplier?: number | null
          bank_sunday_multiplier?: number | null
          bank_validity?: Database["public"]["Enums"]["bank_validity"] | null
          created_at?: string
          cycle_start_day?: number
          id?: string
          mixed_bank_days?: string[] | null
          mixed_hours_threshold?: number | null
          mixed_payment_days?: string[] | null
          mixed_rule_type?:
            | Database["public"]["Enums"]["mixed_rule_type"]
            | null
          organization_id?: string
          overtime_strategy?: Database["public"]["Enums"]["overtime_strategy"]
          payment_holiday_percent?: number | null
          payment_saturday_percent?: number | null
          payment_sunday_percent?: number | null
          payment_weekday_percent?: number | null
          schedule_flexibility_mode?: string
          tolerance_entry_minutes?: number
          tolerance_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address_cep: string | null
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          allowed_radius_meters: number | null
          avatar_url: string | null
          birth_date: string | null
          branch_id: string | null
          cpf: string | null
          created_at: string
          email: string
          full_name: string
          hire_date: string | null
          id: string
          location_mode: string
          organization_id: string
          phone: string | null
          position: string | null
          sector: string | null
          specification: string | null
          status: string | null
          termination_date: string | null
          updated_at: string
          user_id: string
          work_address_cep: string | null
          work_address_city: string | null
          work_address_complement: string | null
          work_address_neighborhood: string | null
          work_address_number: string | null
          work_address_state: string | null
          work_address_street: string | null
          work_latitude: number | null
          work_location_type: string
          work_longitude: number | null
          work_schedule_id: string | null
        }
        Insert: {
          address_cep?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          allowed_radius_meters?: number | null
          avatar_url?: string | null
          birth_date?: string | null
          branch_id?: string | null
          cpf?: string | null
          created_at?: string
          email: string
          full_name: string
          hire_date?: string | null
          id?: string
          location_mode?: string
          organization_id: string
          phone?: string | null
          position?: string | null
          sector?: string | null
          specification?: string | null
          status?: string | null
          termination_date?: string | null
          updated_at?: string
          user_id: string
          work_address_cep?: string | null
          work_address_city?: string | null
          work_address_complement?: string | null
          work_address_neighborhood?: string | null
          work_address_number?: string | null
          work_address_state?: string | null
          work_address_street?: string | null
          work_latitude?: number | null
          work_location_type?: string
          work_longitude?: number | null
          work_schedule_id?: string | null
        }
        Update: {
          address_cep?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          allowed_radius_meters?: number | null
          avatar_url?: string | null
          birth_date?: string | null
          branch_id?: string | null
          cpf?: string | null
          created_at?: string
          email?: string
          full_name?: string
          hire_date?: string | null
          id?: string
          location_mode?: string
          organization_id?: string
          phone?: string | null
          position?: string | null
          sector?: string | null
          specification?: string | null
          status?: string | null
          termination_date?: string | null
          updated_at?: string
          user_id?: string
          work_address_cep?: string | null
          work_address_city?: string | null
          work_address_complement?: string | null
          work_address_neighborhood?: string | null
          work_address_number?: string | null
          work_address_state?: string | null
          work_address_street?: string | null
          work_latitude?: number | null
          work_location_type?: string
          work_longitude?: number | null
          work_schedule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_work_schedule_id_fkey"
            columns: ["work_schedule_id"]
            isOneToOne: false
            referencedRelation: "work_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_adjustments: {
        Row: {
          adjustment_type: string
          created_at: string
          created_by: string
          custom_break_end: string | null
          custom_break_start: string | null
          custom_end_time: string | null
          custom_start_time: string | null
          end_date: string
          id: string
          organization_id: string
          overtime_authorized: boolean
          overtime_max_minutes: number | null
          reason: string | null
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          adjustment_type?: string
          created_at?: string
          created_by: string
          custom_break_end?: string | null
          custom_break_start?: string | null
          custom_end_time?: string | null
          custom_start_time?: string | null
          end_date: string
          id?: string
          organization_id: string
          overtime_authorized?: boolean
          overtime_max_minutes?: number | null
          reason?: string | null
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          adjustment_type?: string
          created_at?: string
          created_by?: string
          custom_break_end?: string | null
          custom_break_start?: string | null
          custom_end_time?: string | null
          custom_start_time?: string | null
          end_date?: string
          id?: string
          organization_id?: string
          overtime_authorized?: boolean
          overtime_max_minutes?: number | null
          reason?: string | null
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_adjustments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_specification: string | null
          new_status: string | null
          organization_id: string
          previous_specification: string | null
          previous_status: string | null
          reason: string | null
          user_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_specification?: string | null
          new_status?: string | null
          organization_id: string
          previous_specification?: string | null
          previous_status?: string | null
          reason?: string | null
          user_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_specification?: string | null
          new_status?: string | null
          organization_id?: string
          previous_specification?: string | null
          previous_status?: string | null
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      time_records: {
        Row: {
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          organization_id: string
          record_type: Database["public"]["Enums"]["time_record_type"]
          recorded_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          organization_id: string
          record_type: Database["public"]["Enums"]["time_record_type"]
          recorded_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          organization_id?: string
          record_type?: Database["public"]["Enums"]["time_record_type"]
          recorded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vacation_requests: {
        Row: {
          created_at: string
          created_by: string
          days_count: number
          end_date: string
          id: string
          is_admin_created: boolean
          organization_id: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sell_days: number | null
          start_date: string
          status: Database["public"]["Enums"]["adjustment_status"]
          updated_at: string
          user_id: string
          vacation_type: Database["public"]["Enums"]["vacation_type"]
        }
        Insert: {
          created_at?: string
          created_by: string
          days_count: number
          end_date: string
          id?: string
          is_admin_created?: boolean
          organization_id: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sell_days?: number | null
          start_date: string
          status?: Database["public"]["Enums"]["adjustment_status"]
          updated_at?: string
          user_id: string
          vacation_type?: Database["public"]["Enums"]["vacation_type"]
        }
        Update: {
          created_at?: string
          created_by?: string
          days_count?: number
          end_date?: string
          id?: string
          is_admin_created?: boolean
          organization_id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sell_days?: number | null
          start_date?: string
          status?: Database["public"]["Enums"]["adjustment_status"]
          updated_at?: string
          user_id?: string
          vacation_type?: Database["public"]["Enums"]["vacation_type"]
        }
        Relationships: [
          {
            foreignKeyName: "vacation_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      work_schedules: {
        Row: {
          break_duration_minutes: number | null
          break_end_time: string | null
          break_start_time: string | null
          created_at: string
          end_time: string
          friday_hours: number | null
          id: string
          monday_hours: number | null
          name: string
          organization_id: string
          saturday_hours: number | null
          schedule_type: string
          shift_rest_hours: number | null
          shift_work_hours: number | null
          start_time: string
          sunday_hours: number | null
          thursday_hours: number | null
          tuesday_hours: number | null
          wednesday_hours: number | null
        }
        Insert: {
          break_duration_minutes?: number | null
          break_end_time?: string | null
          break_start_time?: string | null
          created_at?: string
          end_time?: string
          friday_hours?: number | null
          id?: string
          monday_hours?: number | null
          name: string
          organization_id: string
          saturday_hours?: number | null
          schedule_type?: string
          shift_rest_hours?: number | null
          shift_work_hours?: number | null
          start_time?: string
          sunday_hours?: number | null
          thursday_hours?: number | null
          tuesday_hours?: number | null
          wednesday_hours?: number | null
        }
        Update: {
          break_duration_minutes?: number | null
          break_end_time?: string | null
          break_start_time?: string | null
          created_at?: string
          end_time?: string
          friday_hours?: number | null
          id?: string
          monday_hours?: number | null
          name?: string
          organization_id?: string
          saturday_hours?: number | null
          schedule_type?: string
          shift_rest_hours?: number | null
          shift_work_hours?: number | null
          start_time?: string
          sunday_hours?: number | null
          thursday_hours?: number | null
          tuesday_hours?: number | null
          wednesday_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "work_schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      absence_type:
        | "vacation"
        | "medical_consultation"
        | "medical_leave"
        | "justified_absence"
        | "bereavement_leave"
        | "maternity_leave"
        | "paternity_leave"
        | "unjustified_absence"
        | "work_accident"
        | "punitive_suspension"
        | "day_off"
      adjustment_status: "pending" | "approved" | "rejected"
      admin_position:
        | "rh"
        | "dono"
        | "gerente"
        | "diretor"
        | "coordenador"
        | "socio"
        | "outro"
      app_role: "admin" | "employee" | "suporte"
      bank_validity: "3_months" | "6_months" | "1_year" | "custom"
      business_sector:
        | "tecnologia"
        | "varejo"
        | "industria"
        | "servicos"
        | "saude"
        | "educacao"
        | "financeiro"
        | "construcao"
        | "agronegocio"
        | "logistica"
        | "alimentacao"
        | "outro"
      document_status: "pending_signature" | "signed" | "expired"
      mixed_rule_type: "hours_threshold" | "day_type"
      overtime_strategy: "bank" | "payment" | "mixed"
      time_record_type: "entry" | "lunch_out" | "lunch_in" | "exit"
      vacation_type: "individual" | "collective"
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
      absence_type: [
        "vacation",
        "medical_consultation",
        "medical_leave",
        "justified_absence",
        "bereavement_leave",
        "maternity_leave",
        "paternity_leave",
        "unjustified_absence",
        "work_accident",
        "punitive_suspension",
        "day_off",
      ],
      adjustment_status: ["pending", "approved", "rejected"],
      admin_position: [
        "rh",
        "dono",
        "gerente",
        "diretor",
        "coordenador",
        "socio",
        "outro",
      ],
      app_role: ["admin", "employee", "suporte"],
      bank_validity: ["3_months", "6_months", "1_year", "custom"],
      business_sector: [
        "tecnologia",
        "varejo",
        "industria",
        "servicos",
        "saude",
        "educacao",
        "financeiro",
        "construcao",
        "agronegocio",
        "logistica",
        "alimentacao",
        "outro",
      ],
      document_status: ["pending_signature", "signed", "expired"],
      mixed_rule_type: ["hours_threshold", "day_type"],
      overtime_strategy: ["bank", "payment", "mixed"],
      time_record_type: ["entry", "lunch_out", "lunch_in", "exit"],
      vacation_type: ["individual", "collective"],
    },
  },
} as const
