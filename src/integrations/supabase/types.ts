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
    PostgrestVersion: "12.2.3"
  }
  public: {
    Tables: {
      academy_content: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          external_url: string | null
          file_label: string | null
          file_url: string | null
          format: string | null
          id: string
          is_new: boolean
          is_published: boolean
          kind: string
          owner_only: boolean
          prompt_text: string | null
          slug: string | null
          sort_order: number
          stage: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          external_url?: string | null
          file_label?: string | null
          file_url?: string | null
          format?: string | null
          id?: string
          is_new?: boolean
          is_published?: boolean
          kind: string
          owner_only?: boolean
          prompt_text?: string | null
          slug?: string | null
          sort_order?: number
          stage?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          external_url?: string | null
          file_label?: string | null
          file_url?: string | null
          format?: string | null
          id?: string
          is_new?: boolean
          is_published?: boolean
          kind?: string
          owner_only?: boolean
          prompt_text?: string | null
          slug?: string | null
          sort_order?: number
          stage?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      academy_notify_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          item_id: string
          item_title: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          item_id: string
          item_title?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          item_id?: string
          item_title?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      account_admins: {
        Row: {
          accepted_at: string | null
          admin_email: string
          admin_name: string | null
          admin_phone: string | null
          created_at: string
          id: string
          invited_at: string
          notify_assigned_chats: boolean
          notify_assigned_tickets: boolean
          owner_email: string
          permissions: Json
          restrict_assigned_chats: boolean
          restrict_assigned_tickets: boolean
          status: string
          support_email_alerts: Json
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          admin_email: string
          admin_name?: string | null
          admin_phone?: string | null
          created_at?: string
          id?: string
          invited_at?: string
          notify_assigned_chats?: boolean
          notify_assigned_tickets?: boolean
          owner_email: string
          permissions?: Json
          restrict_assigned_chats?: boolean
          restrict_assigned_tickets?: boolean
          status?: string
          support_email_alerts?: Json
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          admin_email?: string
          admin_name?: string | null
          admin_phone?: string | null
          created_at?: string
          id?: string
          invited_at?: string
          notify_assigned_chats?: boolean
          notify_assigned_tickets?: boolean
          owner_email?: string
          permissions?: Json
          restrict_assigned_chats?: boolean
          restrict_assigned_tickets?: boolean
          status?: string
          support_email_alerts?: Json
          updated_at?: string
        }
        Relationships: []
      }
      admin_list_members: {
        Row: {
          added_at: string
          id: string
          list_id: string
          user_email: string
        }
        Insert: {
          added_at?: string
          id?: string
          list_id: string
          user_email: string
        }
        Update: {
          added_at?: string
          id?: string
          list_id?: string
          user_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_list_members_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "admin_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_lists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      affiliate_billing_overrides: {
        Row: {
          created_at: string
          referred_email: string
          stripe_customer_id: string | null
          stripe_email: string | null
        }
        Insert: {
          created_at?: string
          referred_email: string
          stripe_customer_id?: string | null
          stripe_email?: string | null
        }
        Update: {
          created_at?: string
          referred_email?: string
          stripe_customer_id?: string | null
          stripe_email?: string | null
        }
        Relationships: []
      }
      affiliate_commissions: {
        Row: {
          affiliate_id: string
          amount: number
          amount_refunded: number
          commission_rate: number
          created_at: string
          id: string
          notes: string | null
          paid_at: string | null
          period_index: number
          period_start: string
          plan: string
          plan_amount: number
          referral_id: string
          referred_email: string
          status: string
          stripe_invoice_id: string | null
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          amount?: number
          amount_refunded?: number
          commission_rate?: number
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_index: number
          period_start: string
          plan: string
          plan_amount?: number
          referral_id: string
          referred_email: string
          status?: string
          stripe_invoice_id?: string | null
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          amount?: number
          amount_refunded?: number
          commission_rate?: number
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_index?: number
          period_start?: string
          plan?: string
          plan_amount?: number
          referral_id?: string
          referred_email?: string
          status?: string
          stripe_invoice_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commissions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "affiliate_referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_events: {
        Row: {
          affiliate_id: string
          created_at: string
          event_type: string
          id: string
          ip_hash: string | null
          metadata: Json | null
          page: string
          referrer_url: string | null
          user_agent: string | null
        }
        Insert: {
          affiliate_id: string
          created_at?: string
          event_type: string
          id?: string
          ip_hash?: string | null
          metadata?: Json | null
          page: string
          referrer_url?: string | null
          user_agent?: string | null
        }
        Update: {
          affiliate_id?: string
          created_at?: string
          event_type?: string
          id?: string
          ip_hash?: string | null
          metadata?: Json | null
          page?: string
          referrer_url?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_events_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_page_attributions: {
        Row: {
          affiliate_id: string
          created_at: string
          ends_at: string | null
          funnel_key: string | null
          id: string
          label: string | null
          page_path: string
          starts_at: string
        }
        Insert: {
          affiliate_id: string
          created_at?: string
          ends_at?: string | null
          funnel_key?: string | null
          id?: string
          label?: string | null
          page_path: string
          starts_at?: string
        }
        Update: {
          affiliate_id?: string
          created_at?: string
          ends_at?: string | null
          funnel_key?: string | null
          id?: string
          label?: string | null
          page_path?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_page_attributions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_payouts: {
        Row: {
          affiliate_id: string
          amount: number
          created_at: string
          id: string
          notes: string | null
          paid_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_payouts_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_portal_cache: {
        Row: {
          affiliate_id: string
          payload: Json
          refreshed_at: string
        }
        Insert: {
          affiliate_id: string
          payload: Json
          refreshed_at?: string
        }
        Update: {
          affiliate_id?: string
          payload?: Json
          refreshed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_portal_cache_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: true
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_portal_cache_cron_auth: {
        Row: {
          id: number
          secret: string
        }
        Insert: {
          id: number
          secret: string
        }
        Update: {
          id?: number
          secret?: string
        }
        Relationships: []
      }
      affiliate_referrals: {
        Row: {
          affiliate_id: string
          commission_rate: number
          created_at: string
          id: string
          plan: string | null
          referred_email: string
          referred_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          commission_rate?: number
          created_at?: string
          id?: string
          plan?: string | null
          referred_email: string
          referred_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          commission_rate?: number
          created_at?: string
          id?: string
          plan?: string | null
          referred_email?: string
          referred_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_referrals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          affiliate_slug: string | null
          audience_description: string | null
          commission_rate: number
          company: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          network_size: string
          payout_method: Json | null
          status: string | null
          updated_at: string
          user_email_linked: string | null
        }
        Insert: {
          affiliate_slug?: string | null
          audience_description?: string | null
          commission_rate?: number
          company?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          network_size: string
          payout_method?: Json | null
          status?: string | null
          updated_at?: string
          user_email_linked?: string | null
        }
        Update: {
          affiliate_slug?: string | null
          audience_description?: string | null
          commission_rate?: number
          company?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          network_size?: string
          payout_method?: Json | null
          status?: string | null
          updated_at?: string
          user_email_linked?: string | null
        }
        Relationships: []
      }
      agency_api_keys: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          label: string
          last_used_at: string | null
          owner_email: string
          revoked_at: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          label?: string
          last_used_at?: string | null
          owner_email: string
          revoked_at?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          label?: string
          last_used_at?: string | null
          owner_email?: string
          revoked_at?: string | null
        }
        Relationships: []
      }
      agency_category_settings: {
        Row: {
          agency_id: string
          category_key: string
          created_at: string
          display_name: string | null
          id: string
          sort_order: number
          tier: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          category_key: string
          created_at?: string
          display_name?: string | null
          id?: string
          sort_order?: number
          tier: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          category_key?: string
          created_at?: string
          display_name?: string | null
          id?: string
          sort_order?: number
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      agency_daily_checklist: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          item_1: string | null
          item_2: string | null
          item_3: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          item_1?: string | null
          item_2?: string | null
          item_3?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          item_1?: string | null
          item_2?: string | null
          item_3?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      agency_guest_counter: {
        Row: {
          agency_id: string
          created_at: string
          guest_count: number
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          guest_count?: number
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          guest_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      agency_id_migrations: {
        Row: {
          created_at: string
          id: string
          moved: Json
          new_agency_id: string
          old_agency_id: string
          source: string | null
          user_email: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          moved?: Json
          new_agency_id: string
          old_agency_id: string
          source?: string | null
          user_email?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          moved?: Json
          new_agency_id?: string
          old_agency_id?: string
          source?: string | null
          user_email?: string | null
        }
        Relationships: []
      }
      agency_join_requests: {
        Row: {
          created_at: string
          id: string
          owner_email: string
          requester_email: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_email: string
          requester_email: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_email?: string
          requester_email?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      agency_menu_config: {
        Row: {
          agency_id: string
          auto_navigate_on_login: boolean
          created_at: string
          hidden_menu_items: Json | null
          id: string
          menu_link_id: string | null
          menu_link_id_2: string | null
          remove_launchpad: boolean
          updated_at: string
        }
        Insert: {
          agency_id: string
          auto_navigate_on_login?: boolean
          created_at?: string
          hidden_menu_items?: Json | null
          id?: string
          menu_link_id?: string | null
          menu_link_id_2?: string | null
          remove_launchpad?: boolean
          updated_at?: string
        }
        Update: {
          agency_id?: string
          auto_navigate_on_login?: boolean
          created_at?: string
          hidden_menu_items?: Json | null
          id?: string
          menu_link_id?: string | null
          menu_link_id_2?: string | null
          remove_launchpad?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      agency_module_name_overrides: {
        Row: {
          agency_id: string
          category_id: string
          created_at: string
          display_name: string
          id: string
          module_id: string
          tier: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          category_id: string
          created_at?: string
          display_name: string
          id?: string
          module_id: string
          tier: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          category_id?: string
          created_at?: string
          display_name?: string
          id?: string
          module_id?: string
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      agency_onboarding_checklist: {
        Row: {
          agency_id: string
          created_at: string
          description: string | null
          id: string
          item_order: number
          link_to: string | null
          link_url: string | null
          linked_video: string | null
          title: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          description?: string | null
          id?: string
          item_order?: number
          link_to?: string | null
          link_url?: string | null
          linked_video?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          description?: string | null
          id?: string
          item_order?: number
          link_to?: string | null
          link_url?: string | null
          linked_video?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      agency_owner_messages: {
        Row: {
          agency_id: string
          content: string
          created_at: string
          id: string
          sender_email: string | null
          sender_name: string | null
          sender_type: string
          user_identifier: string
        }
        Insert: {
          agency_id: string
          content: string
          created_at?: string
          id?: string
          sender_email?: string | null
          sender_name?: string | null
          sender_type?: string
          user_identifier: string
        }
        Update: {
          agency_id?: string
          content?: string
          created_at?: string
          id?: string
          sender_email?: string | null
          sender_name?: string | null
          sender_type?: string
          user_identifier?: string
        }
        Relationships: []
      }
      agency_project_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          project_id: string
          sender_email: string | null
          sender_name: string | null
          sender_role: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          project_id: string
          sender_email?: string | null
          sender_name?: string | null
          sender_role?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          project_id?: string
          sender_email?: string | null
          sender_name?: string | null
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_project_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "agency_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_projects: {
        Row: {
          agency_id: string | null
          client_company: string | null
          client_email: string | null
          client_name: string | null
          created_at: string
          created_by: string | null
          details: string | null
          due_date: string | null
          id: string
          location_id: string | null
          owner_email: string
          position: number
          priority: string
          stage: string
          title: string
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          client_company?: string | null
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          details?: string | null
          due_date?: string | null
          id?: string
          location_id?: string | null
          owner_email: string
          position?: number
          priority?: string
          stage?: string
          title: string
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          client_company?: string | null
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          details?: string | null
          due_date?: string | null
          id?: string
          location_id?: string | null
          owner_email?: string
          position?: number
          priority?: string
          stage?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      agency_support_clients: {
        Row: {
          active: boolean
          agency_id: string | null
          assigned_at: string | null
          client_company: string | null
          client_email: string
          client_name: string | null
          client_phone: string | null
          created_at: string
          id: string
          location_id: string | null
          locked_until: string | null
          owner_email: string
          source: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          agency_id?: string | null
          assigned_at?: string | null
          client_company?: string | null
          client_email: string
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          id?: string
          location_id?: string | null
          locked_until?: string | null
          owner_email: string
          source?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          agency_id?: string | null
          assigned_at?: string | null
          client_company?: string | null
          client_email?: string
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          id?: string
          location_id?: string | null
          locked_until?: string | null
          owner_email?: string
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      agency_support_messages: {
        Row: {
          agency_id: string | null
          attachment_url: string | null
          body: string
          client_email: string
          created_at: string
          id: string
          sender_name: string | null
          sender_role: string
        }
        Insert: {
          agency_id?: string | null
          attachment_url?: string | null
          body: string
          client_email: string
          created_at?: string
          id?: string
          sender_name?: string | null
          sender_role: string
        }
        Update: {
          agency_id?: string | null
          attachment_url?: string | null
          body?: string
          client_email?: string
          created_at?: string
          id?: string
          sender_name?: string | null
          sender_role?: string
        }
        Relationships: []
      }
      agency_ticket_categories: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          is_hidden: boolean
          label: string
          owner_email: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          is_hidden?: boolean
          label: string
          owner_email: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          is_hidden?: boolean
          label?: string
          owner_email?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      agency_training_seed_jobs: {
        Row: {
          agency_id: string
          attempts: number
          created_at: string
          last_error: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          attempts?: number
          created_at?: string
          last_error?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          attempts?: number
          created_at?: string
          last_error?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      agency_ui_versions: {
        Row: {
          agency_id: string
          ui_version: number
          updated_at: string
        }
        Insert: {
          agency_id: string
          ui_version?: number
          updated_at?: string
        }
        Update: {
          agency_id?: string
          ui_version?: number
          updated_at?: string
        }
        Relationships: []
      }
      agency_video_settings: {
        Row: {
          agency_id: string
          category_id: string
          created_at: string
          id: string
          is_visible: boolean
          module_id: string
          sort_order: number
          tier: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          category_id: string
          created_at?: string
          id?: string
          is_visible?: boolean
          module_id: string
          sort_order?: number
          tier: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          category_id?: string
          created_at?: string
          id?: string
          is_visible?: boolean
          module_id?: string
          sort_order?: number
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_chat_failures: {
        Row: {
          agency_id: string | null
          created_at: string
          detail: string | null
          id: string
          stage: string
          status: number | null
          user_identifier: string | null
        }
        Insert: {
          agency_id?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          stage: string
          status?: number | null
          user_identifier?: string | null
        }
        Update: {
          agency_id?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          stage?: string
          status?: number | null
          user_identifier?: string | null
        }
        Relationships: []
      }
      ai_chat_messages: {
        Row: {
          agency_id: string
          content: string
          created_at: string
          id: string
          role: string
          user_identifier: string
        }
        Insert: {
          agency_id: string
          content: string
          created_at?: string
          id?: string
          role: string
          user_identifier: string
        }
        Update: {
          agency_id?: string
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_identifier?: string
        }
        Relationships: []
      }
      ai_chat_rate_limits: {
        Row: {
          agency_id: string | null
          created_at: string
          id: string
          request_count: number
          updated_at: string
          user_identifier: string
          window_start: string
        }
        Insert: {
          agency_id?: string | null
          created_at?: string
          id?: string
          request_count?: number
          updated_at?: string
          user_identifier: string
          window_start?: string
        }
        Update: {
          agency_id?: string | null
          created_at?: string
          id?: string
          request_count?: number
          updated_at?: string
          user_identifier?: string
          window_start?: string
        }
        Relationships: []
      }
      ai_support_feedback: {
        Row: {
          agency_id: string
          ai_suggested_prompt_changes: string | null
          created_at: string
          feedback_text: string | null
          id: string
          positive_tags: string[] | null
          rating: string
          recent_messages: Json | null
          user_email: string | null
          user_identifier: string
          user_name: string | null
          webhook_sent: boolean
          webhook_sent_at: string | null
        }
        Insert: {
          agency_id: string
          ai_suggested_prompt_changes?: string | null
          created_at?: string
          feedback_text?: string | null
          id?: string
          positive_tags?: string[] | null
          rating: string
          recent_messages?: Json | null
          user_email?: string | null
          user_identifier: string
          user_name?: string | null
          webhook_sent?: boolean
          webhook_sent_at?: string | null
        }
        Update: {
          agency_id?: string
          ai_suggested_prompt_changes?: string | null
          created_at?: string
          feedback_text?: string | null
          id?: string
          positive_tags?: string[] | null
          rating?: string
          recent_messages?: Json | null
          user_email?: string | null
          user_identifier?: string
          user_name?: string | null
          webhook_sent?: boolean
          webhook_sent_at?: string | null
        }
        Relationships: []
      }
      ai_support_kb: {
        Row: {
          active: boolean
          answer: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          question: string
          source_agency_id: string | null
          source_message_id: string | null
          source_user_identifier: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          answer: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          question: string
          source_agency_id?: string | null
          source_message_id?: string | null
          source_user_identifier?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          answer?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          question?: string
          source_agency_id?: string | null
          source_message_id?: string | null
          source_user_identifier?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_support_message_ratings: {
        Row: {
          agency_id: string
          answer_text: string | null
          created_at: string
          id: string
          kb_entry_id: string | null
          message_id: string
          question_text: string | null
          rated_by: string | null
          rating: string
          user_identifier: string | null
        }
        Insert: {
          agency_id: string
          answer_text?: string | null
          created_at?: string
          id?: string
          kb_entry_id?: string | null
          message_id: string
          question_text?: string | null
          rated_by?: string | null
          rating: string
          user_identifier?: string | null
        }
        Update: {
          agency_id?: string
          answer_text?: string | null
          created_at?: string
          id?: string
          kb_entry_id?: string | null
          message_id?: string
          question_text?: string | null
          rated_by?: string | null
          rating?: string
          user_identifier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_support_message_ratings_kb_entry_id_fkey"
            columns: ["kb_entry_id"]
            isOneToOne: false
            referencedRelation: "ai_support_kb"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_webinar_registrations: {
        Row: {
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string | null
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string | null
        }
        Relationships: []
      }
      approval_changes_audit: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_approval: string | null
          old_approval: string | null
          source: string | null
          user_email: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_approval?: string | null
          old_approval?: string | null
          source?: string | null
          user_email: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_approval?: string | null
          old_approval?: string | null
          source?: string | null
          user_email?: string
        }
        Relationships: []
      }
      auth_account_attempts: {
        Row: {
          bucket: string
          created_at: string
          email_hash: string
          id: number
          ip_hash: string
        }
        Insert: {
          bucket: string
          created_at?: string
          email_hash: string
          id?: never
          ip_hash: string
        }
        Update: {
          bucket?: string
          created_at?: string
          email_hash?: string
          id?: never
          ip_hash?: string
        }
        Relationships: []
      }
      auth_password_codes: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          email: string
          expires_at: string
          id: string
          ip_hash: string | null
          salt: string
          used_at: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          ip_hash?: string | null
          salt: string
          used_at?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          ip_hash?: string | null
          salt?: string
          used_at?: string | null
        }
        Relationships: []
      }
      auth_signup_failures: {
        Row: {
          created_at: string
          email: string | null
          error_message: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          error_message?: string | null
          id?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          error_message?: string | null
          id?: string
        }
        Relationships: []
      }
      banned_users: {
        Row: {
          agency_id: string
          banned_by: string
          created_at: string
          id: string
          reason: string | null
          user_identifier: string
        }
        Insert: {
          agency_id: string
          banned_by?: string
          created_at?: string
          id?: string
          reason?: string | null
          user_identifier: string
        }
        Update: {
          agency_id?: string
          banned_by?: string
          created_at?: string
          id?: string
          reason?: string | null
          user_identifier?: string
        }
        Relationships: []
      }
      billing_delinquency_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          email: string
          id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          email: string
          id?: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_avatar_url: string | null
          author_bio: string | null
          author_name: string
          body_markdown: string
          canonical_url: string | null
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          faq: Json
          howto_steps: Json
          id: string
          meta_description: string | null
          meta_title: string | null
          published: boolean
          published_at: string | null
          reading_minutes: number | null
          scheduled_publish_at: string | null
          slug: string
          tags: string[]
          title: string
          tldr: string | null
          updated_at: string
          view_count: number
        }
        Insert: {
          author_avatar_url?: string | null
          author_bio?: string | null
          author_name?: string
          body_markdown?: string
          canonical_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          faq?: Json
          howto_steps?: Json
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          published?: boolean
          published_at?: string | null
          reading_minutes?: number | null
          scheduled_publish_at?: string | null
          slug: string
          tags?: string[]
          title: string
          tldr?: string | null
          updated_at?: string
          view_count?: number
        }
        Update: {
          author_avatar_url?: string | null
          author_bio?: string | null
          author_name?: string
          body_markdown?: string
          canonical_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          faq?: Json
          howto_steps?: Json
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          published?: boolean
          published_at?: string | null
          reading_minutes?: number | null
          scheduled_publish_at?: string | null
          slug?: string
          tags?: string[]
          title?: string
          tldr?: string | null
          updated_at?: string
          view_count?: number
        }
        Relationships: []
      }
      bump_offers: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          percent_off: number
          plan: string
          promo_code: string
          redeemed: boolean
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          percent_off?: number
          plan: string
          promo_code: string
          redeemed?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          percent_off?: number
          plan?: string
          promo_code?: string
          redeemed?: boolean
        }
        Relationships: []
      }
      challenge_point_reviews: {
        Row: {
          completion_ids: string[]
          created_at: string
          ended_at: string
          entry_id: string
          id: string
          module_ids: string[]
          reason: string
          reviewed_at: string
          started_at: string
          updated_at: string
          user_id: string
          user_name: string
        }
        Insert: {
          completion_ids: string[]
          created_at?: string
          ended_at: string
          entry_id: string
          id?: string
          module_ids: string[]
          reason: string
          reviewed_at?: string
          started_at: string
          updated_at?: string
          user_id: string
          user_name: string
        }
        Update: {
          completion_ids?: string[]
          created_at?: string
          ended_at?: string
          entry_id?: string
          id?: string
          module_ids?: string[]
          reason?: string
          reviewed_at?: string
          started_at?: string
          updated_at?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_point_reviews_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "giveaway_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          agency_id: string
          assigned_at: string | null
          assigned_to_email: string | null
          assigned_to_name: string | null
          category: string
          category_source: string
          created_at: string
          handover_notification_count: number
          handover_requested_at: string | null
          handover_resolved_at: string | null
          id: string
          last_assistant_message_at: string | null
          last_handover_notified_at: string | null
          last_owner_message_at: string | null
          last_user_message_at: string | null
          message_count: number
          updated_at: string
          user_identifier: string
        }
        Insert: {
          agency_id: string
          assigned_at?: string | null
          assigned_to_email?: string | null
          assigned_to_name?: string | null
          category?: string
          category_source?: string
          created_at?: string
          handover_notification_count?: number
          handover_requested_at?: string | null
          handover_resolved_at?: string | null
          id?: string
          last_assistant_message_at?: string | null
          last_handover_notified_at?: string | null
          last_owner_message_at?: string | null
          last_user_message_at?: string | null
          message_count?: number
          updated_at?: string
          user_identifier: string
        }
        Update: {
          agency_id?: string
          assigned_at?: string | null
          assigned_to_email?: string | null
          assigned_to_name?: string | null
          category?: string
          category_source?: string
          created_at?: string
          handover_notification_count?: number
          handover_requested_at?: string | null
          handover_resolved_at?: string | null
          id?: string
          last_assistant_message_at?: string | null
          last_handover_notified_at?: string | null
          last_owner_message_at?: string | null
          last_user_message_at?: string | null
          message_count?: number
          updated_at?: string
          user_identifier?: string
        }
        Relationships: []
      }
      checkout_sessions: {
        Row: {
          amount_cents: number | null
          billing_interval: string | null
          button: string | null
          completed_at: string | null
          created_at: string
          currency: string | null
          email: string | null
          flow: string | null
          is_test: boolean
          metadata: Json
          page: string | null
          plan: string | null
          status: string
          stripe_checkout_session_id: string
          surface: string | null
          updated_at: string
        }
        Insert: {
          amount_cents?: number | null
          billing_interval?: string | null
          button?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          flow?: string | null
          is_test?: boolean
          metadata?: Json
          page?: string | null
          plan?: string | null
          status?: string
          stripe_checkout_session_id: string
          surface?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number | null
          billing_interval?: string | null
          button?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          flow?: string | null
          is_test?: boolean
          metadata?: Json
          page?: string | null
          plan?: string | null
          status?: string
          stripe_checkout_session_id?: string
          surface?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      client_error_logs: {
        Row: {
          created_at: string
          id: string
          message: string | null
          page_path: string | null
          source: string | null
          title: string | null
          user_agent: string | null
          user_email: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          page_path?: string | null
          source?: string | null
          title?: string | null
          user_agent?: string | null
          user_email?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          page_path?: string | null
          source?: string | null
          title?: string | null
          user_agent?: string | null
          user_email?: string | null
        }
        Relationships: []
      }
      community_academy_progress: {
        Row: {
          completed_at: string
          created_at: string
          id: string
          item_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          created_at?: string
          id?: string
          item_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          id?: string
          item_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      community_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          edited_at: string | null
          id: string
          is_answer: boolean
          media_height: number | null
          media_type: string | null
          media_url: string | null
          media_width: number | null
          parent_comment_id: string | null
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_answer?: boolean
          media_height?: number | null
          media_type?: string | null
          media_url?: string | null
          media_width?: number | null
          parent_comment_id?: string | null
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_answer?: boolean
          media_height?: number | null
          media_type?: string | null
          media_url?: string | null
          media_width?: number | null
          parent_comment_id?: string | null
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "community_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_courses: {
        Row: {
          created_at: string
          description: string | null
          id: string
          min_tier: Database["public"]["Enums"]["community_tier"]
          sort_order: number
          thumbnail_url: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          min_tier?: Database["public"]["Enums"]["community_tier"]
          sort_order?: number
          thumbnail_url?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          min_tier?: Database["public"]["Enums"]["community_tier"]
          sort_order?: number
          thumbnail_url?: string | null
          title?: string
        }
        Relationships: []
      }
      community_lesson_progress: {
        Row: {
          completed_at: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "community_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      community_lessons: {
        Row: {
          body: string | null
          course_id: string
          created_at: string
          duration_minutes: number | null
          id: string
          sort_order: number
          title: string
          video_url: string | null
        }
        Insert: {
          body?: string | null
          course_id: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          sort_order?: number
          title: string
          video_url?: string | null
        }
        Update: {
          body?: string | null
          course_id?: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          sort_order?: number
          title?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "community_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          author_id: string
          body: string
          category: string
          comment_count: number
          created_at: string
          edited_at: string | null
          id: string
          is_answered: boolean
          is_pinned: boolean
          media_height: number | null
          media_type: string | null
          media_url: string | null
          media_width: number | null
          reaction_count: number
          space_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          category?: string
          comment_count?: number
          created_at?: string
          edited_at?: string | null
          id?: string
          is_answered?: boolean
          is_pinned?: boolean
          media_height?: number | null
          media_type?: string | null
          media_url?: string | null
          media_width?: number | null
          reaction_count?: number
          space_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          category?: string
          comment_count?: number
          created_at?: string
          edited_at?: string | null
          id?: string
          is_answered?: boolean
          is_pinned?: boolean
          media_height?: number | null
          media_type?: string | null
          media_url?: string | null
          media_width?: number | null
          reaction_count?: number
          space_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "community_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "community_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      community_profiles: {
        Row: {
          active_subaccounts: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          email: string | null
          handle: string | null
          highlevel_experience: string | null
          id: string
          is_verified: boolean
          joined_at: string | null
          post_count: number
          role: Database["public"]["Enums"]["community_role"]
          show_account_count: boolean
          tier: Database["public"]["Enums"]["community_tier"]
          updated_at: string
        }
        Insert: {
          active_subaccounts?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          handle?: string | null
          highlevel_experience?: string | null
          id: string
          is_verified?: boolean
          joined_at?: string | null
          post_count?: number
          role?: Database["public"]["Enums"]["community_role"]
          show_account_count?: boolean
          tier?: Database["public"]["Enums"]["community_tier"]
          updated_at?: string
        }
        Update: {
          active_subaccounts?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          handle?: string | null
          highlevel_experience?: string | null
          id?: string
          is_verified?: boolean
          joined_at?: string | null
          post_count?: number
          role?: Database["public"]["Enums"]["community_role"]
          show_account_count?: boolean
          tier?: Database["public"]["Enums"]["community_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      community_reactions: {
        Row: {
          comment_id: string | null
          created_at: string
          id: string
          post_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          type?: string
          user_id: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_snapshots: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          install_count: number
          min_tier: Database["public"]["Enums"]["community_tier"]
          share_link: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          install_count?: number
          min_tier?: Database["public"]["Enums"]["community_tier"]
          share_link?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          install_count?: number
          min_tier?: Database["public"]["Enums"]["community_tier"]
          share_link?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      community_spaces: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          min_tier: Database["public"]["Enums"]["community_tier"]
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          min_tier?: Database["public"]["Enums"]["community_tier"]
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          min_tier?: Database["public"]["Enums"]["community_tier"]
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      community_thread_messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          thread_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          thread_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_thread_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "community_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      community_threads: {
        Row: {
          assigned_to: string | null
          created_at: string
          id: string
          is_private: boolean
          status: Database["public"]["Enums"]["community_thread_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          is_private?: boolean
          status?: Database["public"]["Enums"]["community_thread_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          is_private?: boolean
          status?: Database["public"]["Enums"]["community_thread_status"]
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      copilot_ai_paused: {
        Row: {
          created_at: string
          owner_email: string
          paused_by: string | null
          paused_until: string | null
          reason: string | null
          source: string | null
        }
        Insert: {
          created_at?: string
          owner_email: string
          paused_by?: string | null
          paused_until?: string | null
          reason?: string | null
          source?: string | null
        }
        Update: {
          created_at?: string
          owner_email?: string
          paused_by?: string | null
          paused_until?: string | null
          reason?: string | null
          source?: string | null
        }
        Relationships: []
      }
      copilot_chat_messages: {
        Row: {
          actions: Json | null
          attachments: Json | null
          content: string
          created_at: string
          id: string
          owner_email: string
          role: string
        }
        Insert: {
          actions?: Json | null
          attachments?: Json | null
          content: string
          created_at?: string
          id?: string
          owner_email: string
          role: string
        }
        Update: {
          actions?: Json | null
          attachments?: Json | null
          content?: string
          created_at?: string
          id?: string
          owner_email?: string
          role?: string
        }
        Relationships: []
      }
      copilot_message_ratings: {
        Row: {
          answer_text: string | null
          corrected_answer: string | null
          created_at: string
          id: string
          message_id: string
          notes: string | null
          owner_email: string
          question_text: string | null
          rated_by: string
          rating: string
          updated_at: string
        }
        Insert: {
          answer_text?: string | null
          corrected_answer?: string | null
          created_at?: string
          id?: string
          message_id: string
          notes?: string | null
          owner_email: string
          question_text?: string | null
          rated_by?: string
          rating: string
          updated_at?: string
        }
        Update: {
          answer_text?: string | null
          corrected_answer?: string | null
          created_at?: string
          id?: string
          message_id?: string
          notes?: string | null
          owner_email?: string
          question_text?: string | null
          rated_by?: string
          rating?: string
          updated_at?: string
        }
        Relationships: []
      }
      copilot_nudge_locks: {
        Row: {
          job: string
          locked_at: string
          locked_until: string
        }
        Insert: {
          job: string
          locked_at?: string
          locked_until: string
        }
        Update: {
          job?: string
          locked_at?: string
          locked_until?: string
        }
        Relationships: []
      }
      copilot_nudge_settings: {
        Row: {
          channels: Json
          created_at: string
          email_outbound_webhook_url: string | null
          enabled: boolean
          frequency: string
          last_sent_at: string | null
          next_due_at: string | null
          owner_email: string
          paused_until: string | null
          preferred_dow: number | null
          preferred_hour_local: number | null
          sms_outbound_webhook_url: string | null
          tz_offset_minutes: number
          updated_at: string
          work_hour_end: number
          work_hour_start: number
        }
        Insert: {
          channels?: Json
          created_at?: string
          email_outbound_webhook_url?: string | null
          enabled?: boolean
          frequency?: string
          last_sent_at?: string | null
          next_due_at?: string | null
          owner_email: string
          paused_until?: string | null
          preferred_dow?: number | null
          preferred_hour_local?: number | null
          sms_outbound_webhook_url?: string | null
          tz_offset_minutes?: number
          updated_at?: string
          work_hour_end?: number
          work_hour_start?: number
        }
        Update: {
          channels?: Json
          created_at?: string
          email_outbound_webhook_url?: string | null
          enabled?: boolean
          frequency?: string
          last_sent_at?: string | null
          next_due_at?: string | null
          owner_email?: string
          paused_until?: string | null
          preferred_dow?: number | null
          preferred_hour_local?: number | null
          sms_outbound_webhook_url?: string | null
          tz_offset_minutes?: number
          updated_at?: string
          work_hour_end?: number
          work_hour_start?: number
        }
        Relationships: []
      }
      copilot_nudge_topics: {
        Row: {
          created_at: string
          note: string | null
          owner_email: string
          snooze_until: string | null
          stance: string
          topic: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          note?: string | null
          owner_email: string
          snooze_until?: string | null
          stance?: string
          topic: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          note?: string | null
          owner_email?: string
          snooze_until?: string | null
          stance?: string
          topic?: string
          updated_at?: string
        }
        Relationships: []
      }
      copilot_nudges: {
        Row: {
          body: string
          channel: string
          created_at: string
          error: string | null
          headline: string | null
          id: string
          kind: string
          owner_email: string
          recommendations: Json
          responded_at: string | null
          response_channel: string | null
          response_text: string | null
          sent_at: string | null
          slack_channel_id: string | null
          slack_ts: string | null
          snapshot: Json
          status: string
        }
        Insert: {
          body?: string
          channel?: string
          created_at?: string
          error?: string | null
          headline?: string | null
          id?: string
          kind?: string
          owner_email: string
          recommendations?: Json
          responded_at?: string | null
          response_channel?: string | null
          response_text?: string | null
          sent_at?: string | null
          slack_channel_id?: string | null
          slack_ts?: string | null
          snapshot?: Json
          status?: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          error?: string | null
          headline?: string | null
          id?: string
          kind?: string
          owner_email?: string
          recommendations?: Json
          responded_at?: string | null
          response_channel?: string | null
          response_text?: string | null
          sent_at?: string | null
          slack_channel_id?: string | null
          slack_ts?: string | null
          snapshot?: Json
          status?: string
        }
        Relationships: []
      }
      copilot_pending_suggestions: {
        Row: {
          applied_at: string | null
          created_at: string
          id: string
          message: string
          metadata: Json | null
          operation: string
          owner_email: string
          source: string | null
          status: string
          target_field: string | null
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          operation?: string
          owner_email: string
          source?: string | null
          status?: string
          target_field?: string | null
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          operation?: string
          owner_email?: string
          source?: string | null
          status?: string
          target_field?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      copilot_preferences: {
        Row: {
          assistant_name: string
          business_website: string | null
          first_time_completed_at: string | null
          ghl_skipped: boolean
          owner_email: string
          updated_at: string
        }
        Insert: {
          assistant_name?: string
          business_website?: string | null
          first_time_completed_at?: string | null
          ghl_skipped?: boolean
          owner_email: string
          updated_at?: string
        }
        Update: {
          assistant_name?: string
          business_website?: string | null
          first_time_completed_at?: string | null
          ghl_skipped?: boolean
          owner_email?: string
          updated_at?: string
        }
        Relationships: []
      }
      copilot_prompt_edits: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          ideal_answer: string | null
          instruction: string
          source: string | null
          trigger_question: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          ideal_answer?: string | null
          instruction: string
          source?: string | null
          trigger_question?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          ideal_answer?: string | null
          instruction?: string
          source?: string | null
          trigger_question?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      copilot_thread_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          thread_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          role: string
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_thread_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "copilot_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_threads: {
        Row: {
          created_at: string
          id: string
          kind: string
          owner_email: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          owner_email: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          owner_email?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      custom_modules: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      custom_onboarding_videos: {
        Row: {
          agency_id: string
          created_at: string
          custom_module_title: string | null
          description: string
          existing_module_id: string | null
          id: string
          is_embed: boolean
          lesson_order: number
          module_order: number
          module_type: string
          tiers: string[] | null
          title: string
          transcription: string | null
          transcription_attempted_at: string | null
          transcription_error: string | null
          transcription_language: string | null
          transcription_status: string
          updated_at: string
          video_url: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          custom_module_title?: string | null
          description: string
          existing_module_id?: string | null
          id?: string
          is_embed?: boolean
          lesson_order?: number
          module_order?: number
          module_type: string
          tiers?: string[] | null
          title: string
          transcription?: string | null
          transcription_attempted_at?: string | null
          transcription_error?: string | null
          transcription_language?: string | null
          transcription_status?: string
          updated_at?: string
          video_url: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          custom_module_title?: string | null
          description?: string
          existing_module_id?: string | null
          id?: string
          is_embed?: boolean
          lesson_order?: number
          module_order?: number
          module_type?: string
          tiers?: string[] | null
          title?: string
          transcription?: string | null
          transcription_attempted_at?: string | null
          transcription_error?: string | null
          transcription_language?: string | null
          transcription_status?: string
          updated_at?: string
          video_url?: string
        }
        Relationships: []
      }
      customer_message_events: {
        Row: {
          channel: string
          created_at: string
          detail: string | null
          id: string
          metadata: Json
          provider: string | null
          provider_message_id: string | null
          source: string
          status: string
          status_at: string
          subject: string | null
          template_key: string | null
          updated_at: string
          user_email: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          detail?: string | null
          id?: string
          metadata?: Json
          provider?: string | null
          provider_message_id?: string | null
          source: string
          status: string
          status_at?: string
          subject?: string | null
          template_key?: string | null
          updated_at?: string
          user_email?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          detail?: string | null
          id?: string
          metadata?: Json
          provider?: string | null
          provider_message_id?: string | null
          source?: string
          status?: string
          status_at?: string
          subject?: string | null
          template_key?: string | null
          updated_at?: string
          user_email?: string | null
        }
        Relationships: []
      }
      email_warmup_requests: {
        Row: {
          agency_name: string
          created_at: string
          id: string
          profile_image_link: string
          sender_email: string
          sender_name: string
          status: string
          updated_at: string
          user_email: string
          warmed_domain: string | null
        }
        Insert: {
          agency_name: string
          created_at?: string
          id?: string
          profile_image_link: string
          sender_email: string
          sender_name: string
          status?: string
          updated_at?: string
          user_email: string
          warmed_domain?: string | null
        }
        Update: {
          agency_name?: string
          created_at?: string
          id?: string
          profile_image_link?: string
          sender_email?: string
          sender_name?: string
          status?: string
          updated_at?: string
          user_email?: string
          warmed_domain?: string | null
        }
        Relationships: []
      }
      external_platform_connections: {
        Row: {
          agency_id: string
          created_at: string
          enabled: boolean
          event_count: number
          id: string
          last_event_at: string | null
          owner_email: string
          platform_name: string
          slack_notify: boolean
          token: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          enabled?: boolean
          event_count?: number
          id?: string
          last_event_at?: string | null
          owner_email: string
          platform_name?: string
          slack_notify?: boolean
          token?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          enabled?: boolean
          event_count?: number
          id?: string
          last_event_at?: string | null
          owner_email?: string
          platform_name?: string
          slack_notify?: boolean
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      external_platform_events: {
        Row: {
          agency_id: string
          connection_id: string
          created_at: string
          event_type: string
          external_user_id: string | null
          id: string
          metadata: Json
          page_url: string | null
          user_agent: string | null
          user_email: string | null
          user_name: string | null
        }
        Insert: {
          agency_id: string
          connection_id: string
          created_at?: string
          event_type?: string
          external_user_id?: string | null
          id?: string
          metadata?: Json
          page_url?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_name?: string | null
        }
        Update: {
          agency_id?: string
          connection_id?: string
          created_at?: string
          event_type?: string
          external_user_id?: string | null
          id?: string
          metadata?: Json
          page_url?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_platform_events_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "external_platform_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_comments: {
        Row: {
          comment_text: string
          created_at: string
          feature_id: string
          id: string
          updated_at: string
          user_name: string
        }
        Insert: {
          comment_text: string
          created_at?: string
          feature_id: string
          id?: string
          updated_at?: string
          user_name: string
        }
        Update: {
          comment_text?: string
          created_at?: string
          feature_id?: string
          id?: string
          updated_at?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_comments_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "feature_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_requests: {
        Row: {
          category: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          image_urls: Json | null
          implemented_date: string | null
          live_url: string | null
          status: string | null
          title: string
          updated_at: string | null
          upvotes: number | null
        }
        Insert: {
          category: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          image_urls?: Json | null
          implemented_date?: string | null
          live_url?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          upvotes?: number | null
        }
        Update: {
          category?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          image_urls?: Json | null
          implemented_date?: string | null
          live_url?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          upvotes?: number | null
        }
        Relationships: []
      }
      feature_upvotes: {
        Row: {
          created_at: string
          feature_id: string
          id: string
          user_identifier: string
        }
        Insert: {
          created_at?: string
          feature_id: string
          id?: string
          user_identifier: string
        }
        Update: {
          created_at?: string
          feature_id?: string
          id?: string
          user_identifier?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_upvotes_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "feature_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_email_log: {
        Row: {
          body: string | null
          created_at: string
          email_type: string
          event_count: number
          id: string
          sent: boolean
          session_id: string | null
          subject: string | null
          suppressed_reason: string | null
          user_email: string
          user_health: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          email_type: string
          event_count?: number
          id?: string
          sent?: boolean
          session_id?: string | null
          subject?: string | null
          suppressed_reason?: string | null
          user_email: string
          user_health?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          email_type?: string
          event_count?: number
          id?: string
          sent?: boolean
          session_id?: string | null
          subject?: string | null
          suppressed_reason?: string | null
          user_email?: string
          user_health?: string | null
        }
        Relationships: []
      }
      free_leads: {
        Row: {
          business_keywords: string
          city: string
          country: string
          created_at: string
          id: string
          leads_url: string | null
          status: string
          updated_at: string
          user_email: string
        }
        Insert: {
          business_keywords: string
          city: string
          country: string
          created_at?: string
          id?: string
          leads_url?: string | null
          status?: string
          updated_at?: string
          user_email: string
        }
        Update: {
          business_keywords?: string
          city?: string
          country?: string
          created_at?: string
          id?: string
          leads_url?: string | null
          status?: string
          updated_at?: string
          user_email?: string
        }
        Relationships: []
      }
      funnel_apply_leads: {
        Row: {
          answers: Json
          created_at: string
          email: string | null
          funnel: string
          handoff_claimed_at: string | null
          handoff_sent_at: string | null
          id: string
          is_test: boolean
          landing_url: string | null
          name: string | null
          phone: string | null
          session_key: string
          status: string
          step: string
          submitted_at: string | null
          updated_at: string
          utm: Json
        }
        Insert: {
          answers?: Json
          created_at?: string
          email?: string | null
          funnel: string
          handoff_claimed_at?: string | null
          handoff_sent_at?: string | null
          id?: string
          is_test?: boolean
          landing_url?: string | null
          name?: string | null
          phone?: string | null
          session_key: string
          status?: string
          step?: string
          submitted_at?: string | null
          updated_at?: string
          utm?: Json
        }
        Update: {
          answers?: Json
          created_at?: string
          email?: string | null
          funnel?: string
          handoff_claimed_at?: string | null
          handoff_sent_at?: string | null
          id?: string
          is_test?: boolean
          landing_url?: string | null
          name?: string | null
          phone?: string | null
          session_key?: string
          status?: string
          step?: string
          submitted_at?: string | null
          updated_at?: string
          utm?: Json
        }
        Relationships: []
      }
      funnel_onboarding: {
        Row: {
          answers: Json
          checkout_id: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          order_lines: Json
          phone: string | null
          source: string
        }
        Insert: {
          answers?: Json
          checkout_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          order_lines?: Json
          phone?: string | null
          source?: string
        }
        Update: {
          answers?: Json
          checkout_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          order_lines?: Json
          phone?: string | null
          source?: string
        }
        Relationships: []
      }
      ghl_connections: {
        Row: {
          agency_id: string
          capabilities: Json
          company_id: string
          company_name: string | null
          connected_by: string | null
          created_at: string
          key_version: number
          last_error: string | null
          last_sync_at: string | null
          status: string
          token_ciphertext: string
          token_nonce: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          capabilities?: Json
          company_id: string
          company_name?: string | null
          connected_by?: string | null
          created_at?: string
          key_version?: number
          last_error?: string | null
          last_sync_at?: string | null
          status?: string
          token_ciphertext: string
          token_nonce: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          capabilities?: Json
          company_id?: string
          company_name?: string | null
          connected_by?: string | null
          created_at?: string
          key_version?: number
          last_error?: string | null
          last_sync_at?: string | null
          status?: string
          token_ciphertext?: string
          token_nonce?: string
          updated_at?: string
        }
        Relationships: []
      }
      ghl_custom_menus_cache: {
        Row: {
          agency_id: string
          all_locations: boolean | null
          location_ids: string[] | null
          menu_id: string
          show_on_company: boolean | null
          synced_at: string
          title: string | null
          url: string | null
          user_roles: Json | null
        }
        Insert: {
          agency_id: string
          all_locations?: boolean | null
          location_ids?: string[] | null
          menu_id: string
          show_on_company?: boolean | null
          synced_at?: string
          title?: string | null
          url?: string | null
          user_roles?: Json | null
        }
        Update: {
          agency_id?: string
          all_locations?: boolean | null
          location_ids?: string[] | null
          menu_id?: string
          show_on_company?: boolean | null
          synced_at?: string
          title?: string | null
          url?: string | null
          user_roles?: Json | null
        }
        Relationships: []
      }
      ghl_email_claims: {
        Row: {
          claim_key: string
          completed: boolean
          created_at: string
          lease_until: string
          updated_at: string
        }
        Insert: {
          claim_key: string
          completed?: boolean
          created_at?: string
          lease_until?: string
          updated_at?: string
        }
        Update: {
          claim_key?: string
          completed?: boolean
          created_at?: string
          lease_until?: string
          updated_at?: string
        }
        Relationships: []
      }
      ghl_locations_cache: {
        Row: {
          agency_id: string
          company_name: string | null
          email: string | null
          location_id: string
          name: string | null
          phone: string | null
          synced_at: string
        }
        Insert: {
          agency_id: string
          company_name?: string | null
          email?: string | null
          location_id: string
          name?: string | null
          phone?: string | null
          synced_at?: string
        }
        Update: {
          agency_id?: string
          company_name?: string | null
          email?: string | null
          location_id?: string
          name?: string | null
          phone?: string | null
          synced_at?: string
        }
        Relationships: []
      }
      giveaway_entries: {
        Row: {
          agency_id: string | null
          breakdown: Json
          created_at: string
          display_name: string
          email: string
          id: string
          last_scored_at: string | null
          opted_in_at: string
          points: number
          rules_accepted_at: string | null
          tickets: number
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          breakdown?: Json
          created_at?: string
          display_name: string
          email: string
          id?: string
          last_scored_at?: string | null
          opted_in_at?: string
          points?: number
          rules_accepted_at?: string | null
          tickets?: number
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          breakdown?: Json
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          last_scored_at?: string | null
          opted_in_at?: string
          points?: number
          rules_accepted_at?: string | null
          tickets?: number
          updated_at?: string
        }
        Relationships: []
      }
      hub_ip_sessions: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          ip_hash: string
          updated_at: string
          user_email: string | null
          user_name: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          ip_hash: string
          updated_at?: string
          user_email?: string | null
          user_name?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          ip_hash?: string
          updated_at?: string
          user_email?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      hub_session_revocations: {
        Row: {
          agency_id: string
          id: string
          revoked_at: string
          user_identifier: string
        }
        Insert: {
          agency_id: string
          id?: string
          revoked_at?: string
          user_identifier: string
        }
        Update: {
          agency_id?: string
          id?: string
          revoked_at?: string
          user_identifier?: string
        }
        Relationships: []
      }
      kb_hidden_items: {
        Row: {
          agency_id: string
          article_slug: string | null
          category_slug: string
          created_at: string
          id: string
          item_type: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          article_slug?: string | null
          category_slug: string
          created_at?: string
          id?: string
          item_type: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          article_slug?: string | null
          category_slug?: string
          created_at?: string
          id?: string
          item_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      kit_ad_requests: {
        Row: {
          business_name: string
          created_at: string
          email: string
          id: string
          logo_path: string
          notes: string
          template_ids: string[]
          user_id: string
        }
        Insert: {
          business_name: string
          created_at?: string
          email: string
          id?: string
          logo_path: string
          notes?: string
          template_ids: string[]
          user_id: string
        }
        Update: {
          business_name?: string
          created_at?: string
          email?: string
          id?: string
          logo_path?: string
          notes?: string
          template_ids?: string[]
          user_id?: string
        }
        Relationships: []
      }
      kit_events: {
        Row: {
          amount_cents: number | null
          checkout_session_id: string | null
          created_at: string
          event: string
          fbclid: string | null
          id: string
          is_test: boolean
          line_id: string | null
          properties: Json | null
          referrer: string | null
          session_id: string
          step: string
          ua_hash: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          amount_cents?: number | null
          checkout_session_id?: string | null
          created_at?: string
          event: string
          fbclid?: string | null
          id?: string
          is_test?: boolean
          line_id?: string | null
          properties?: Json | null
          referrer?: string | null
          session_id: string
          step: string
          ua_hash?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          amount_cents?: number | null
          checkout_session_id?: string | null
          created_at?: string
          event?: string
          fbclid?: string | null
          id?: string
          is_test?: boolean
          line_id?: string | null
          properties?: Json | null
          referrer?: string | null
          session_id?: string
          step?: string
          ua_hash?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      kit_landing_pages: {
        Row: {
          created_at: string
          email: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          updated_at?: string
          url: string
          user_id?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      kit_meta_retry_auth: {
        Row: {
          created_at: string
          id: number
          secret: string
        }
        Insert: {
          created_at?: string
          id?: number
          secret: string
        }
        Update: {
          created_at?: string
          id?: number
          secret?: string
        }
        Relationships: []
      }
      kit_onboarding_progress: {
        Row: {
          completed: string[]
          email: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: string[]
          email?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: string[]
          email?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kit_purchases: {
        Row: {
          amount_cents: number
          checkout_session_id: string
          comped: boolean
          created_at: string
          currency: string
          email: string
          id: string
          line_id: string
          payment_intent_id: string | null
          promotion_code_id: string | null
          source: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          user_id: string | null
        }
        Insert: {
          amount_cents: number
          checkout_session_id: string
          comped?: boolean
          created_at?: string
          currency?: string
          email: string
          id?: string
          line_id: string
          payment_intent_id?: string | null
          promotion_code_id?: string | null
          source: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          checkout_session_id?: string
          comped?: boolean
          created_at?: string
          currency?: string
          email?: string
          id?: string
          line_id?: string
          payment_intent_id?: string | null
          promotion_code_id?: string | null
          source?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      levelup_connections: {
        Row: {
          created_at: string
          id: string
          name: string
          phone_number: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone_number: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone_number?: string
        }
        Relationships: []
      }
      location_mappings: {
        Row: {
          agency_id: string
          created_at: string
          created_by: string | null
          key_type: string
          key_value: string
          location_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          created_by?: string | null
          key_type: string
          key_value: string
          location_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          created_by?: string | null
          key_type?: string
          key_value?: string
          location_id?: string
        }
        Relationships: []
      }
      location_themes: {
        Row: {
          agency_id: string
          location_id: string
          theme: Json
          updated_at: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          agency_id: string
          location_id: string
          theme: Json
          updated_at?: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          agency_id?: string
          location_id?: string
          theme?: Json
          updated_at?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      login_events: {
        Row: {
          auth_audit_id: string | null
          auth_user_id: string | null
          created_at: string
          id: string
          logged_in_at: string
          provider: string | null
          source: string
          user_email: string | null
          user_id: number | null
        }
        Insert: {
          auth_audit_id?: string | null
          auth_user_id?: string | null
          created_at?: string
          id?: string
          logged_in_at?: string
          provider?: string | null
          source: string
          user_email?: string | null
          user_id?: number | null
        }
        Update: {
          auth_audit_id?: string | null
          auth_user_id?: string | null
          created_at?: string
          id?: string
          logged_in_at?: string
          provider?: string | null
          source?: string
          user_email?: string | null
          user_id?: number | null
        }
        Relationships: []
      }
      marketing_tool_data: {
        Row: {
          ai_email_data: Json | null
          ai_offer_data: Json | null
          created_at: string
          id: string
          situation: string | null
          solution: string | null
          targeting: string | null
          updated_at: string
          user_email: string
        }
        Insert: {
          ai_email_data?: Json | null
          ai_offer_data?: Json | null
          created_at?: string
          id?: string
          situation?: string | null
          solution?: string | null
          targeting?: string | null
          updated_at?: string
          user_email: string
        }
        Update: {
          ai_email_data?: Json | null
          ai_offer_data?: Json | null
          created_at?: string
          id?: string
          situation?: string | null
          solution?: string | null
          targeting?: string | null
          updated_at?: string
          user_email?: string
        }
        Relationships: []
      }
      menu_automation_events: {
        Row: {
          agency_id: string
          attempts: number
          automation_id: string | null
          candidate_location_ids: string[]
          created_at: string
          email: string | null
          error: string | null
          event_id: string
          explicit_location_id: string | null
          id: string
          location_ids: string[]
          next_run_at: string
          payload_hash: string
          preset_name: string | null
          product_id: string | null
          status: string
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          attempts?: number
          automation_id?: string | null
          candidate_location_ids?: string[]
          created_at?: string
          email?: string | null
          error?: string | null
          event_id: string
          explicit_location_id?: string | null
          id?: string
          location_ids?: string[]
          next_run_at?: string
          payload_hash: string
          preset_name?: string | null
          product_id?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          attempts?: number
          automation_id?: string | null
          candidate_location_ids?: string[]
          created_at?: string
          email?: string | null
          error?: string | null
          event_id?: string
          explicit_location_id?: string | null
          id?: string
          location_ids?: string[]
          next_run_at?: string
          payload_hash?: string
          preset_name?: string | null
          product_id?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_automation_events_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "menu_automations"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_automations: {
        Row: {
          agency_id: string
          allow_any_preset: boolean
          allow_single_location_email: boolean
          created_at: string
          id: string
          is_active: boolean
          legacy_until: string
          name: string
          product_presets: Json
          secret_hash: string | null
          secret_prefix: string | null
          secret_rotated_at: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          allow_any_preset?: boolean
          allow_single_location_email?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          legacy_until?: string
          name?: string
          product_presets?: Json
          secret_hash?: string | null
          secret_prefix?: string | null
          secret_rotated_at?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          allow_any_preset?: boolean
          allow_single_location_email?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          legacy_until?: string
          name?: string
          product_presets?: Json
          secret_hash?: string | null
          secret_prefix?: string | null
          secret_rotated_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      menu_link_rules: {
        Row: {
          agency_id: string
          automation_id: string | null
          created_at: string
          hidden_links: Json
          id: string
          is_active: boolean
          preset_name: string | null
          sub_account_id: string | null
          suspended_by_billing: boolean
          updated_at: string
        }
        Insert: {
          agency_id: string
          automation_id?: string | null
          created_at?: string
          hidden_links?: Json
          id?: string
          is_active?: boolean
          preset_name?: string | null
          sub_account_id?: string | null
          suspended_by_billing?: boolean
          updated_at?: string
        }
        Update: {
          agency_id?: string
          automation_id?: string | null
          created_at?: string
          hidden_links?: Json
          id?: string
          is_active?: boolean
          preset_name?: string | null
          sub_account_id?: string | null
          suspended_by_billing?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      module_completion: {
        Row: {
          category_id: string
          completed: boolean | null
          completed_at: string
          id: string
          module_id: string
          user_id: string
        }
        Insert: {
          category_id: string
          completed?: boolean | null
          completed_at?: string
          id?: string
          module_id: string
          user_id: string
        }
        Update: {
          category_id?: string
          completed?: boolean | null
          completed_at?: string
          id?: string
          module_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_completion_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_progress"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_calls: {
        Row: {
          agency_id: string | null
          charge_status: string | null
          consumed_at: string | null
          created_at: string
          email: string
          external_event_id: string | null
          id: string
          is_manual: boolean
          meeting_link: string | null
          name: string | null
          notes: string | null
          owner_email: string | null
          phone: string | null
          recorded_by: string | null
          recording_link: string | null
          scheduled_at: string | null
          stripe_payment_intent_id: string | null
          transcript: string | null
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          charge_status?: string | null
          consumed_at?: string | null
          created_at?: string
          email: string
          external_event_id?: string | null
          id?: string
          is_manual?: boolean
          meeting_link?: string | null
          name?: string | null
          notes?: string | null
          owner_email?: string | null
          phone?: string | null
          recorded_by?: string | null
          recording_link?: string | null
          scheduled_at?: string | null
          stripe_payment_intent_id?: string | null
          transcript?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          charge_status?: string | null
          consumed_at?: string | null
          created_at?: string
          email?: string
          external_event_id?: string | null
          id?: string
          is_manual?: boolean
          meeting_link?: string | null
          name?: string | null
          notes?: string | null
          owner_email?: string | null
          phone?: string | null
          recorded_by?: string | null
          recording_link?: string | null
          scheduled_at?: string | null
          stripe_payment_intent_id?: string | null
          transcript?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      onboarding_owner_aliases: {
        Row: {
          alias_email: string
          created_at: string
          owner_email: string
        }
        Insert: {
          alias_email: string
          created_at?: string
          owner_email: string
        }
        Update: {
          alias_email?: string
          created_at?: string
          owner_email?: string
        }
        Relationships: []
      }
      one_feature_kit_actions: {
        Row: {
          action_key: string
          attempts: number
          completed: boolean
          created_at: string
          lease_until: string
          stripe_id: string | null
          updated_at: string
        }
        Insert: {
          action_key: string
          attempts?: number
          completed?: boolean
          created_at?: string
          lease_until?: string
          stripe_id?: string | null
          updated_at?: string
        }
        Update: {
          action_key?: string
          attempts?: number
          completed?: boolean
          created_at?: string
          lease_until?: string
          stripe_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      one_feature_training_leads: {
        Row: {
          created_at: string
          email: string
          form: string
          has_highlevel: boolean | null
          id: string
          is_test: boolean
          name: string
          page: string
          phone: string | null
          plan_selected_at: string | null
          selected_plan: string | null
          utm: Json | null
          webhook_sent_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          form: string
          has_highlevel?: boolean | null
          id?: string
          is_test?: boolean
          name: string
          page: string
          phone?: string | null
          plan_selected_at?: string | null
          selected_plan?: string | null
          utm?: Json | null
          webhook_sent_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          form?: string
          has_highlevel?: boolean | null
          id?: string
          is_test?: boolean
          name?: string
          page?: string
          phone?: string | null
          plan_selected_at?: string | null
          selected_plan?: string | null
          utm?: Json | null
          webhook_sent_at?: string | null
        }
        Relationships: []
      }
      plan_change_history: {
        Row: {
          actor: string | null
          created_at: string
          id: string
          new_billing_state: string | null
          new_plan: string | null
          old_billing_state: string | null
          old_plan: string | null
          source: string
          user_email: string | null
          user_id: number | null
        }
        Insert: {
          actor?: string | null
          created_at?: string
          id?: string
          new_billing_state?: string | null
          new_plan?: string | null
          old_billing_state?: string | null
          old_plan?: string | null
          source?: string
          user_email?: string | null
          user_id?: number | null
        }
        Update: {
          actor?: string | null
          created_at?: string
          id?: string
          new_billing_state?: string | null
          new_plan?: string | null
          old_billing_state?: string | null
          old_plan?: string | null
          source?: string
          user_email?: string | null
          user_id?: number | null
        }
        Relationships: []
      }
      platform_emails: {
        Row: {
          body: string
          created_at: string
          email_type: string
          id: string
          plan: string
          subject: string
          week_label: string | null
        }
        Insert: {
          body: string
          created_at?: string
          email_type: string
          id?: string
          plan: string
          subject: string
          week_label?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          email_type?: string
          id?: string
          plan?: string
          subject?: string
          week_label?: string | null
        }
        Relationships: []
      }
      platform_events: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          metadata: Json
          trigger_type: string
          user_email: string | null
          user_name: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          metadata?: Json
          trigger_type: string
          user_email?: string | null
          user_name?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          trigger_type?: string
          user_email?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      platform_support_excluded_agencies: {
        Row: {
          created_at: string
          owner_email: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          owner_email: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          owner_email?: string
          reason?: string | null
        }
        Relationships: []
      }
      public_copilot_messages: {
        Row: {
          claimed_by: string | null
          claimed_thread_id: string | null
          content: string
          created_at: string
          id: string
          ip_hash: string | null
          role: string
          visitor_id: string
        }
        Insert: {
          claimed_by?: string | null
          claimed_thread_id?: string | null
          content?: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          role: string
          visitor_id: string
        }
        Update: {
          claimed_by?: string | null
          claimed_thread_id?: string | null
          content?: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          role?: string
          visitor_id?: string
        }
        Relationships: []
      }
      public_support_submissions: {
        Row: {
          agency_name: string | null
          created_at: string
          email: string
          id: string
          ip_hash: string | null
          name: string
          note: string | null
          question: string
          source: string
          status: string
          ticket_id: string | null
          topic: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          agency_name?: string | null
          created_at?: string
          email: string
          id?: string
          ip_hash?: string | null
          name: string
          note?: string | null
          question: string
          source?: string
          status?: string
          ticket_id?: string | null
          topic: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          agency_name?: string | null
          created_at?: string
          email?: string
          id?: string
          ip_hash?: string | null
          name?: string
          note?: string | null
          question?: string
          source?: string
          status?: string
          ticket_id?: string | null
          topic?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_support_submissions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_partner_waitlist: {
        Row: {
          affiliate_link: string | null
          business_name: string
          contact_name: string
          created_at: string
          email: string
          id: string
          ip_hash: string | null
          logo_path: string | null
          phone: string
          source: string | null
          status: string
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          website: string
        }
        Insert: {
          affiliate_link?: string | null
          business_name: string
          contact_name: string
          created_at?: string
          email: string
          id?: string
          ip_hash?: string | null
          logo_path?: string | null
          phone: string
          source?: string | null
          status?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          website: string
        }
        Update: {
          affiliate_link?: string | null
          business_name?: string
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          ip_hash?: string | null
          logo_path?: string | null
          phone?: string
          source?: string | null
          status?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          website?: string
        }
        Relationships: []
      }
      saas_suite_users: {
        Row: {
          activation_rescue_sent_at: string | null
          active_subaccounts: string | null
          affiliate_id: string | null
          affiliate_slug: string | null
          agency_id: string | null
          agency_id_advanced: string | null
          agency_id_basic: string | null
          agency_id_elite: string | null
          agency_name: string | null
          agency_support_access: boolean
          agency_support_embed_enabled: boolean
          agency_support_embed_greeting: string | null
          agency_support_embed_key: string | null
          agency_support_embed_launcher_label: string | null
          agency_support_embed_title: string | null
          agency_support_subscription_id: string | null
          agency_support_wallet: number
          ai_chat_enabled: boolean
          ai_embed_code: string | null
          ai_questions_count: number | null
          approval: string | null
          billing_state: string
          bonuses_phone: string | null
          branded_ai_support: boolean
          branding_presets: Json
          branding_suspended_at: string | null
          branding_tool_access: boolean
          branding_tool_purchased_at: string | null
          cancel_access_until: string | null
          cancel_claim_key: string | null
          checkout_page: string | null
          client_hub_enabled: boolean
          created_at: string
          custom_ai_general_help_enabled: boolean
          custom_domain: string | null
          custom_domain_access: boolean
          custom_domain_live: boolean
          custom_domain_submitted_at: string | null
          custom_domain_went_live_at: string | null
          customer_language: string
          customer_replies_webhook_url: string | null
          customer_updates_webhook_url: string | null
          dynamic_installation: boolean
          email: string | null
          email_warmup_access: boolean
          email_warmup_credits: number
          fbc: string | null
          fbclid: string | null
          fbp: string | null
          free_leads_access: boolean
          full_name: string | null
          gclid: string | null
          generated_css: string | null
          generated_css_backup: string | null
          guest_access_until: string | null
          hide_bonuses: boolean
          highlevel_experience: string | null
          hub_welcome_email_queued_at: string | null
          hub_welcome_email_sent_at: string | null
          human_chat_enabled: boolean
          human_chat_mode: string
          id: number
          inbound_reply_key: string
          initial_questions_completed: boolean | null
          install_confirmed_at: string | null
          install_guide_sent_at: string | null
          is_affiliate: boolean
          kb_headline: string | null
          kb_logo_url: string | null
          knowledge_base_enabled: boolean
          landing_page: string | null
          language: string
          last_accessed: string | null
          last_device: string | null
          last_fbclid: string | null
          last_followup_email_sent_at: string | null
          last_gclid: string | null
          last_incomplete_step_id: string | null
          last_landing_page: string | null
          last_login_at: string | null
          last_onboarding_session_id: string | null
          last_referrer: string | null
          last_touch_at: string | null
          last_utm_campaign: string | null
          last_utm_content: string | null
          last_utm_id: string | null
          last_utm_medium: string | null
          last_utm_source: string | null
          last_utm_term: string | null
          login_count: number | null
          login_enabled: boolean
          login_welcome_headline: string | null
          login_welcome_subheadline: string | null
          login_with: string
          max_onboarding_users: number | null
          mobile_branding_enabled: boolean
          mobile_menu_color: string
          mobile_zoom_enabled: boolean
          most_used_feature: string | null
          notify_all_chats: boolean
          notify_all_tickets: boolean
          notify_assigned_tickets: boolean
          onboarding_autopay: boolean
          onboarding_autopay_consent_at: string | null
          onboarding_call_access: boolean
          onboarding_call_wallet: number
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          onboarding_deployment_configured: boolean
          onboarding_deployment_mode: string
          onboarding_deployment_plans: string[]
          onboarding_deployment_users: string[]
          onboarding_intent: string | null
          onboarding_reminder_dismissed: boolean
          onboarding_skipped: boolean
          onboarding_skipped_at: string | null
          onboarding_started_at: string | null
          onboarding_step: number | null
          onboarding_stripe_customer_id: string | null
          onboarding_stripe_payment_method_id: string | null
          original_agency_id: string | null
          original_agency_id_advanced: string | null
          original_agency_id_basic: string | null
          original_agency_id_elite: string | null
          payment_failed_at: string | null
          payment_failure_count: number
          payment_grace_until: string | null
          plan: Database["public"]["Enums"]["plan_type"]
          plan_before_delinquency: string | null
          popup_enabled: boolean
          premium_support: boolean
          premium_support_started_at: string | null
          primary_color: string | null
          referrer: string | null
          secondary_color: string | null
          show_chat_widget: boolean | null
          show_v2_ui: boolean
          signup_device: string | null
          snapshot_access: boolean
          source: string | null
          support_email_alerts: Json
          support_ticketing_enabled: boolean
          support_updates_webhook_url: string | null
          support_webhook_url: string | null
          tertiary_color: string | null
          tickets_opened_count: number | null
          tips_bot_enabled: boolean
          top_nav_widget_color_mode: string
          top_nav_widget_custom_color: string | null
          top_nav_widget_enabled: boolean
          top_nav_widget_icon_color_mode: string | null
          top_nav_widget_icon_custom_color: string | null
          top_nav_widget_label: string
          top_nav_widget_options: Json | null
          top_nav_widget_tile_color_mode: string | null
          top_nav_widget_tile_custom_color: string | null
          total_watch_time_seconds: number | null
          trial_length: number
          trial_source: string | null
          trial_start_date: string | null
          use_agency_name_url: boolean | null
          utm_campaign: string | null
          utm_content: string | null
          utm_id: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          v2_navigation_enabled: boolean
          videos_skipped_count: number | null
          videos_watched_count: number | null
          weekly_login_count: number | null
          weekly_login_reset_at: string | null
          welcome_ai_email_sent_at: string | null
          welcome_email_attempts: number
          welcome_email_claimed_at: string | null
          welcome_email_force: boolean
          welcome_email_last_error: string | null
          welcome_email_next_attempt_at: string | null
          white_label_domain: string | null
        }
        Insert: {
          activation_rescue_sent_at?: string | null
          active_subaccounts?: string | null
          affiliate_id?: string | null
          affiliate_slug?: string | null
          agency_id?: string | null
          agency_id_advanced?: string | null
          agency_id_basic?: string | null
          agency_id_elite?: string | null
          agency_name?: string | null
          agency_support_access?: boolean
          agency_support_embed_enabled?: boolean
          agency_support_embed_greeting?: string | null
          agency_support_embed_key?: string | null
          agency_support_embed_launcher_label?: string | null
          agency_support_embed_title?: string | null
          agency_support_subscription_id?: string | null
          agency_support_wallet?: number
          ai_chat_enabled?: boolean
          ai_embed_code?: string | null
          ai_questions_count?: number | null
          approval?: string | null
          billing_state?: string
          bonuses_phone?: string | null
          branded_ai_support?: boolean
          branding_presets?: Json
          branding_suspended_at?: string | null
          branding_tool_access?: boolean
          branding_tool_purchased_at?: string | null
          cancel_access_until?: string | null
          cancel_claim_key?: string | null
          checkout_page?: string | null
          client_hub_enabled?: boolean
          created_at?: string
          custom_ai_general_help_enabled?: boolean
          custom_domain?: string | null
          custom_domain_access?: boolean
          custom_domain_live?: boolean
          custom_domain_submitted_at?: string | null
          custom_domain_went_live_at?: string | null
          customer_language?: string
          customer_replies_webhook_url?: string | null
          customer_updates_webhook_url?: string | null
          dynamic_installation?: boolean
          email?: string | null
          email_warmup_access?: boolean
          email_warmup_credits?: number
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          free_leads_access?: boolean
          full_name?: string | null
          gclid?: string | null
          generated_css?: string | null
          generated_css_backup?: string | null
          guest_access_until?: string | null
          hide_bonuses?: boolean
          highlevel_experience?: string | null
          hub_welcome_email_queued_at?: string | null
          hub_welcome_email_sent_at?: string | null
          human_chat_enabled?: boolean
          human_chat_mode?: string
          id?: number
          inbound_reply_key?: string
          initial_questions_completed?: boolean | null
          install_confirmed_at?: string | null
          install_guide_sent_at?: string | null
          is_affiliate?: boolean
          kb_headline?: string | null
          kb_logo_url?: string | null
          knowledge_base_enabled?: boolean
          landing_page?: string | null
          language?: string
          last_accessed?: string | null
          last_device?: string | null
          last_fbclid?: string | null
          last_followup_email_sent_at?: string | null
          last_gclid?: string | null
          last_incomplete_step_id?: string | null
          last_landing_page?: string | null
          last_login_at?: string | null
          last_onboarding_session_id?: string | null
          last_referrer?: string | null
          last_touch_at?: string | null
          last_utm_campaign?: string | null
          last_utm_content?: string | null
          last_utm_id?: string | null
          last_utm_medium?: string | null
          last_utm_source?: string | null
          last_utm_term?: string | null
          login_count?: number | null
          login_enabled?: boolean
          login_welcome_headline?: string | null
          login_welcome_subheadline?: string | null
          login_with?: string
          max_onboarding_users?: number | null
          mobile_branding_enabled?: boolean
          mobile_menu_color?: string
          mobile_zoom_enabled?: boolean
          most_used_feature?: string | null
          notify_all_chats?: boolean
          notify_all_tickets?: boolean
          notify_assigned_tickets?: boolean
          onboarding_autopay?: boolean
          onboarding_autopay_consent_at?: string | null
          onboarding_call_access?: boolean
          onboarding_call_wallet?: number
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          onboarding_deployment_configured?: boolean
          onboarding_deployment_mode?: string
          onboarding_deployment_plans?: string[]
          onboarding_deployment_users?: string[]
          onboarding_intent?: string | null
          onboarding_reminder_dismissed?: boolean
          onboarding_skipped?: boolean
          onboarding_skipped_at?: string | null
          onboarding_started_at?: string | null
          onboarding_step?: number | null
          onboarding_stripe_customer_id?: string | null
          onboarding_stripe_payment_method_id?: string | null
          original_agency_id?: string | null
          original_agency_id_advanced?: string | null
          original_agency_id_basic?: string | null
          original_agency_id_elite?: string | null
          payment_failed_at?: string | null
          payment_failure_count?: number
          payment_grace_until?: string | null
          plan?: Database["public"]["Enums"]["plan_type"]
          plan_before_delinquency?: string | null
          popup_enabled?: boolean
          premium_support?: boolean
          premium_support_started_at?: string | null
          primary_color?: string | null
          referrer?: string | null
          secondary_color?: string | null
          show_chat_widget?: boolean | null
          show_v2_ui?: boolean
          signup_device?: string | null
          snapshot_access?: boolean
          source?: string | null
          support_email_alerts?: Json
          support_ticketing_enabled?: boolean
          support_updates_webhook_url?: string | null
          support_webhook_url?: string | null
          tertiary_color?: string | null
          tickets_opened_count?: number | null
          tips_bot_enabled?: boolean
          top_nav_widget_color_mode?: string
          top_nav_widget_custom_color?: string | null
          top_nav_widget_enabled?: boolean
          top_nav_widget_icon_color_mode?: string | null
          top_nav_widget_icon_custom_color?: string | null
          top_nav_widget_label?: string
          top_nav_widget_options?: Json | null
          top_nav_widget_tile_color_mode?: string | null
          top_nav_widget_tile_custom_color?: string | null
          total_watch_time_seconds?: number | null
          trial_length?: number
          trial_source?: string | null
          trial_start_date?: string | null
          use_agency_name_url?: boolean | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          v2_navigation_enabled?: boolean
          videos_skipped_count?: number | null
          videos_watched_count?: number | null
          weekly_login_count?: number | null
          weekly_login_reset_at?: string | null
          welcome_ai_email_sent_at?: string | null
          welcome_email_attempts?: number
          welcome_email_claimed_at?: string | null
          welcome_email_force?: boolean
          welcome_email_last_error?: string | null
          welcome_email_next_attempt_at?: string | null
          white_label_domain?: string | null
        }
        Update: {
          activation_rescue_sent_at?: string | null
          active_subaccounts?: string | null
          affiliate_id?: string | null
          affiliate_slug?: string | null
          agency_id?: string | null
          agency_id_advanced?: string | null
          agency_id_basic?: string | null
          agency_id_elite?: string | null
          agency_name?: string | null
          agency_support_access?: boolean
          agency_support_embed_enabled?: boolean
          agency_support_embed_greeting?: string | null
          agency_support_embed_key?: string | null
          agency_support_embed_launcher_label?: string | null
          agency_support_embed_title?: string | null
          agency_support_subscription_id?: string | null
          agency_support_wallet?: number
          ai_chat_enabled?: boolean
          ai_embed_code?: string | null
          ai_questions_count?: number | null
          approval?: string | null
          billing_state?: string
          bonuses_phone?: string | null
          branded_ai_support?: boolean
          branding_presets?: Json
          branding_suspended_at?: string | null
          branding_tool_access?: boolean
          branding_tool_purchased_at?: string | null
          cancel_access_until?: string | null
          cancel_claim_key?: string | null
          checkout_page?: string | null
          client_hub_enabled?: boolean
          created_at?: string
          custom_ai_general_help_enabled?: boolean
          custom_domain?: string | null
          custom_domain_access?: boolean
          custom_domain_live?: boolean
          custom_domain_submitted_at?: string | null
          custom_domain_went_live_at?: string | null
          customer_language?: string
          customer_replies_webhook_url?: string | null
          customer_updates_webhook_url?: string | null
          dynamic_installation?: boolean
          email?: string | null
          email_warmup_access?: boolean
          email_warmup_credits?: number
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          free_leads_access?: boolean
          full_name?: string | null
          gclid?: string | null
          generated_css?: string | null
          generated_css_backup?: string | null
          guest_access_until?: string | null
          hide_bonuses?: boolean
          highlevel_experience?: string | null
          hub_welcome_email_queued_at?: string | null
          hub_welcome_email_sent_at?: string | null
          human_chat_enabled?: boolean
          human_chat_mode?: string
          id?: number
          inbound_reply_key?: string
          initial_questions_completed?: boolean | null
          install_confirmed_at?: string | null
          install_guide_sent_at?: string | null
          is_affiliate?: boolean
          kb_headline?: string | null
          kb_logo_url?: string | null
          knowledge_base_enabled?: boolean
          landing_page?: string | null
          language?: string
          last_accessed?: string | null
          last_device?: string | null
          last_fbclid?: string | null
          last_followup_email_sent_at?: string | null
          last_gclid?: string | null
          last_incomplete_step_id?: string | null
          last_landing_page?: string | null
          last_login_at?: string | null
          last_onboarding_session_id?: string | null
          last_referrer?: string | null
          last_touch_at?: string | null
          last_utm_campaign?: string | null
          last_utm_content?: string | null
          last_utm_id?: string | null
          last_utm_medium?: string | null
          last_utm_source?: string | null
          last_utm_term?: string | null
          login_count?: number | null
          login_enabled?: boolean
          login_welcome_headline?: string | null
          login_welcome_subheadline?: string | null
          login_with?: string
          max_onboarding_users?: number | null
          mobile_branding_enabled?: boolean
          mobile_menu_color?: string
          mobile_zoom_enabled?: boolean
          most_used_feature?: string | null
          notify_all_chats?: boolean
          notify_all_tickets?: boolean
          notify_assigned_tickets?: boolean
          onboarding_autopay?: boolean
          onboarding_autopay_consent_at?: string | null
          onboarding_call_access?: boolean
          onboarding_call_wallet?: number
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          onboarding_deployment_configured?: boolean
          onboarding_deployment_mode?: string
          onboarding_deployment_plans?: string[]
          onboarding_deployment_users?: string[]
          onboarding_intent?: string | null
          onboarding_reminder_dismissed?: boolean
          onboarding_skipped?: boolean
          onboarding_skipped_at?: string | null
          onboarding_started_at?: string | null
          onboarding_step?: number | null
          onboarding_stripe_customer_id?: string | null
          onboarding_stripe_payment_method_id?: string | null
          original_agency_id?: string | null
          original_agency_id_advanced?: string | null
          original_agency_id_basic?: string | null
          original_agency_id_elite?: string | null
          payment_failed_at?: string | null
          payment_failure_count?: number
          payment_grace_until?: string | null
          plan?: Database["public"]["Enums"]["plan_type"]
          plan_before_delinquency?: string | null
          popup_enabled?: boolean
          premium_support?: boolean
          premium_support_started_at?: string | null
          primary_color?: string | null
          referrer?: string | null
          secondary_color?: string | null
          show_chat_widget?: boolean | null
          show_v2_ui?: boolean
          signup_device?: string | null
          snapshot_access?: boolean
          source?: string | null
          support_email_alerts?: Json
          support_ticketing_enabled?: boolean
          support_updates_webhook_url?: string | null
          support_webhook_url?: string | null
          tertiary_color?: string | null
          tickets_opened_count?: number | null
          tips_bot_enabled?: boolean
          top_nav_widget_color_mode?: string
          top_nav_widget_custom_color?: string | null
          top_nav_widget_enabled?: boolean
          top_nav_widget_icon_color_mode?: string | null
          top_nav_widget_icon_custom_color?: string | null
          top_nav_widget_label?: string
          top_nav_widget_options?: Json | null
          top_nav_widget_tile_color_mode?: string | null
          top_nav_widget_tile_custom_color?: string | null
          total_watch_time_seconds?: number | null
          trial_length?: number
          trial_source?: string | null
          trial_start_date?: string | null
          use_agency_name_url?: boolean | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          v2_navigation_enabled?: boolean
          videos_skipped_count?: number | null
          videos_watched_count?: number | null
          weekly_login_count?: number | null
          weekly_login_reset_at?: string | null
          welcome_ai_email_sent_at?: string | null
          welcome_email_attempts?: number
          welcome_email_claimed_at?: string | null
          welcome_email_force?: boolean
          welcome_email_last_error?: string | null
          welcome_email_next_attempt_at?: string | null
          white_label_domain?: string | null
        }
        Relationships: []
      }
      setup_tracker_accounts: {
        Row: {
          account_name: string
          agency_name: string | null
          contact_email: string | null
          contact_name: string | null
          created_at: string
          evidence: string | null
          ghl_agency_id: string | null
          ghl_location_id: string | null
          id: string
          last_contact_at: string | null
          last_contact_note: string | null
          saas_suite_user_id: number | null
          setup_status: string
          source: string
          status_detail: string | null
          updated_at: string
        }
        Insert: {
          account_name: string
          agency_name?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          evidence?: string | null
          ghl_agency_id?: string | null
          ghl_location_id?: string | null
          id?: string
          last_contact_at?: string | null
          last_contact_note?: string | null
          saas_suite_user_id?: number | null
          setup_status?: string
          source?: string
          status_detail?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string
          agency_name?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          evidence?: string | null
          ghl_agency_id?: string | null
          ghl_location_id?: string | null
          id?: string
          last_contact_at?: string | null
          last_contact_note?: string | null
          saas_suite_user_id?: number | null
          setup_status?: string
          source?: string
          status_detail?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      signup_attribution_handoffs: {
        Row: {
          claimed_at: string | null
          created_at: string
          expires_at: string
          fbc: string | null
          fbclid: string | null
          fbp: string | null
          gclid: string | null
          landing_page: string | null
          referrer: string | null
          token: string
          utm_campaign: string | null
          utm_content: string | null
          utm_id: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          expires_at?: string
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          gclid?: string | null
          landing_page?: string | null
          referrer?: string | null
          token: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          expires_at?: string
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          gclid?: string | null
          landing_page?: string | null
          referrer?: string | null
          token?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      simple_page_settings: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          page_title: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          page_title?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          page_title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      simple_page_videos: {
        Row: {
          agency_id: string
          category_id: string | null
          created_at: string
          custom_video_id: string | null
          display_order: number
          id: string
          module_id: string | null
          source: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          category_id?: string | null
          created_at?: string
          custom_video_id?: string | null
          display_order?: number
          id?: string
          module_id?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          category_id?: string | null
          created_at?: string
          custom_video_id?: string | null
          display_order?: number
          id?: string
          module_id?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      simple_users: {
        Row: {
          created_at: string | null
          first_name: string
          id: string
          last_name: string
          username: string
        }
        Insert: {
          created_at?: string | null
          first_name: string
          id?: string
          last_name: string
          username: string
        }
        Update: {
          created_at?: string | null
          first_name?: string
          id?: string
          last_name?: string
          username?: string
        }
        Relationships: []
      }
      site_analytics_events: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string
          device: string | null
          duration_ms: number | null
          event_type: string
          fbclid: string | null
          gclid: string | null
          id: string
          ip_address: string | null
          is_app_page: boolean | null
          is_test: boolean
          label: string | null
          metadata: Json
          page_title: string | null
          path: string
          plan_type: string | null
          referrer: string | null
          region: string | null
          session_id: string | null
          session_replay_id: string | null
          user_email: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          value: number | null
          visitor_key: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          duration_ms?: number | null
          event_type?: string
          fbclid?: string | null
          gclid?: string | null
          id?: string
          ip_address?: string | null
          is_app_page?: boolean | null
          is_test?: boolean
          label?: string | null
          metadata?: Json
          page_title?: string | null
          path: string
          plan_type?: string | null
          referrer?: string | null
          region?: string | null
          session_id?: string | null
          session_replay_id?: string | null
          user_email?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          value?: number | null
          visitor_key?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          duration_ms?: number | null
          event_type?: string
          fbclid?: string | null
          gclid?: string | null
          id?: string
          ip_address?: string | null
          is_app_page?: boolean | null
          is_test?: boolean
          label?: string | null
          metadata?: Json
          page_title?: string | null
          path?: string
          plan_type?: string | null
          referrer?: string | null
          region?: string | null
          session_id?: string | null
          session_replay_id?: string | null
          user_email?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          value?: number | null
          visitor_key?: string | null
        }
        Relationships: []
      }
      slack_channel_agency_map: {
        Row: {
          agency_id: string
          alert_assigned_chat: boolean
          alert_assigned_ticket: boolean
          alert_assigned_updates: boolean
          alert_new_unassigned_chats: boolean
          alert_new_unassigned_tickets: boolean
          bot_token: string | null
          bot_user_id: string | null
          created_at: string
          created_by_email: string | null
          id: string
          inbound_webhook_token: string | null
          installed_at: string | null
          is_active: boolean
          label: string | null
          slack_channel_id: string
          slack_team_id: string
          team_domain: string | null
          updated_at: string
          webhook_url: string | null
          weekly_report_enabled: boolean
          weekly_report_last_sent_at: string | null
        }
        Insert: {
          agency_id: string
          alert_assigned_chat?: boolean
          alert_assigned_ticket?: boolean
          alert_assigned_updates?: boolean
          alert_new_unassigned_chats?: boolean
          alert_new_unassigned_tickets?: boolean
          bot_token?: string | null
          bot_user_id?: string | null
          created_at?: string
          created_by_email?: string | null
          id?: string
          inbound_webhook_token?: string | null
          installed_at?: string | null
          is_active?: boolean
          label?: string | null
          slack_channel_id: string
          slack_team_id: string
          team_domain?: string | null
          updated_at?: string
          webhook_url?: string | null
          weekly_report_enabled?: boolean
          weekly_report_last_sent_at?: string | null
        }
        Update: {
          agency_id?: string
          alert_assigned_chat?: boolean
          alert_assigned_ticket?: boolean
          alert_assigned_updates?: boolean
          alert_new_unassigned_chats?: boolean
          alert_new_unassigned_tickets?: boolean
          bot_token?: string | null
          bot_user_id?: string | null
          created_at?: string
          created_by_email?: string | null
          id?: string
          inbound_webhook_token?: string | null
          installed_at?: string | null
          is_active?: boolean
          label?: string | null
          slack_channel_id?: string
          slack_team_id?: string
          team_domain?: string | null
          updated_at?: string
          webhook_url?: string | null
          weekly_report_enabled?: boolean
          weekly_report_last_sent_at?: string | null
        }
        Relationships: []
      }
      slack_link_tokens: {
        Row: {
          agency_id: string
          agency_ids: string[]
          created_at: string
          email: string
          expires_at: string
          id: string
          token_hash: string
          used_at: string | null
          used_by_team_id: string | null
        }
        Insert: {
          agency_id: string
          agency_ids?: string[]
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          token_hash: string
          used_at?: string | null
          used_by_team_id?: string | null
        }
        Update: {
          agency_id?: string
          agency_ids?: string[]
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string | null
          used_by_team_id?: string | null
        }
        Relationships: []
      }
      slack_oauth_states: {
        Row: {
          agency_id: string
          created_at: string
          created_by_email: string | null
          expires_at: string
          id: string
          state: string
          used_at: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string
          created_by_email?: string | null
          expires_at?: string
          id?: string
          state: string
          used_at?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string
          created_by_email?: string | null
          expires_at?: string
          id?: string
          state?: string
          used_at?: string | null
        }
        Relationships: []
      }
      slack_workspace_links: {
        Row: {
          agency_id: string
          agency_ids: string[]
          created_at: string
          id: string
          last_used_at: string | null
          linked_by_email: string
          team_id: string
          team_name: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          agency_ids?: string[]
          created_at?: string
          id?: string
          last_used_at?: string | null
          linked_by_email: string
          team_id: string
          team_name?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          agency_ids?: string[]
          created_at?: string
          id?: string
          last_used_at?: string | null
          linked_by_email?: string
          team_id?: string
          team_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      store_subscriptions: {
        Row: {
          app_user_id: string | null
          created_at: string
          email: string
          entitlement: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          last_event: string | null
          plan: string | null
          premium_support: boolean
          product_id: string
          raw_event: Json | null
          store: string
          updated_at: string
        }
        Insert: {
          app_user_id?: string | null
          created_at?: string
          email: string
          entitlement?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_event?: string | null
          plan?: string | null
          premium_support?: boolean
          product_id?: string
          raw_event?: Json | null
          store?: string
          updated_at?: string
        }
        Update: {
          app_user_id?: string | null
          created_at?: string
          email?: string
          entitlement?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_event?: string | null
          plan?: string | null
          premium_support?: boolean
          product_id?: string
          raw_event?: Json | null
          store?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_assignment_settings: {
        Row: {
          created_at: string
          fallback_email: string | null
          mode: string
          owner_email: string
          person_email: string | null
          rr_cursor: number
          rr_members: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          fallback_email?: string | null
          mode?: string
          owner_email: string
          person_email?: string | null
          rr_cursor?: number
          rr_members?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          fallback_email?: string | null
          mode?: string
          owner_email?: string
          person_email?: string | null
          rr_cursor?: number
          rr_members?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      support_chat_assignments: {
        Row: {
          agency_id: string
          assigned_by: string | null
          assigned_to_email: string | null
          created_at: string
          id: string
          updated_at: string
          user_identifier: string
        }
        Insert: {
          agency_id: string
          assigned_by?: string | null
          assigned_to_email?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_identifier: string
        }
        Update: {
          agency_id?: string
          assigned_by?: string | null
          assigned_to_email?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_identifier?: string
        }
        Relationships: []
      }
      support_rep_applicants: {
        Row: {
          agreed_at: string
          created_at: string
          email: string
          final_report: Json | null
          final_score: number | null
          hours: Json
          id: string
          name: string | null
          phone: string | null
          slack_notify: boolean
          status: string
          timezone: string
          training_ends_at: string
          training_starts_at: string
          updated_at: string
          works_weekends: boolean
        }
        Insert: {
          agreed_at?: string
          created_at?: string
          email: string
          final_report?: Json | null
          final_score?: number | null
          hours?: Json
          id?: string
          name?: string | null
          phone?: string | null
          slack_notify?: boolean
          status?: string
          timezone?: string
          training_ends_at?: string
          training_starts_at?: string
          updated_at?: string
          works_weekends?: boolean
        }
        Update: {
          agreed_at?: string
          created_at?: string
          email?: string
          final_report?: Json | null
          final_score?: number | null
          hours?: Json
          id?: string
          name?: string | null
          phone?: string | null
          slack_notify?: boolean
          status?: string
          timezone?: string
          training_ends_at?: string
          training_starts_at?: string
          updated_at?: string
          works_weekends?: boolean
        }
        Relationships: []
      }
      support_rep_case_messages: {
        Row: {
          case_id: string
          content: string
          created_at: string
          grade: Json | null
          id: string
          role: string
        }
        Insert: {
          case_id: string
          content: string
          created_at?: string
          grade?: Json | null
          id?: string
          role: string
        }
        Update: {
          case_id?: string
          content?: string
          created_at?: string
          grade?: Json | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_rep_case_messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "support_rep_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      support_rep_cases: {
        Row: {
          applicant_id: string
          closed_at: string | null
          created_at: string
          delivered_at: string | null
          first_response_at: string | null
          grade: Json | null
          id: string
          mode: string
          question: string
          question_id: string | null
          response_minutes: number | null
          scheduled_at: string
          score: number | null
          status: string
          updated_at: string
        }
        Insert: {
          applicant_id: string
          closed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          first_response_at?: string | null
          grade?: Json | null
          id?: string
          mode?: string
          question: string
          question_id?: string | null
          response_minutes?: number | null
          scheduled_at: string
          score?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          applicant_id?: string
          closed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          first_response_at?: string | null
          grade?: Json | null
          id?: string
          mode?: string
          question?: string
          question_id?: string | null
          response_minutes?: number | null
          scheduled_at?: string
          score?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_rep_cases_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "support_rep_applicants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_rep_cases_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "support_rep_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      support_rep_login_codes: {
        Row: {
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          used_at: string | null
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          used_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          used_at?: string | null
        }
        Relationships: []
      }
      support_rep_questions: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          fingerprint: string
          id: string
          question: string
          source: string | null
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          fingerprint: string
          id?: string
          question: string
          source?: string | null
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          fingerprint?: string
          id?: string
          question?: string
          source?: string | null
        }
        Relationships: []
      }
      support_rep_sessions: {
        Row: {
          applicant_id: string
          created_at: string
          expires_at: string
          token: string
        }
        Insert: {
          applicant_id: string
          created_at?: string
          expires_at: string
          token: string
        }
        Update: {
          applicant_id?: string
          created_at?: string
          expires_at?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_rep_sessions_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "support_rep_applicants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_assign_rules: {
        Row: {
          agency_id: string
          assign_to_email: string
          created_at: string
          id: string
          issue_category: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          assign_to_email: string
          created_at?: string
          id?: string
          issue_category: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          assign_to_email?: string
          created_at?: string
          id?: string
          issue_category?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_ticket_replies: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_email: string | null
          sender_name: string | null
          sender_role: string
          ticket_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_email?: string | null
          sender_name?: string | null
          sender_role: string
          ticket_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_email?: string | null
          sender_name?: string | null
          sender_role?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_response: string | null
          admin_response_attachment_url: string | null
          agency_id: string
          ai_title: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_to: string | null
          attachment_url: string | null
          attachment_urls: string[]
          branding_notes: string | null
          bump_count: number
          business_goal: string | null
          created_at: string
          customer_email: string
          customer_name: string
          desired_timeline: string | null
          id: string
          industry: string | null
          issue_category: string
          last_bumped_at: string | null
          last_reminder_at: string | null
          project_type: string | null
          recording_url: string | null
          reference_links: string | null
          request_text: string
          responded_at: string | null
          responded_by: string | null
          responded_by_name: string | null
          source: string | null
          source_chat_identifier: string | null
          status: string
          support_tier: string
          ticket_number: number
          updated_at: string
        }
        Insert: {
          admin_response?: string | null
          admin_response_attachment_url?: string | null
          agency_id: string
          ai_title?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          attachment_url?: string | null
          attachment_urls?: string[]
          branding_notes?: string | null
          bump_count?: number
          business_goal?: string | null
          created_at?: string
          customer_email: string
          customer_name: string
          desired_timeline?: string | null
          id?: string
          industry?: string | null
          issue_category: string
          last_bumped_at?: string | null
          last_reminder_at?: string | null
          project_type?: string | null
          recording_url?: string | null
          reference_links?: string | null
          request_text: string
          responded_at?: string | null
          responded_by?: string | null
          responded_by_name?: string | null
          source?: string | null
          source_chat_identifier?: string | null
          status?: string
          support_tier?: string
          ticket_number?: number
          updated_at?: string
        }
        Update: {
          admin_response?: string | null
          admin_response_attachment_url?: string | null
          agency_id?: string
          ai_title?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          attachment_url?: string | null
          attachment_urls?: string[]
          branding_notes?: string | null
          bump_count?: number
          business_goal?: string | null
          created_at?: string
          customer_email?: string
          customer_name?: string
          desired_timeline?: string | null
          id?: string
          industry?: string | null
          issue_category?: string
          last_bumped_at?: string | null
          last_reminder_at?: string | null
          project_type?: string | null
          recording_url?: string | null
          reference_links?: string | null
          request_text?: string
          responded_at?: string | null
          responded_by?: string | null
          responded_by_name?: string | null
          source?: string | null
          source_chat_identifier?: string | null
          status?: string
          support_tier?: string
          ticket_number?: number
          updated_at?: string
        }
        Relationships: []
      }
      support_wins_cache: {
        Row: {
          cache_key: string
          generated_at: string
          payload: Json
        }
        Insert: {
          cache_key: string
          generated_at?: string
          payload: Json
        }
        Update: {
          cache_key?: string
          generated_at?: string
          payload?: Json
        }
        Relationships: []
      }
      team_reply_webhook_throttle: {
        Row: {
          agency_id: string | null
          id: string
          identifier: string
          last_sent_at: string
          source: string
        }
        Insert: {
          agency_id?: string | null
          id?: string
          identifier: string
          last_sent_at?: string
          source: string
        }
        Update: {
          agency_id?: string | null
          id?: string
          identifier?: string
          last_sent_at?: string
          source?: string
        }
        Relationships: []
      }
      text_requests: {
        Row: {
          created_at: string
          id: string
          name: string
          phone_number: string
          source: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          phone_number: string
          source?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone_number?: string
          source?: string
        }
        Relationships: []
      }
      theme_logos: {
        Row: {
          agency_id: string
          location_id: string
          logo_url: string | null
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          location_id: string
          logo_url?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          location_id?: string
          logo_url?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      theme_save_audit: {
        Row: {
          action: string
          agency_id: string
          created_at: string
          id: number
          location_id: string
          ok: boolean
          origin: string | null
          user_email: string | null
          user_id: string | null
          via: string
        }
        Insert: {
          action: string
          agency_id: string
          created_at?: string
          id?: never
          location_id: string
          ok: boolean
          origin?: string | null
          user_email?: string | null
          user_id?: string | null
          via: string
        }
        Update: {
          action?: string
          agency_id?: string
          created_at?: string
          id?: never
          location_id?: string
          ok?: boolean
          origin?: string | null
          user_email?: string | null
          user_id?: string | null
          via?: string
        }
        Relationships: []
      }
      training_doc_chunks: {
        Row: {
          agency_id: string
          chunk_index: number
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          tier: string
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          chunk_index: number
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          tier?: string
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          chunk_index?: number
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          tier?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_activity_sessions: {
        Row: {
          ai_analysis: Json | null
          created_at: string
          email_sent: boolean
          email_sent_at: string | null
          events: Json
          id: string
          session_ended_at: string | null
          session_started_at: string
          status: string
          updated_at: string
          user_email: string
        }
        Insert: {
          ai_analysis?: Json | null
          created_at?: string
          email_sent?: boolean
          email_sent_at?: string | null
          events?: Json
          id?: string
          session_ended_at?: string | null
          session_started_at?: string
          status?: string
          updated_at?: string
          user_email: string
        }
        Update: {
          ai_analysis?: Json | null
          created_at?: string
          email_sent?: boolean
          email_sent_at?: string | null
          events?: Json
          id?: string
          session_ended_at?: string | null
          session_started_at?: string
          status?: string
          updated_at?: string
          user_email?: string
        }
        Relationships: []
      }
      user_auth_status: {
        Row: {
          approval: string
          created_at: string
          has_password: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approval?: string
          created_at?: string
          has_password?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approval?: string
          created_at?: string
          has_password?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_dismissed_tips: {
        Row: {
          dismissed_at: string
          id: string
          tip_id: string
          user_email: string
        }
        Insert: {
          dismissed_at?: string
          id?: string
          tip_id: string
          user_email: string
        }
        Update: {
          dismissed_at?: string
          id?: string
          tip_id?: string
          user_email?: string
        }
        Relationships: []
      }
      user_onboarding_checklist_completion: {
        Row: {
          agency_id: string
          checklist_item_id: string
          completed_at: string
          id: string
          user_identifier: string
        }
        Insert: {
          agency_id: string
          checklist_item_id: string
          completed_at?: string
          id?: string
          user_identifier: string
        }
        Update: {
          agency_id?: string
          checklist_item_id?: string
          completed_at?: string
          id?: string
          user_identifier?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_onboarding_checklist_completion_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "agency_onboarding_checklist"
            referencedColumns: ["id"]
          },
        ]
      }
      user_onboarding_responses: {
        Row: {
          active_subaccounts: string
          created_at: string
          highlevel_experience: string
          id: string
          most_used_feature: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_subaccounts: string
          created_at?: string
          highlevel_experience: string
          id?: string
          most_used_feature: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_subaccounts?: string
          created_at?: string
          highlevel_experience?: string
          id?: string
          most_used_feature?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_progress: {
        Row: {
          agency_id: string | null
          approval: string | null
          avatar_url: string | null
          checklist_minimized: boolean | null
          created_at: string
          email: string | null
          id: string
          last_accessed: string | null
          name: string | null
          phone: string | null
        }
        Insert: {
          agency_id?: string | null
          approval?: string | null
          avatar_url?: string | null
          checklist_minimized?: boolean | null
          created_at?: string
          email?: string | null
          id?: string
          last_accessed?: string | null
          name?: string | null
          phone?: string | null
        }
        Update: {
          agency_id?: string | null
          approval?: string | null
          avatar_url?: string | null
          checklist_minimized?: boolean | null
          created_at?: string
          email?: string | null
          id?: string
          last_accessed?: string | null
          name?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      user_tool_data: {
        Row: {
          created_at: string
          id: string
          tool_data: Json
          tool_name: string
          updated_at: string
          user_email: string
        }
        Insert: {
          created_at?: string
          id?: string
          tool_data?: Json
          tool_name: string
          updated_at?: string
          user_email: string
        }
        Update: {
          created_at?: string
          id?: string
          tool_data?: Json
          tool_name?: string
          updated_at?: string
          user_email?: string
        }
        Relationships: []
      }
      v2_home_settings: {
        Row: {
          agency_id: string
          ai_chat_enabled: boolean
          ai_chat_icon_url: string | null
          ai_chat_name: string | null
          ai_chat_type: string
          announcements_enabled: boolean
          announcements_headline: string | null
          announcements_image_url: string | null
          announcements_paragraph: string | null
          checklist_title: string
          created_at: string
          custom_link_1_color: string | null
          custom_link_1_open_as_popup: boolean
          custom_link_1_text: string | null
          custom_link_1_url: string | null
          custom_link_2_color: string | null
          custom_link_2_open_as_popup: boolean
          custom_link_2_text: string | null
          custom_link_2_url: string | null
          custom_link_3_color: string | null
          custom_link_3_open_as_popup: boolean
          custom_link_3_text: string | null
          custom_link_3_url: string | null
          custom_links_enabled: boolean
          daily_checklist_enabled: boolean
          default_landing_page: string | null
          education_page_enabled: boolean
          home_page_enabled: boolean
          id: string
          next_steps_custom_text: string | null
          next_steps_custom_url: string | null
          next_steps_custom_url_label: string | null
          next_steps_enabled: boolean
          next_steps_priority: string
          prompt_additional_instructions: string | null
          prompt_goals: string | null
          prompt_personality: string | null
          prompt_training_doc: string | null
          support_button_1_color: string | null
          support_button_1_open_as_popup: boolean
          support_button_1_text: string | null
          support_button_1_url: string | null
          support_button_2_color: string | null
          support_button_2_open_as_popup: boolean
          support_button_2_text: string | null
          support_button_2_url: string | null
          support_button_3_color: string | null
          support_button_3_open_as_popup: boolean
          support_button_3_text: string | null
          support_button_3_url: string | null
          support_headline: string | null
          support_page_enabled: boolean
          support_subheadline: string | null
          tab_name_education: string | null
          tab_name_home: string | null
          tab_name_support: string | null
          updated_at: string
          welcome_enabled: boolean
          welcome_headline: string
          welcome_subheadline: string
          welcome_video_custom_video_id: string | null
          welcome_video_enabled: boolean
          welcome_video_is_embed: boolean
          welcome_video_library_category_id: string | null
          welcome_video_library_module_id: string | null
          welcome_video_source: string
          welcome_video_thumbnail_url: string | null
          welcome_video_url: string | null
        }
        Insert: {
          agency_id: string
          ai_chat_enabled?: boolean
          ai_chat_icon_url?: string | null
          ai_chat_name?: string | null
          ai_chat_type?: string
          announcements_enabled?: boolean
          announcements_headline?: string | null
          announcements_image_url?: string | null
          announcements_paragraph?: string | null
          checklist_title?: string
          created_at?: string
          custom_link_1_color?: string | null
          custom_link_1_open_as_popup?: boolean
          custom_link_1_text?: string | null
          custom_link_1_url?: string | null
          custom_link_2_color?: string | null
          custom_link_2_open_as_popup?: boolean
          custom_link_2_text?: string | null
          custom_link_2_url?: string | null
          custom_link_3_color?: string | null
          custom_link_3_open_as_popup?: boolean
          custom_link_3_text?: string | null
          custom_link_3_url?: string | null
          custom_links_enabled?: boolean
          daily_checklist_enabled?: boolean
          default_landing_page?: string | null
          education_page_enabled?: boolean
          home_page_enabled?: boolean
          id?: string
          next_steps_custom_text?: string | null
          next_steps_custom_url?: string | null
          next_steps_custom_url_label?: string | null
          next_steps_enabled?: boolean
          next_steps_priority?: string
          prompt_additional_instructions?: string | null
          prompt_goals?: string | null
          prompt_personality?: string | null
          prompt_training_doc?: string | null
          support_button_1_color?: string | null
          support_button_1_open_as_popup?: boolean
          support_button_1_text?: string | null
          support_button_1_url?: string | null
          support_button_2_color?: string | null
          support_button_2_open_as_popup?: boolean
          support_button_2_text?: string | null
          support_button_2_url?: string | null
          support_button_3_color?: string | null
          support_button_3_open_as_popup?: boolean
          support_button_3_text?: string | null
          support_button_3_url?: string | null
          support_headline?: string | null
          support_page_enabled?: boolean
          support_subheadline?: string | null
          tab_name_education?: string | null
          tab_name_home?: string | null
          tab_name_support?: string | null
          updated_at?: string
          welcome_enabled?: boolean
          welcome_headline?: string
          welcome_subheadline?: string
          welcome_video_custom_video_id?: string | null
          welcome_video_enabled?: boolean
          welcome_video_is_embed?: boolean
          welcome_video_library_category_id?: string | null
          welcome_video_library_module_id?: string | null
          welcome_video_source?: string
          welcome_video_thumbnail_url?: string | null
          welcome_video_url?: string | null
        }
        Update: {
          agency_id?: string
          ai_chat_enabled?: boolean
          ai_chat_icon_url?: string | null
          ai_chat_name?: string | null
          ai_chat_type?: string
          announcements_enabled?: boolean
          announcements_headline?: string | null
          announcements_image_url?: string | null
          announcements_paragraph?: string | null
          checklist_title?: string
          created_at?: string
          custom_link_1_color?: string | null
          custom_link_1_open_as_popup?: boolean
          custom_link_1_text?: string | null
          custom_link_1_url?: string | null
          custom_link_2_color?: string | null
          custom_link_2_open_as_popup?: boolean
          custom_link_2_text?: string | null
          custom_link_2_url?: string | null
          custom_link_3_color?: string | null
          custom_link_3_open_as_popup?: boolean
          custom_link_3_text?: string | null
          custom_link_3_url?: string | null
          custom_links_enabled?: boolean
          daily_checklist_enabled?: boolean
          default_landing_page?: string | null
          education_page_enabled?: boolean
          home_page_enabled?: boolean
          id?: string
          next_steps_custom_text?: string | null
          next_steps_custom_url?: string | null
          next_steps_custom_url_label?: string | null
          next_steps_enabled?: boolean
          next_steps_priority?: string
          prompt_additional_instructions?: string | null
          prompt_goals?: string | null
          prompt_personality?: string | null
          prompt_training_doc?: string | null
          support_button_1_color?: string | null
          support_button_1_open_as_popup?: boolean
          support_button_1_text?: string | null
          support_button_1_url?: string | null
          support_button_2_color?: string | null
          support_button_2_open_as_popup?: boolean
          support_button_2_text?: string | null
          support_button_2_url?: string | null
          support_button_3_color?: string | null
          support_button_3_open_as_popup?: boolean
          support_button_3_text?: string | null
          support_button_3_url?: string | null
          support_headline?: string | null
          support_page_enabled?: boolean
          support_subheadline?: string | null
          tab_name_education?: string | null
          tab_name_home?: string | null
          tab_name_support?: string | null
          updated_at?: string
          welcome_enabled?: boolean
          welcome_headline?: string
          welcome_subheadline?: string
          welcome_video_custom_video_id?: string | null
          welcome_video_enabled?: boolean
          welcome_video_is_embed?: boolean
          welcome_video_library_category_id?: string | null
          welcome_video_library_module_id?: string | null
          welcome_video_source?: string
          welcome_video_thumbnail_url?: string | null
          welcome_video_url?: string | null
        }
        Relationships: []
      }
      webinar_ad_entities: {
        Row: {
          adset_name: string | null
          campaign_name: string | null
          clicks: number
          cpc: number | null
          cpl: number | null
          cpm: number | null
          created_at: string
          ctr: number | null
          id: string
          impressions: number
          leads: number
          level: string
          name: string
          purchases: number
          registrations: number
          revenue: number
          roas: number | null
          snapshot_id: string
          spend: number
          status: string | null
          thumbnail_url: string | null
        }
        Insert: {
          adset_name?: string | null
          campaign_name?: string | null
          clicks?: number
          cpc?: number | null
          cpl?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          id?: string
          impressions?: number
          leads?: number
          level: string
          name: string
          purchases?: number
          registrations?: number
          revenue?: number
          roas?: number | null
          snapshot_id: string
          spend?: number
          status?: string | null
          thumbnail_url?: string | null
        }
        Update: {
          adset_name?: string | null
          campaign_name?: string | null
          clicks?: number
          cpc?: number | null
          cpl?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          id?: string
          impressions?: number
          leads?: number
          level?: string
          name?: string
          purchases?: number
          registrations?: number
          revenue?: number
          roas?: number | null
          snapshot_id?: string
          spend?: number
          status?: string | null
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webinar_ad_entities_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "webinar_ad_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      webinar_ad_snapshots: {
        Row: {
          clicks: number
          cpc: number | null
          cpl: number | null
          cpm: number | null
          created_at: string
          ctr: number | null
          id: string
          impressions: number
          leads: number
          notes: string | null
          purchases: number
          raw: Json | null
          reach: number
          registrations: number
          revenue: number
          roas: number | null
          snapshot_date: string
          source: string
          spend: number
          updated_at: string
        }
        Insert: {
          clicks?: number
          cpc?: number | null
          cpl?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          id?: string
          impressions?: number
          leads?: number
          notes?: string | null
          purchases?: number
          raw?: Json | null
          reach?: number
          registrations?: number
          revenue?: number
          roas?: number | null
          snapshot_date: string
          source?: string
          spend?: number
          updated_at?: string
        }
        Update: {
          clicks?: number
          cpc?: number | null
          cpl?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          id?: string
          impressions?: number
          leads?: number
          notes?: string | null
          purchases?: number
          raw?: Json | null
          reach?: number
          registrations?: number
          revenue?: number
          roas?: number | null
          snapshot_date?: string
          source?: string
          spend?: number
          updated_at?: string
        }
        Relationships: []
      }
      webinar_confirmation_steps: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          page: string | null
          step: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          page?: string | null
          step: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          page?: string | null
          step?: string
        }
        Relationships: []
      }
      webinar_funnel_purchases: {
        Row: {
          amount: number
          created_at: string
          customer_email: string | null
          customer_label: string | null
          id: string
          interval: string
          note: string | null
          purchased_at: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          customer_email?: string | null
          customer_label?: string | null
          id?: string
          interval?: string
          note?: string | null
          purchased_at?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_email?: string | null
          customer_label?: string | null
          id?: string
          interval?: string
          note?: string | null
          purchased_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      webinar_registrations: {
        Row: {
          attendance_status: string | null
          attended: boolean
          attended_at: string | null
          capi_sent_at: string | null
          created_at: string
          do_you_have_highlevel: string | null
          duplicate_of: string | null
          email: string
          fbc: string | null
          fbclid: string | null
          fbp: string | null
          first_name: string | null
          followup_note: string | null
          forward_status: string | null
          forwarded_at: string | null
          id: string
          is_test: boolean
          landing_page: string | null
          last_name: string | null
          max_retention_pct: number
          needs_followup: boolean
          offer_click_context: string | null
          offer_clicked: boolean
          offer_clicked_at: string | null
          page_url: string | null
          phone: string | null
          pixel_claimed_at: string | null
          referrer: string | null
          retention_updated_at: string | null
          session_date_text: string | null
          updated_at: string
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          watch_seconds: number | null
          watched_replay: boolean
          webinar_id: string | null
        }
        Insert: {
          attendance_status?: string | null
          attended?: boolean
          attended_at?: string | null
          capi_sent_at?: string | null
          created_at?: string
          do_you_have_highlevel?: string | null
          duplicate_of?: string | null
          email: string
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          first_name?: string | null
          followup_note?: string | null
          forward_status?: string | null
          forwarded_at?: string | null
          id?: string
          is_test?: boolean
          landing_page?: string | null
          last_name?: string | null
          max_retention_pct?: number
          needs_followup?: boolean
          offer_click_context?: string | null
          offer_clicked?: boolean
          offer_clicked_at?: string | null
          page_url?: string | null
          phone?: string | null
          pixel_claimed_at?: string | null
          referrer?: string | null
          retention_updated_at?: string | null
          session_date_text?: string | null
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          watch_seconds?: number | null
          watched_replay?: boolean
          webinar_id?: string | null
        }
        Update: {
          attendance_status?: string | null
          attended?: boolean
          attended_at?: string | null
          capi_sent_at?: string | null
          created_at?: string
          do_you_have_highlevel?: string | null
          duplicate_of?: string | null
          email?: string
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          first_name?: string | null
          followup_note?: string | null
          forward_status?: string | null
          forwarded_at?: string | null
          id?: string
          is_test?: boolean
          landing_page?: string | null
          last_name?: string | null
          max_retention_pct?: number
          needs_followup?: boolean
          offer_click_context?: string | null
          offer_clicked?: boolean
          offer_clicked_at?: string | null
          page_url?: string | null
          phone?: string | null
          pixel_claimed_at?: string | null
          referrer?: string | null
          retention_updated_at?: string | null
          session_date_text?: string | null
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          watch_seconds?: number | null
          watched_replay?: boolean
          webinar_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webinar_registrations_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "webinar_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      webinar_retention_events: {
        Row: {
          created_at: string
          email: string
          id: string
          milestone: number
          occurred_at: string
          registration_id: string | null
          session_date_text: string | null
          source: string | null
          watch_seconds: number | null
          webinar_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          milestone: number
          occurred_at?: string
          registration_id?: string | null
          session_date_text?: string | null
          source?: string | null
          watch_seconds?: number | null
          webinar_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          milestone?: number
          occurred_at?: string
          registration_id?: string | null
          session_date_text?: string | null
          source?: string | null
          watch_seconds?: number | null
          webinar_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webinar_retention_events_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "webinar_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      welcome_email_cron_auth: {
        Row: {
          created_at: string
          id: number
          secret: string
        }
        Insert: {
          created_at?: string
          id?: number
          secret: string
        }
        Update: {
          created_at?: string
          id?: number
          secret?: string
        }
        Relationships: []
      }
      workflows: {
        Row: {
          agency_id: string
          created_at: string
          enabled: boolean
          id: string
          slack_enabled: boolean
          trigger_type: string
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          slack_enabled?: boolean
          trigger_type: string
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          slack_enabled?: boolean
          trigger_type?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _slack_auto_dispatch: {
        Args: { _agency_id: string; _data: Json; _event_type: string }
        Returns: undefined
      }
      _support_assignee_dispatch: {
        Args: { _data: Json; _event: string }
        Returns: undefined
      }
      _support_updates_webhook_dispatch: {
        Args: { _payload: Json }
        Returns: undefined
      }
      add_agency_support_seats: {
        Args: { _amount: number; _email: string }
        Returns: {
          agency_support_wallet: number
          email: string
        }[]
      }
      add_customer_support_reply: {
        Args: {
          p_agency_id: string
          p_body: string
          p_customer_email: string
          p_customer_name: string
          p_ticket_id: string
        }
        Returns: string
      }
      add_onboarding_calls: {
        Args: { _amount: number; _email: string }
        Returns: {
          email: string
          onboarding_call_access: boolean
          onboarding_call_wallet: number
        }[]
      }
      admin_accept_invitation: {
        Args: { p_admin_email: string }
        Returns: boolean
      }
      admin_kit_customers: { Args: never; Returns: Json }
      admin_list_agency_support_accounts: {
        Args: never
        Returns: {
          agency_id: string
          assigned: number
          clients: Json
          owner_email: string
          owner_name: string
          plan: string
          seats: number
          white_label_domain: string
        }[]
      }
      admin_list_agency_support_messages: {
        Args: { p_limit?: number }
        Returns: {
          agency_id: string
          agency_name: string
          attachment_url: string
          body: string
          client_email: string
          created_at: string
          full_name: string
          id: string
          owner_email: string
          sender_name: string
          sender_role: string
        }[]
      }
      admin_send_agency_support_message: {
        Args: {
          p_attachment_url?: string
          p_body: string
          p_client_email: string
          p_sender_name?: string
        }
        Returns: string
      }
      affiliate_page_funnel_stats: {
        Args: {
          p_funnel_key: string
          p_page_path: string
          p_since: string
          p_until: string
        }
        Returns: Json
      }
      affiliate_portal_series: {
        Args: {
          p_affiliate_id: string
          p_page_paths: string[]
          p_since: string
          p_slug: string
          p_until: string
        }
        Returns: Json
      }
      agency_billing_state: { Args: { p_agency_id: string }; Returns: string }
      agency_ids_for_email: { Args: { user_email: string }; Returns: string[] }
      apply_store_subscription: {
        Args: {
          p_active: boolean
          p_app_user_id: string
          p_email: string
          p_entitlement: string
          p_event: string
          p_expires: string
          p_plan: string
          p_premium: boolean
          p_product_id: string
          p_raw: Json
          p_store: string
        }
        Returns: Json
      }
      ban_user_from_page: {
        Args: {
          p_agency_id: string
          p_reason?: string
          p_user_identifier: string
        }
        Returns: boolean
      }
      bump_support_ticket: {
        Args: {
          p_customer_email?: string
          p_customer_name?: string
          p_ticket_id: string
        }
        Returns: Json
      }
      can_access_affiliate: {
        Args: { p_affiliate_id: string }
        Returns: boolean
      }
      can_access_agency: { Args: { p_agency_id: string }; Returns: boolean }
      can_access_owner_email: {
        Args: { p_owner_email: string }
        Returns: boolean
      }
      can_manage_agency_message: {
        Args: { _agency_id: string }
        Returns: boolean
      }
      can_select_support_ticket_reply: {
        Args: { p_ticket_id: string }
        Returns: boolean
      }
      cancel_user_access: { Args: { user_email: string }; Returns: boolean }
      challenge_my_point_reviews: {
        Args: { _owner_email: string }
        Returns: {
          completion_ids: string[]
          created_at: string
          ended_at: string
          entry_id: string
          id: string
          module_ids: string[]
          reason: string
          reviewed_at: string
          started_at: string
          updated_at: string
          user_id: string
          user_name: string
        }[]
        SetofOptions: {
          from: "*"
          to: "challenge_point_reviews"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      challenge_suspicious_bursts: {
        Args: { _from: string; _until: string }
        Returns: {
          completion_ids: string[]
          ended_at: string
          entry_id: string
          module_ids: string[]
          started_at: string
          user_id: string
          user_name: string
        }[]
      }
      check_agency_at_capacity: {
        Args: {
          p_agency_id: string
          p_user_email?: string
          p_user_name?: string
        }
        Returns: boolean
      }
      check_agency_name_available: {
        Args: { name_to_check: string }
        Returns: boolean
      }
      check_ai_rate_limit: {
        Args: {
          p_max_requests?: number
          p_user_identifier: string
          p_window_hours?: number
        }
        Returns: Json
      }
      claim_ghl_email: { Args: { p_key: string }; Returns: boolean }
      claim_one_feature_kit_action: {
        Args: { p_key: string }
        Returns: boolean
      }
      claim_signup_attribution: { Args: { p_token: string }; Returns: boolean }
      claim_subscription_canceled_message: {
        Args: {
          p_detail: string
          p_metadata: Json
          p_provider_message_id: string
          p_source: string
          p_status: string
          p_user_email: string
        }
        Returns: {
          channel: string
          created_at: string
          detail: string | null
          id: string
          metadata: Json
          provider: string | null
          provider_message_id: string | null
          source: string
          status: string
          status_at: string
          subject: string | null
          template_key: string | null
          updated_at: string
          user_email: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "customer_message_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      classify_chat_text: { Args: { p_text: string }; Returns: string }
      cleanup_account_for_deletion: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      cleanup_account_for_deletion_base: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      clear_payment_delinquency: {
        Args: { p_plan?: string; user_email: string }
        Returns: Json
      }
      community_can_view_thread: {
        Args: { _thread_id: string }
        Returns: boolean
      }
      community_ensure_profile: {
        Args: { _avatar_url?: string; _display_name?: string }
        Returns: {
          active_subaccounts: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          email: string | null
          handle: string | null
          highlevel_experience: string | null
          id: string
          is_verified: boolean
          joined_at: string | null
          post_count: number
          role: Database["public"]["Enums"]["community_role"]
          show_account_count: boolean
          tier: Database["public"]["Enums"]["community_tier"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "community_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      community_generate_handle: { Args: { _base: string }; Returns: string }
      community_handle_available: {
        Args: { _handle: string }
        Returns: boolean
      }
      community_increment_install: {
        Args: { _snapshot_id: string }
        Returns: number
      }
      community_is_staff: { Args: never; Returns: boolean }
      community_join:
        | {
            Args: {
              _active_subaccounts?: string
              _bio?: string
              _display_name?: string
              _highlevel_experience?: string
              _show_account_count?: boolean
            }
            Returns: {
              active_subaccounts: string | null
              avatar_url: string | null
              bio: string | null
              created_at: string
              display_name: string
              email: string | null
              handle: string | null
              highlevel_experience: string | null
              id: string
              is_verified: boolean
              joined_at: string | null
              post_count: number
              role: Database["public"]["Enums"]["community_role"]
              show_account_count: boolean
              tier: Database["public"]["Enums"]["community_tier"]
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "community_profiles"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              _active_subaccounts?: string
              _avatar_url?: string
              _bio?: string
              _display_name?: string
              _handle?: string
              _highlevel_experience?: string
              _show_account_count?: boolean
            }
            Returns: {
              active_subaccounts: string | null
              avatar_url: string | null
              bio: string | null
              created_at: string
              display_name: string
              email: string | null
              handle: string | null
              highlevel_experience: string | null
              id: string
              is_verified: boolean
              joined_at: string | null
              post_count: number
              role: Database["public"]["Enums"]["community_role"]
              show_account_count: boolean
              tier: Database["public"]["Enums"]["community_tier"]
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "community_profiles"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      community_my_tier: {
        Args: never
        Returns: Database["public"]["Enums"]["community_tier"]
      }
      community_normalize_handle: { Args: { _raw: string }; Returns: string }
      community_onboarding_prefill: {
        Args: never
        Returns: {
          active_subaccounts: string
          display_name: string
          highlevel_experience: string
          most_used_feature: string
        }[]
      }
      community_post_announcement: {
        Args: { _body: string; _pin?: boolean; _title?: string }
        Returns: string
      }
      community_tier_ok: {
        Args: { _min: Database["public"]["Enums"]["community_tier"] }
        Returns: boolean
      }
      consume_email_warmup_credit: {
        Args: { p_email: string }
        Returns: number
      }
      consume_onboarding_call: {
        Args: { _amount?: number; _email: string }
        Returns: {
          access_enabled: boolean
          new_wallet: number
        }[]
      }
      consume_onboarding_call_by_agency: {
        Args: { _agency_id: string; _amount?: number }
        Returns: {
          access_enabled: boolean
          new_wallet: number
          owner_email: string
        }[]
      }
      consume_onboarding_call_by_lookup: {
        Args: { _amount?: number; _email: string; _name?: string }
        Returns: {
          access_enabled: boolean
          agency_id: string
          matched_by: string
          new_wallet: number
          owner_email: string
          owner_name: string
        }[]
      }
      consume_recorded_onboarding_call: {
        Args: { p_call_id: string }
        Returns: number
      }
      create_agency_support_request: {
        Args: {
          p_agency_id: string
          p_attachment_url?: string
          p_branding_notes?: string
          p_business_goal?: string
          p_customer_email: string
          p_customer_name: string
          p_desired_timeline?: string
          p_industry?: string
          p_project_type: string
          p_recording_url?: string
          p_reference_links?: string
          p_request_text: string
        }
        Returns: number
      }
      create_agency_version_safe: {
        Args: { user_email: string; version_type: string }
        Returns: string
      }
      create_guest_user: { Args: { p_agency_id: string }; Returns: string }
      create_support_ticket: {
        Args: {
          p_agency_id: string
          p_ai_title?: string
          p_attachment_url?: string
          p_customer_email: string
          p_customer_name: string
          p_issue_category: string
          p_recording_url?: string
          p_request_text: string
        }
        Returns: number
      }
      create_user_progress_safe: {
        Args: { user_email: string }
        Returns: string
      }
      create_user_progress_safe_with_name: {
        Args: { user_email?: string; user_name?: string }
        Returns: string
      }
      current_auth_email: { Args: never; Returns: string }
      customer_timeline: {
        Args: { p_email: string }
        Returns: {
          detail: string
          email: string
          event_type: string
          occurred_at: string
          source: string
          status: string
          title: string
        }[]
      }
      delete_agency_client: { Args: { p_user_id: string }; Returns: boolean }
      delete_agency_support_client: {
        Args: { _client_email: string; _owner_email: string }
        Returns: Json
      }
      delete_agency_video_setting: {
        Args: {
          agency_id_param: string
          category_id_param: string
          module_id_param: string
          tier_param: string
        }
        Returns: boolean
      }
      delete_user_tool_data_safe: {
        Args: { tool_name: string; user_email: string }
        Returns: boolean
      }
      expired_cancel_access_users: {
        Args: never
        Returns: {
          cancel_access_until: string
          email: string
        }[]
      }
      expired_payment_grace_users: {
        Args: never
        Returns: {
          email: string
          payment_failure_count: number
          payment_grace_until: string
        }[]
      }
      find_agency_by_domain: {
        Args: never
        Returns: {
          agency_name: string
          domain: string
          owner_email: string
        }[]
      }
      find_onboarding_owner: {
        Args: { _email: string; _name?: string }
        Returns: {
          agency_id: string
          matched_by: string
          onboarding_autopay: boolean
          owner_email: string
          owner_name: string
          stripe_customer_id: string
          stripe_payment_method_id: string
        }[]
      }
      get_advanced_agency_ids: { Args: never; Returns: string[] }
      get_agency_chat_config: {
        Args: { p_agency_id: string }
        Returns: {
          ai_chat_enabled: boolean
          human_chat_enabled: boolean
          human_chat_mode: string
          support_ticketing_enabled: boolean
        }[]
      }
      get_agency_clients: {
        Args: { p_agency_id: string }
        Returns: {
          last_accessed: string
          login_count: number
          user_email: string
          user_id: string
          user_name: string
        }[]
      }
      get_agency_info: {
        Args: { lookup_agency_id: string }
        Returns: {
          agency_id: string
          created_at: string
          kb_logo_url: string
          onboarding_call_access: boolean
          onboarding_call_wallet: number
          onboarding_deployment_configured: boolean
          onboarding_deployment_mode: string
          onboarding_deployment_plans: string[]
          onboarding_deployment_users: string[]
          plan: string
          popup_enabled: boolean
          primary_color: string
          secondary_color: string
          show_chat_widget: boolean
          support_ticketing_enabled: boolean
          tertiary_color: string
          tier: string
        }[]
      }
      get_agency_login_preference: {
        Args: { agency_id_param: string }
        Returns: string
      }
      get_agency_login_settings: {
        Args: { p_agency_id: string }
        Returns: {
          login_enabled: boolean
          login_welcome_headline: string
          login_welcome_subheadline: string
          login_with: string
          primary_color: string
        }[]
      }
      get_agency_onboarding_checklist: {
        Args: { lookup_agency_id: string }
        Returns: {
          description: string
          id: string
          item_order: number
          link_to: string
          link_url: string
          linked_video: string
          title: string
        }[]
      }
      get_agency_support_clients: {
        Args: { _owner_email: string }
        Returns: {
          active: boolean
          agency_id: string
          assigned_at: string
          client_company: string
          client_email: string
          client_name: string
          client_phone: string
          created_at: string
          id: string
          location_id: string
          locked_until: string
          source: string
        }[]
      }
      get_agency_support_embed_config: {
        Args: { p_key: string }
        Returns: {
          agency_id: string
          agency_name: string
          enabled: boolean
          greeting: string
          launcher_label: string
          logo_url: string
          primary_color: string
          secondary_color: string
          title: string
        }[]
      }
      get_agency_support_messages: {
        Args: { p_client_email: string; p_limit?: number }
        Returns: {
          attachment_url: string
          body: string
          created_at: string
          id: string
          sender_name: string
          sender_role: string
        }[]
      }
      get_agency_support_messages_by_embed_key: {
        Args: { p_key: string; p_limit?: number }
        Returns: {
          attachment_url: string
          body: string
          created_at: string
          id: string
          sender_name: string
          sender_role: string
        }[]
      }
      get_agency_ticket_categories: {
        Args: { p_agency_id: string }
        Returns: Json
      }
      get_agency_tickets: {
        Args: { user_email: string }
        Returns: {
          admin_response: string
          admin_response_attachment_url: string
          agency_id: string
          attachment_url: string
          created_at: string
          customer_email: string
          customer_name: string
          id: string
          issue_category: string
          request_text: string
          responded_at: string
          status: string
          ticket_number: number
        }[]
      }
      get_agency_user_limit: {
        Args: { p_agency_id: string }
        Returns: {
          current_users: number
          max_users: number
        }[]
      }
      get_agency_video_settings: {
        Args: { lookup_agency_id: string; lookup_tier: string }
        Returns: {
          category_id: string
          is_visible: boolean
          module_id: string
        }[]
      }
      get_ai_chat_messages: {
        Args: {
          p_agency_id: string
          p_days_back?: number
          p_user_identifier: string
        }
        Returns: {
          content: string
          created_at: string
          id: string
          role: string
        }[]
      }
      get_all_user_tool_data_safe: {
        Args: { user_email: string }
        Returns: {
          tool_data: Json
          tool_name: string
          updated_at: string
        }[]
      }
      get_chat_assignment: {
        Args: { p_agency_id: string; p_user_identifier: string }
        Returns: {
          assigned_at: string
          assigned_to_email: string
          assigned_to_name: string
        }[]
      }
      get_copilot_nudge_pref: {
        Args: { user_email: string }
        Returns: {
          enabled: boolean
          frequency: string
          last_sent_at: string
          next_due_at: string
        }[]
      }
      get_customer_language: { Args: { p_agency_id: string }; Returns: string }
      get_kb_agency_branding: {
        Args: { p_agency_id: string }
        Returns: {
          agency_id: string
          agency_name: string
          kb_headline: string
          kb_logo_url: string
          primary_color: string
          secondary_color: string
          tertiary_color: string
        }[]
      }
      get_marketing_data: {
        Args: { user_email: string }
        Returns: {
          ai_email_data: Json
          ai_offer_data: Json
          situation: string
          solution: string
          targeting: string
        }[]
      }
      get_my_agency_support_embed: {
        Args: { p_email: string }
        Returns: {
          embed_key: string
          enabled: boolean
          launcher_label: string
          title: string
        }[]
      }
      get_onboarding_funnel: {
        Args: never
        Returns: {
          agency_named: boolean
          approval: string
          branding_configured: boolean
          client_count: number
          created_at: string
          email: string
          full_name: string
          guest_access_until: string
          hub_configured: boolean
          initial_questions_completed: boolean
          install_confirmed_at: string
          last_accessed: string
          last_device: string
          login_count: number
          menu_link_installed: boolean
          onboarding_completed: boolean
          onboarding_completed_at: string
          onboarding_intent: string
          onboarding_skipped: boolean
          onboarding_step: number
          phone: string
          plan: string
          reached_app: boolean
          signup_device: string
          stage: number
          stage_label: string
        }[]
      }
      get_slack_support_alert_prefs: {
        Args: { user_email: string }
        Returns: Json
      }
      get_slack_weekly_report_pref: {
        Args: { user_email: string }
        Returns: {
          channel_id: string
          connected: boolean
          enabled: boolean
          last_sent_at: string
        }[]
      }
      get_support_alert_context: {
        Args: { p_agency_id: string; p_user_identifier: string }
        Returns: Json
      }
      get_support_email_alert_prefs: {
        Args: { user_email: string }
        Returns: Json
      }
      get_support_notification_settings: {
        Args: { p_owner_email: string }
        Returns: Json
      }
      get_support_ticket_replies: {
        Args: {
          p_agency_id: string
          p_customer_email?: string
          p_customer_name?: string
          p_ticket_id: string
        }
        Returns: {
          body: string
          created_at: string
          id: string
          sender_name: string
          sender_role: string
        }[]
      }
      get_support_tickets_for_customer: {
        Args: {
          p_agency_id: string
          p_customer_email?: string
          p_customer_name?: string
          p_limit?: number
        }
        Returns: {
          admin_response: string
          ai_title: string
          attachment_url: string
          bump_count: number
          created_at: string
          customer_email: string
          customer_name: string
          id: string
          issue_category: string
          last_bumped_at: string
          recording_url: string
          request_text: string
          responded_at: string
          responded_by: string
          status: string
          ticket_number: number
        }[]
      }
      get_ticket_assignments: {
        Args: { ticket_ids: string[] }
        Returns: {
          assigned_at: string
          assigned_to: string
          id: string
        }[]
      }
      get_ticket_replies_for_staff: {
        Args: { p_ticket_id: string }
        Returns: {
          body: string
          created_at: string
          id: string
          sender_email: string
          sender_name: string
          sender_role: string
        }[]
      }
      get_training_doc_for_agency: {
        Args: { p_agency_id: string }
        Returns: {
          detected_plan: string
          training_doc_url: string
        }[]
      }
      get_user_agency_versions: {
        Args: { user_email: string }
        Returns: {
          advanced_id: string
          base_id: string
          basic_id: string
          elite_id: string
        }[]
      }
      get_user_approval_by_email: {
        Args: { user_email: string }
        Returns: {
          approval: string
          has_auth_account: boolean
        }[]
      }
      get_user_auth_status_by_email: {
        Args: { user_email: string }
        Returns: {
          approval: string
          has_password: boolean
          user_id: string
        }[]
      }
      get_user_behavior_metrics: { Args: { user_email: string }; Returns: Json }
      get_user_by_email: {
        Args: { user_email: string }
        Returns: {
          agency_id: string
          approval: string
          created_at: string
          email: string
          id: number
          last_accessed: string
          onboarding_completed: boolean
          onboarding_step: number
          primary_color: string
          secondary_color: string
          tertiary_color: string
        }[]
      }
      get_user_completed_checklist_items: {
        Args: { p_agency_id: string; p_user_identifier: string }
        Returns: {
          checklist_item_id: string
        }[]
      }
      get_user_initial_questions_status: {
        Args: { user_email: string }
        Returns: boolean
      }
      get_user_progress_by_email: {
        Args: { user_email: string }
        Returns: {
          created_at: string
          email: string
          id: string
        }[]
      }
      get_user_progress_by_name: {
        Args: { user_name: string }
        Returns: {
          created_at: string
          id: string
          name: string
        }[]
      }
      get_v2_home_settings: {
        Args: { p_agency_id: string }
        Returns: {
          ai_chat_enabled: boolean
          ai_chat_icon_url: string
          ai_chat_name: string
          ai_chat_type: string
          announcements_enabled: boolean
          announcements_headline: string
          announcements_image_url: string
          announcements_paragraph: string
          checklist_title: string
          custom_link_1_color: string
          custom_link_1_open_as_popup: boolean
          custom_link_1_text: string
          custom_link_1_url: string
          custom_link_2_color: string
          custom_link_2_open_as_popup: boolean
          custom_link_2_text: string
          custom_link_2_url: string
          custom_link_3_color: string
          custom_link_3_open_as_popup: boolean
          custom_link_3_text: string
          custom_link_3_url: string
          custom_links_enabled: boolean
          daily_checklist_enabled: boolean
          default_landing_page: string
          education_page_enabled: boolean
          home_page_enabled: boolean
          next_steps_custom_text: string
          next_steps_custom_url: string
          next_steps_custom_url_label: string
          next_steps_enabled: boolean
          next_steps_priority: string
          prompt_additional_instructions: string
          prompt_goals: string
          prompt_personality: string
          prompt_training_doc: string
          support_button_1_color: string
          support_button_1_open_as_popup: boolean
          support_button_1_text: string
          support_button_1_url: string
          support_button_2_color: string
          support_button_2_open_as_popup: boolean
          support_button_2_text: string
          support_button_2_url: string
          support_button_3_color: string
          support_button_3_open_as_popup: boolean
          support_button_3_text: string
          support_button_3_url: string
          support_headline: string
          support_page_enabled: boolean
          support_subheadline: string
          tab_name_education: string
          tab_name_home: string
          tab_name_support: string
          welcome_enabled: boolean
          welcome_headline: string
          welcome_subheadline: string
          welcome_video_enabled: boolean
          welcome_video_is_embed: boolean
          welcome_video_thumbnail_url: string
          welcome_video_url: string
        }[]
      }
      get_welcome_video_choice: {
        Args: { p_agency_id: string }
        Returns: {
          custom_video_is_embed: boolean
          custom_video_url: string
          library_category_id: string
          library_module_id: string
          source: string
        }[]
      }
      giveaway_leaderboard: {
        Args: { _limit?: number }
        Returns: {
          display_name: string
          joined_at: string
          points: number
          rank: number
        }[]
      }
      giveaway_opt_in:
        | {
            Args: { _display_name?: string }
            Returns: {
              agency_id: string | null
              breakdown: Json
              created_at: string
              display_name: string
              email: string
              id: string
              last_scored_at: string | null
              opted_in_at: string
              points: number
              rules_accepted_at: string | null
              tickets: number
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "giveaway_entries"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { _accept_rules?: boolean; _display_name?: string }
            Returns: {
              agency_id: string | null
              breakdown: Json
              created_at: string
              display_name: string
              email: string
              id: string
              last_scored_at: string | null
              opted_in_at: string
              points: number
              rules_accepted_at: string | null
              tickets: number
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "giveaway_entries"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      giveaway_recalculate: {
        Args: { _email: string }
        Returns: {
          agency_id: string | null
          breakdown: Json
          created_at: string
          display_name: string
          email: string
          id: string
          last_scored_at: string | null
          opted_in_at: string
          points: number
          rules_accepted_at: string | null
          tickets: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "giveaway_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      giveaway_recalculate_all: { Args: never; Returns: number }
      giveaway_rescore_for_agency: {
        Args: { _agency_id: string; _min_interval?: string }
        Returns: undefined
      }
      giveaway_rescore_me: { Args: never; Returns: Json }
      giveaway_stats: { Args: never; Returns: Json }
      has_agency_support_access: {
        Args: { _client_email: string }
        Returns: boolean
      }
      hub_is_preview_identity: {
        Args: { p_email: string; p_name: string }
        Returns: boolean
      }
      hub_seat_exempt: {
        Args: { p_agency_id: string; p_email: string; p_name: string }
        Returns: boolean
      }
      hub_seated_users: {
        Args: { p_agency_id: string }
        Returns: {
          first_seen: string
          user_key: string
        }[]
      }
      increment_ai_question_count: {
        Args: { user_email: string }
        Returns: boolean
      }
      increment_tickets_opened: {
        Args: { user_email: string }
        Returns: boolean
      }
      invoke_refresh_affiliate_portal_cache: { Args: never; Returns: undefined }
      invoke_retry_kit_meta_purchases: { Args: never; Returns: undefined }
      invoke_send_pending_welcome: { Args: never; Returns: undefined }
      is_academy_owner: { Args: never; Returns: boolean }
      is_hub_installed: { Args: { user_email: string }; Returns: boolean }
      is_hub_session_revoked: {
        Args: {
          p_agency_id: string
          p_since: string
          p_user_identifier: string
        }
        Returns: boolean
      }
      is_platform_admin: { Args: never; Returns: boolean }
      is_platform_support_excluded: {
        Args: { p_agency_id: string }
        Returns: boolean
      }
      is_user_banned: {
        Args: { p_agency_id: string; p_user_identifier: string }
        Returns: boolean
      }
      is_user_within_limit: {
        Args: {
          p_agency_id: string
          p_identifier_type: string
          p_user_identifier: string
        }
        Returns: boolean
      }
      load_user_tool_data_safe: {
        Args: { tool_name: string; user_email: string }
        Returns: Json
      }
      lookup_auth_account_for_service: {
        Args: { user_email: string }
        Returns: {
          state: string
          user_id: string
        }[]
      }
      mark_handover_requested: {
        Args: { _agency_id: string; _user_identifier: string }
        Returns: undefined
      }
      mark_initial_questions_completed: {
        Args: { user_email: string }
        Returns: boolean
      }
      mark_payment_delinquent: {
        Args: { p_reason?: string; user_email: string }
        Returns: Json
      }
      migrate_agency_id: {
        Args: {
          p_email?: string
          p_new_id: string
          p_old_id: string
          p_source?: string
        }
        Returns: Json
      }
      migrate_user_data: {
        Args: { auth_user_id: string; old_email: string }
        Returns: boolean
      }
      page_analytics_summary: {
        Args: { p_days?: number; p_path?: string }
        Returns: Json
      }
      plan_min_onboarding_users: {
        Args: { _plan: Database["public"]["Enums"]["plan_type"] }
        Returns: number
      }
      platform_support_agency_key: {
        Args: { p_agency_id: string }
        Returns: string
      }
      platform_support_excluded_agency_ids: {
        Args: never
        Returns: {
          agency_id: string
        }[]
      }
      platform_support_excluded_keys: { Args: never; Returns: string[] }
      populate_default_agency_videos: {
        Args: { agency_id_param: string; tier_param: string }
        Returns: boolean
      }
      process_agency_training_seed_jobs: { Args: never; Returns: undefined }
      publish_scheduled_blog_posts: { Args: never; Returns: number }
      reconcile_missing_starter_users: { Args: never; Returns: number }
      record_install_confirmed: {
        Args: { user_email: string }
        Returns: boolean
      }
      record_manual_onboarding_call: {
        Args: {
          p_email: string
          p_meeting_link: string
          p_name: string
          p_owner_email: string
          p_recording_link: string
          p_scheduled_at: string
          p_transcript: string
        }
        Returns: string
      }
      record_user_device: {
        Args: { device: string; user_email: string }
        Returns: boolean
      }
      record_user_login: { Args: { user_email: string }; Returns: Json }
      refresh_branding_cache: {
        Args: { _agency_ids: string[] }
        Returns: undefined
      }
      register_affiliate_user: {
        Args: { user_affiliate_slug: string; user_email: string }
        Returns: boolean
      }
      register_bonuses_user:
        | {
            Args: { user_affiliate_id?: string; user_email: string }
            Returns: boolean
          }
        | {
            Args: {
              user_affiliate_id?: string
              user_email: string
              user_full_name?: string
              user_phone?: string
            }
            Returns: boolean
          }
      register_starter_user: {
        Args: { user_affiliate_id?: string; user_email: string }
        Returns: boolean
      }
      register_user_safe:
        | {
            Args: { user_approval?: string; user_email: string }
            Returns: number
          }
        | {
            Args: {
              user_affiliate_id?: string
              user_approval?: string
              user_email: string
            }
            Returns: number
          }
      request_join_agency: {
        Args: { p_owner_email: string }
        Returns: undefined
      }
      resolve_affiliate_slug: { Args: { slug: string }; Returns: string }
      respond_join_request: {
        Args: { p_approve: boolean; p_request_id: string }
        Returns: undefined
      }
      restore_user_access:
        | { Args: { user_email: string }; Returns: boolean }
        | { Args: { user_email: string; user_plan?: string }; Returns: boolean }
      save_agency_name_and_update_urls: {
        Args: { new_agency_name: string; user_email: string }
        Returns: boolean
      }
      save_agency_video_setting: {
        Args: {
          agency_id_param: string
          category_id_param: string
          is_visible_param: boolean
          module_id_param: string
          tier_param: string
        }
        Returns: boolean
      }
      save_ai_chat_message: {
        Args: {
          p_agency_id: string
          p_content: string
          p_role: string
          p_user_identifier: string
        }
        Returns: string
      }
      save_marketing_data: {
        Args: {
          email_data?: Json
          offer_data?: Json
          situation_input?: string
          solution_input?: string
          targeting_input?: string
          user_email: string
        }
        Returns: boolean
      }
      save_user_attribution:
        | {
            Args: {
              p_fbclid?: string
              p_gclid?: string
              p_landing_page?: string
              p_referrer?: string
              p_utm_campaign?: string
              p_utm_content?: string
              p_utm_id?: string
              p_utm_medium?: string
              p_utm_source?: string
              p_utm_term?: string
              user_email: string
            }
            Returns: boolean
          }
        | {
            Args: {
              p_fbc?: string
              p_fbclid?: string
              p_fbp?: string
              p_gclid?: string
              p_landing_page?: string
              p_referrer?: string
              p_utm_campaign?: string
              p_utm_content?: string
              p_utm_id?: string
              p_utm_medium?: string
              p_utm_source?: string
              p_utm_term?: string
              user_email: string
            }
            Returns: boolean
          }
      save_user_last_touch: {
        Args: {
          p_fbclid?: string
          p_gclid?: string
          p_landing_page?: string
          p_referrer?: string
          p_touched_at?: string
          p_utm_campaign?: string
          p_utm_content?: string
          p_utm_id?: string
          p_utm_medium?: string
          p_utm_source?: string
          p_utm_term?: string
          user_email: string
        }
        Returns: boolean
      }
      save_user_tool_data_safe: {
        Args: { tool_data: Json; tool_name: string; user_email: string }
        Returns: boolean
      }
      search_training_chunks: {
        Args: {
          p_agency_id: string
          p_match_count?: number
          p_query_embedding: string
        }
        Returns: {
          content: string
          similarity: number
        }[]
      }
      search_training_chunks_text: {
        Args: { p_agency_id: string; p_match_count?: number; p_query: string }
        Returns: {
          content: string
          rank: number
        }[]
      }
      send_agency_support_message: {
        Args: {
          p_agency_id?: string
          p_attachment_url?: string
          p_body: string
          p_client_email: string
          p_sender_name?: string
        }
        Returns: string
      }
      send_agency_support_message_by_embed_key: {
        Args: {
          p_attachment_url?: string
          p_body: string
          p_key: string
          p_sender_name?: string
        }
        Returns: string
      }
      set_agency_support_client_active: {
        Args: { _active: boolean; _client_email: string; _owner_email: string }
        Returns: Json
      }
      set_agency_support_wallet: {
        Args: { _email: string; _quantity: number; _subscription_id?: string }
        Returns: {
          agency_support_access: boolean
          agency_support_wallet: number
          email: string
        }[]
      }
      set_chat_thread_category: {
        Args: {
          p_agency_id: string
          p_category: string
          p_user_identifier: string
        }
        Returns: undefined
      }
      set_copilot_nudge_pref: {
        Args: { p_enabled: boolean; user_email: string }
        Returns: boolean
      }
      set_customer_language: {
        Args: { p_language: string; p_owner_email: string }
        Returns: string
      }
      set_slack_support_alert_pref: {
        Args: { p_enabled: boolean; p_key: string; user_email: string }
        Returns: boolean
      }
      set_slack_weekly_report_pref: {
        Args: { p_enabled: boolean; user_email: string }
        Returns: boolean
      }
      set_support_email_alert_pref: {
        Args: { p_enabled: boolean; p_key: string; user_email: string }
        Returns: boolean
      }
      set_support_email_alert_pref_for: {
        Args: { p_enabled: boolean; p_key: string; p_owner_email: string }
        Returns: boolean
      }
      set_white_label_domain: {
        Args: { _domain: string; _email: string }
        Returns: string
      }
      stage_signup_attribution:
        | {
            Args: {
              p_fbclid?: string
              p_gclid?: string
              p_landing_page?: string
              p_referrer?: string
              p_token: string
              p_utm_campaign?: string
              p_utm_content?: string
              p_utm_id?: string
              p_utm_medium?: string
              p_utm_source?: string
              p_utm_term?: string
            }
            Returns: boolean
          }
        | {
            Args: {
              p_fbc?: string
              p_fbclid?: string
              p_fbp?: string
              p_gclid?: string
              p_landing_page?: string
              p_referrer?: string
              p_token: string
              p_utm_campaign?: string
              p_utm_content?: string
              p_utm_id?: string
              p_utm_medium?: string
              p_utm_source?: string
              p_utm_term?: string
            }
            Returns: boolean
          }
      start_guest_access_window: { Args: { user_email: string }; Returns: Json }
      start_payment_grace: {
        Args: { grace_days?: number; user_email: string }
        Returns: Json
      }
      start_user_trial: {
        Args: { user_affiliate_id?: string; user_email: string }
        Returns: boolean
      }
      support_admin_row: {
        Args: { p_agency_id: string }
        Returns: {
          accepted_at: string | null
          admin_email: string
          admin_name: string | null
          admin_phone: string | null
          created_at: string
          id: string
          invited_at: string
          notify_assigned_chats: boolean
          notify_assigned_tickets: boolean
          owner_email: string
          permissions: Json
          restrict_assigned_chats: boolean
          restrict_assigned_tickets: boolean
          status: string
          support_email_alerts: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "account_admins"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      support_can_edit_ticket: {
        Args: { p_agency_id: string; p_assigned_to: string }
        Returns: boolean
      }
      support_can_see_chat: {
        Args: { p_agency_id: string; p_user_identifier: string }
        Returns: boolean
      }
      support_can_see_ticket: {
        Args: { p_agency_id: string; p_assigned_to: string }
        Returns: boolean
      }
      support_canonical_category: { Args: { p: string }; Returns: string }
      support_is_team_member: {
        Args: { p_email: string; p_owner: string }
        Returns: boolean
      }
      support_pick_assignee: {
        Args: { p_agency_id: string; p_category: string; p_customer: string }
        Returns: string
      }
      support_ticket_short_title: { Args: { p_text: string }; Returns: string }
      suspend_user_access: { Args: { user_email: string }; Returns: boolean }
      ticket_category_defaults: { Args: never; Returns: string[] }
      toggle_agency_name_url: {
        Args: { use_name_url: boolean; user_email: string }
        Returns: boolean
      }
      toggle_onboarding_checklist_item: {
        Args: {
          p_agency_id: string
          p_checklist_item_id: string
          p_user_identifier: string
        }
        Returns: boolean
      }
      trace_agency_id_for_user: {
        Args: { p_email: string; p_name: string }
        Returns: string
      }
      track_video_engagement: {
        Args: {
          action_type: string
          user_email: string
          watch_time_seconds?: number
        }
        Returns: boolean
      }
      unban_user_from_page: {
        Args: { p_agency_id: string; p_user_identifier: string }
        Returns: boolean
      }
      update_account_profile: {
        Args: {
          p_agency_name: string
          p_email: string
          p_full_name: string
          p_phone: string
        }
        Returns: {
          agency_id: string
          owner_email: string
        }[]
      }
      update_agency_client: {
        Args: { p_email?: string; p_name?: string; p_user_id: string }
        Returns: boolean
      }
      update_onboarding_progress: {
        Args: { is_completed?: boolean; step_id: string; user_email: string }
        Returns: boolean
      }
      update_user_access: { Args: { user_email: string }; Returns: boolean }
      update_user_agency_assignment: {
        Args: { agency_id: string; user_email: string }
        Returns: boolean
      }
      update_user_agency_assignment_with_name: {
        Args: { agency_id: string; user_email?: string; user_name?: string }
        Returns: boolean
      }
      update_user_colors_and_complete: {
        Args: {
          primary_color?: string
          secondary_color?: string
          tertiary_color?: string
          user_email: string
        }
        Returns: boolean
      }
      update_user_last_accessed: {
        Args: { user_email?: string; user_name?: string }
        Returns: boolean
      }
      update_user_onboarding: {
        Args: { completed: boolean; step: number; user_email: string }
        Returns: boolean
      }
      update_user_progress_missing_field: {
        Args: {
          identifier_type: string
          identifier_value: string
          new_field_type: string
          new_field_value: string
        }
        Returns: boolean
      }
      upsert_agency_support_client:
        | {
            Args: {
              _agency_id?: string
              _client_email: string
              _client_name?: string
              _owner_email: string
              _source?: string
            }
            Returns: {
              active: boolean
              agency_id: string | null
              assigned_at: string | null
              client_company: string | null
              client_email: string
              client_name: string | null
              client_phone: string | null
              created_at: string
              id: string
              location_id: string | null
              locked_until: string | null
              owner_email: string
              source: string
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "agency_support_clients"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              _agency_id?: string
              _client_company?: string
              _client_email: string
              _client_name?: string
              _client_phone?: string
              _location_id?: string
              _owner_email: string
              _source?: string
            }
            Returns: {
              active: boolean
              agency_id: string | null
              assigned_at: string | null
              client_company: string | null
              client_email: string
              client_name: string | null
              client_phone: string | null
              created_at: string
              id: string
              location_id: string | null
              locked_until: string | null
              owner_email: string
              source: string
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "agency_support_clients"
              isOneToOne: true
              isSetofReturn: false
            }
          }
    }
    Enums: {
      community_role: "member" | "team" | "admin"
      community_thread_status: "open" | "answered" | "closed"
      community_tier: "free" | "paid"
      plan_type:
        | "BASIC"
        | "ADVANCED"
        | "STARTER"
        | "null"
        | "NULL"
        | "Null"
        | ""
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
      community_role: ["member", "team", "admin"],
      community_thread_status: ["open", "answered", "closed"],
      community_tier: ["free", "paid"],
      plan_type: ["BASIC", "ADVANCED", "STARTER", "null", "NULL", "Null", ""],
    },
  },
} as const
