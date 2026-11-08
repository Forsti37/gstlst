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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          diff: Json | null
          entity_id: string | null
          entity_type: string
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_aliases: {
        Row: {
          alias: string
          alias_normalized: string | null
          artist_id: string
          id: string
        }
        Insert: {
          alias: string
          alias_normalized?: string | null
          artist_id: string
          id?: string
        }
        Update: {
          alias?: string
          alias_normalized?: string | null
          artist_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_aliases_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_default_genres: {
        Row: {
          artist_id: string
          genre_id: string
        }
        Insert: {
          artist_id: string
          genre_id: string
        }
        Update: {
          artist_id?: string
          genre_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_default_genres_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_default_genres_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_members: {
        Row: {
          group_id: string
          member_id: string
        }
        Insert: {
          group_id: string
          member_id: string
        }
        Update: {
          group_id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      artists: {
        Row: {
          avatar_path: string | null
          claimed_by_user_id: string | null
          country_code: string | null
          created_at: string
          created_by: string | null
          id: string
          instagram_url: string | null
          kind: Database["public"]["Enums"]["artist_kind"]
          name: string
          name_normalized: string | null
          slug: string
          status: Database["public"]["Enums"]["entity_status"]
        }
        Insert: {
          avatar_path?: string | null
          claimed_by_user_id?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          instagram_url?: string | null
          kind?: Database["public"]["Enums"]["artist_kind"]
          name: string
          name_normalized?: string | null
          slug: string
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Update: {
          avatar_path?: string | null
          claimed_by_user_id?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          instagram_url?: string | null
          kind?: Database["public"]["Enums"]["artist_kind"]
          name?: string
          name_normalized?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Relationships: [
          {
            foreignKeyName: "artists_claimed_by_user_id_fkey"
            columns: ["claimed_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artists_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      badge_definitions: {
        Row: {
          category: string
          created_at: string
          description: string
          description_de: string | null
          icon: string | null
          id: string
          name: string
          rule: Json
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          description_de?: string | null
          icon?: string | null
          id?: string
          name: string
          rule: Json
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          description_de?: string | null
          icon?: string | null
          id?: string
          name?: string
          rule?: Json
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      change_requests: {
        Row: {
          created_at: string
          created_by: string | null
          diff: Json
          entity_id: string | null
          entity_type: string
          id: string
          reason: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["request_status"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          diff: Json
          entity_id?: string | null
          entity_type: string
          id?: string
          reason?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          diff?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
          reason?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "change_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checkin_companions: {
        Row: {
          created_at: string
          event_checkin_id: string
          status: Database["public"]["Enums"]["companion_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          event_checkin_id: string
          status?: Database["public"]["Enums"]["companion_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          event_checkin_id?: string
          status?: Database["public"]["Enums"]["companion_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkin_companions_event_checkin_id_fkey"
            columns: ["event_checkin_id"]
            isOneToOne: false
            referencedRelation: "event_checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_companions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checkin_fun_facts: {
        Row: {
          checkin_id: string
          created_at: string
          id: string
          kind: string
          payload: Json
        }
        Insert: {
          checkin_id: string
          created_at?: string
          id?: string
          kind: string
          payload?: Json
        }
        Update: {
          checkin_id?: string
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "checkin_fun_facts_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "event_checkins"
            referencedColumns: ["id"]
          },
        ]
      }
      event_checkins: {
        Row: {
          client_uuid: string
          created_at: string
          event_id: string
          id: string
          imported: boolean
          rating: number | null
          rating_crowd: number | null
          rating_lineup: number | null
          rating_location: number | null
          rating_sound: number | null
          text: string | null
          updated_at: string
          user_id: string
          verified_admin: boolean
          verified_gps: boolean
          visibility: Database["public"]["Enums"]["visibility"] | null
        }
        Insert: {
          client_uuid: string
          created_at?: string
          event_id: string
          id?: string
          imported?: boolean
          rating?: number | null
          rating_crowd?: number | null
          rating_lineup?: number | null
          rating_location?: number | null
          rating_sound?: number | null
          text?: string | null
          updated_at?: string
          user_id: string
          verified_admin?: boolean
          verified_gps?: boolean
          visibility?: Database["public"]["Enums"]["visibility"] | null
        }
        Update: {
          client_uuid?: string
          created_at?: string
          event_id?: string
          id?: string
          imported?: boolean
          rating?: number | null
          rating_crowd?: number | null
          rating_lineup?: number | null
          rating_location?: number | null
          rating_sound?: number | null
          text?: string | null
          updated_at?: string
          user_id?: string
          verified_admin?: boolean
          verified_gps?: boolean
          visibility?: Database["public"]["Enums"]["visibility"] | null
        }
        Relationships: [
          {
            foreignKeyName: "event_checkins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_event_tags: {
        Row: {
          event_id: string
          tag_id: string
        }
        Insert: {
          event_id: string
          tag_id: string
        }
        Update: {
          event_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_event_tags_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_event_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      event_promoters: {
        Row: {
          event_id: string
          promoter_id: string
        }
        Insert: {
          event_id: string
          promoter_id: string
        }
        Update: {
          event_id?: string
          promoter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_promoters_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_promoters_promoter_id_fkey"
            columns: ["promoter_id"]
            isOneToOne: false
            referencedRelation: "promoters"
            referencedColumns: ["id"]
          },
        ]
      }
      event_series: {
        Row: {
          created_at: string
          created_by: string | null
          default_promoter_id: string | null
          id: string
          name: string
          slug: string
          status: Database["public"]["Enums"]["entity_status"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_promoter_id?: string | null
          id?: string
          name: string
          slug: string
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_promoter_id?: string | null
          id?: string
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Relationships: [
          {
            foreignKeyName: "event_series_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_series_default_promoter_id_fkey"
            columns: ["default_promoter_id"]
            isOneToOne: false
            referencedRelation: "promoters"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          created_by: string | null
          date_end: string | null
          date_start: string
          id: string
          lifecycle: Database["public"]["Enums"]["event_lifecycle"]
          name: string
          name_normalized: string | null
          series_id: string | null
          status: Database["public"]["Enums"]["entity_status"]
          venue_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_end?: string | null
          date_start: string
          id?: string
          lifecycle?: Database["public"]["Enums"]["event_lifecycle"]
          name: string
          name_normalized?: string | null
          series_id?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          venue_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_end?: string | null
          date_start?: string
          id?: string
          lifecycle?: Database["public"]["Enums"]["event_lifecycle"]
          name?: string
          name_normalized?: string | null
          series_id?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "event_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          app_version: string | null
          created_at: string
          device: string | null
          github_issue_url: string | null
          id: string
          text: string
          user_id: string | null
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          device?: string | null
          github_issue_url?: string | null
          id?: string
          text: string
          user_id?: string | null
        }
        Update: {
          app_version?: string | null
          created_at?: string
          device?: string | null
          github_issue_url?: string | null
          id?: string
          text?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      floors: {
        Row: {
          created_by: string | null
          event_id: string
          id: string
          name: string
          sort: number
          status: Database["public"]["Enums"]["entity_status"]
        }
        Insert: {
          created_by?: string | null
          event_id: string
          id?: string
          name: string
          sort?: number
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Update: {
          created_by?: string | null
          event_id?: string
          id?: string
          name?: string
          sort?: number
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Relationships: [
          {
            foreignKeyName: "floors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floors_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          created_at: string
          requested_by: string
          status: Database["public"]["Enums"]["friendship_status"]
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          requested_by: string
          status?: Database["public"]["Enums"]["friendship_status"]
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          requested_by?: string
          status?: Database["public"]["Enums"]["friendship_status"]
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_a_fkey"
            columns: ["user_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_b_fkey"
            columns: ["user_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      genres: {
        Row: {
          id: string
          name: string
          parent_id: string | null
          slug: string
        }
        Insert: {
          id?: string
          name: string
          parent_id?: string | null
          slug: string
        }
        Update: {
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "genres_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
        ]
      }
      going: {
        Row: {
          created_at: string
          event_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "going_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "going_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          max_uses: number
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          max_uses?: number
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          max_uses?: number
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          created_at: string
          event_checkin_id: string
          id: string
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          owner_id: string
          set_checkin_id: string | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          event_checkin_id: string
          id?: string
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          owner_id: string
          set_checkin_id?: string | null
          storage_path: string
        }
        Update: {
          created_at?: string
          event_checkin_id?: string
          id?: string
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          owner_id?: string
          set_checkin_id?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_event_checkin_id_fkey"
            columns: ["event_checkin_id"]
            isOneToOne: false
            referencedRelation: "event_checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_set_checkin_id_fkey"
            columns: ["set_checkin_id"]
            isOneToOne: false
            referencedRelation: "set_checkins"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          bundle_key: string | null
          created_at: string
          id: string
          payload: Json
          pushed_at: string | null
          read_at: string | null
          recipient_id: string
          type: string
          updated_at: string
        }
        Insert: {
          bundle_key?: string | null
          created_at?: string
          id?: string
          payload?: Json
          pushed_at?: string | null
          read_at?: string | null
          recipient_id: string
          type: string
          updated_at?: string
        }
        Update: {
          bundle_key?: string | null
          created_at?: string
          id?: string
          payload?: Json
          pushed_at?: string | null
          read_at?: string | null
          recipient_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      private_checkin_data: {
        Row: {
          currency: string
          event_checkin_id: string
          other_spend: number | null
          ticket_price: number | null
        }
        Insert: {
          currency?: string
          event_checkin_id: string
          other_spend?: number | null
          ticket_price?: number | null
        }
        Update: {
          currency?: string
          event_checkin_id?: string
          other_spend?: number | null
          ticket_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "private_checkin_data_event_checkin_id_fkey"
            columns: ["event_checkin_id"]
            isOneToOne: true
            referencedRelation: "event_checkins"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          birth_year: number
          created_at: string
          display_name: string
          hidden_for_review: boolean
          home_city: string | null
          id: string
          language: string
          notification_settings: Json
          privacy: Json
          role: Database["public"]["Enums"]["user_role"]
          terms_accepted_at: string | null
          updated_at: string
          username: string
        }
        Insert: {
          avatar_path?: string | null
          birth_year: number
          created_at?: string
          display_name: string
          hidden_for_review?: boolean
          home_city?: string | null
          id: string
          language?: string
          notification_settings?: Json
          privacy?: Json
          role?: Database["public"]["Enums"]["user_role"]
          terms_accepted_at?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          avatar_path?: string | null
          birth_year?: number
          created_at?: string
          display_name?: string
          hidden_for_review?: boolean
          home_city?: string | null
          id?: string
          language?: string
          notification_settings?: Json
          privacy?: Json
          role?: Database["public"]["Enums"]["user_role"]
          terms_accepted_at?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      promoters: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          instagram_url: string | null
          name: string
          name_normalized: string | null
          slug: string
          status: Database["public"]["Enums"]["entity_status"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          instagram_url?: string | null
          name: string
          name_normalized?: string | null
          slug: string
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          instagram_url?: string | null
          name?: string
          name_normalized?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Relationships: [
          {
            foreignKeyName: "promoters_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          keys: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          keys: Json
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          keys?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          created_at: string
          kind: Database["public"]["Enums"]["reaction_kind"]
          target_id: string
          target_type: Database["public"]["Enums"]["reaction_target"]
          user_id: string
        }
        Insert: {
          created_at?: string
          kind: Database["public"]["Enums"]["reaction_kind"]
          target_id: string
          target_type: Database["public"]["Enums"]["reaction_target"]
          user_id: string
        }
        Update: {
          created_at?: string
          kind?: Database["public"]["Enums"]["reaction_kind"]
          target_id?: string
          target_type?: Database["public"]["Enums"]["reaction_target"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          id: string
          previous_status:
            | Database["public"]["Enums"]["moderation_status"]
            | null
          reason: string
          reporter_id: string | null
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          previous_status?:
            | Database["public"]["Enums"]["moderation_status"]
            | null
          reason: string
          reporter_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          id?: string
          previous_status?:
            | Database["public"]["Enums"]["moderation_status"]
            | null
          reason?: string
          reporter_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      set_artists: {
        Row: {
          artist_id: string
          role: Database["public"]["Enums"]["set_artist_role"]
          set_id: string
        }
        Insert: {
          artist_id: string
          role?: Database["public"]["Enums"]["set_artist_role"]
          set_id: string
        }
        Update: {
          artist_id?: string
          role?: Database["public"]["Enums"]["set_artist_role"]
          set_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "set_artists_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_artists_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "sets"
            referencedColumns: ["id"]
          },
        ]
      }
      set_checkin_genres: {
        Row: {
          genre_id: string
          set_checkin_id: string
        }
        Insert: {
          genre_id: string
          set_checkin_id: string
        }
        Update: {
          genre_id?: string
          set_checkin_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "set_checkin_genres_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_checkin_genres_set_checkin_id_fkey"
            columns: ["set_checkin_id"]
            isOneToOne: false
            referencedRelation: "set_checkins"
            referencedColumns: ["id"]
          },
        ]
      }
      set_checkin_tags: {
        Row: {
          set_checkin_id: string
          tag_id: string
        }
        Insert: {
          set_checkin_id: string
          tag_id: string
        }
        Update: {
          set_checkin_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "set_checkin_tags_set_checkin_id_fkey"
            columns: ["set_checkin_id"]
            isOneToOne: false
            referencedRelation: "set_checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_checkin_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      set_checkins: {
        Row: {
          created_at: string
          event_checkin_id: string
          id: string
          imported: boolean
          rating: number | null
          set_id: string
          text: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_checkin_id: string
          id?: string
          imported?: boolean
          rating?: number | null
          set_id: string
          text?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_checkin_id?: string
          id?: string
          imported?: boolean
          rating?: number | null
          set_id?: string
          text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "set_checkins_event_checkin_id_fkey"
            columns: ["event_checkin_id"]
            isOneToOne: false
            referencedRelation: "event_checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_checkins_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "sets"
            referencedColumns: ["id"]
          },
        ]
      }
      sets: {
        Row: {
          created_at: string
          created_by: string | null
          end_at: string | null
          event_id: string
          floor_id: string | null
          id: string
          set_type: Database["public"]["Enums"]["set_type"]
          start_at: string | null
          status: Database["public"]["Enums"]["entity_status"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_at?: string | null
          event_id: string
          floor_id?: string | null
          id?: string
          set_type?: Database["public"]["Enums"]["set_type"]
          start_at?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_at?: string | null
          event_id?: string
          floor_id?: string | null
          id?: string
          set_type?: Database["public"]["Enums"]["set_type"]
          start_at?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Relationships: [
          {
            foreignKeyName: "sets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sets_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          scope: Database["public"]["Enums"]["tag_scope"]
          status: Database["public"]["Enums"]["entity_status"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          scope: Database["public"]["Enums"]["tag_scope"]
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          scope?: Database["public"]["Enums"]["tag_scope"]
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Relationships: [
          {
            foreignKeyName: "tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          awarded_at: string
          badge_id: string
          level: number
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_id: string
          level?: number
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_id?: string
          level?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badge_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          city: string
          country_code: string
          created_at: string
          created_by: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          name_normalized: string | null
          status: Database["public"]["Enums"]["entity_status"]
          venue_type: Database["public"]["Enums"]["venue_type"]
        }
        Insert: {
          city: string
          country_code: string
          created_at?: string
          created_by?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          name_normalized?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          venue_type?: Database["public"]["Enums"]["venue_type"]
        }
        Update: {
          city?: string
          country_code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          name_normalized?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          venue_type?: Database["public"]["Enums"]["venue_type"]
        }
        Relationships: [
          {
            foreignKeyName: "venues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_artists: {
        Row: {
          artist_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_artists_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_artists_user_id_fkey"
            columns: ["user_id"]
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
      admin_create_invite: {
        Args: { expires_at?: string; max_uses?: number }
        Returns: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          max_uses: number
          used_count: number
        }
        SetofOptions: {
          from: "*"
          to: "invite_codes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_list_members: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          username: string
        }[]
      }
      admin_preview_badge: {
        Args: { rule: Json; valid_from?: string; valid_to?: string }
        Returns: {
          display_name: string
          level: number
          username: string
          value: number
        }[]
      }
      admin_set_community_wrapped: {
        Args: { for_year: number; unlocked: boolean }
        Returns: undefined
      }
      admin_set_moderator: {
        Args: { is_moderator: boolean; target_user: string }
        Returns: undefined
      }
      apply_entity_changes: {
        Args: { changes: Json; entity_id: string; entity_table: string }
        Returns: undefined
      }
      approve_dependencies: {
        Args: { entity_id: string; entity_table: string }
        Returns: undefined
      }
      are_friends: { Args: { a: string; b: string }; Returns: boolean }
      best_sound_ranking: {
        Args: never
        Returns: {
          avg_sound: number
          city: string
          name: string
          rank: number
          ratings: number
          venue_id: string
        }[]
      }
      can_see_profile: { Args: { profile_id: string }; Returns: boolean }
      can_view_checkin: { Args: { checkin_id: string }; Returns: boolean }
      can_view_reaction_target: {
        Args: {
          id: string
          target: Database["public"]["Enums"]["reaction_target"]
        }
        Returns: boolean
      }
      compare_with: { Args: { target_user: string }; Returns: Json }
      complete_signup: {
        Args: {
          accepted_terms: boolean
          birth_year: number
          display_name: string
          invite_code: string
          language: string
          username: string
        }
        Returns: {
          avatar_path: string | null
          birth_year: number
          created_at: string
          display_name: string
          hidden_for_review: boolean
          home_city: string | null
          id: string
          language: string
          notification_settings: Json
          privacy: Json
          role: Database["public"]["Enums"]["user_role"]
          terms_accepted_at: string | null
          updated_at: string
          username: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_own_account: { Args: never; Returns: undefined }
      dispatch_push: { Args: never; Returns: undefined }
      distance_meters: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      entity_checkins: {
        Args: { entity: string; target: string }
        Returns: {
          checkin_id: string
          event_date: string
          event_id: string
          rating: number
          sets: number
          user_id: string
        }[]
      }
      entity_is_visible: {
        Args: { entity: string; target: string }
        Returns: boolean
      }
      evaluate_my_badges: { Args: never; Returns: undefined }
      event_live_until: { Args: { target_event: string }; Returns: string }
      event_set_ratings: {
        Args: { target_event: string }
        Returns: {
          average: number
          ratings: number
          set_id: string
        }[]
      }
      explore_stats: {
        Args: {
          date_from?: string
          date_to?: string
          dimension: string
          filters?: Json
          target_user: string
          verified_only?: boolean
        }
        Returns: {
          avg_rating: number
          events: number
          key: string
          label: string
          sets: number
        }[]
      }
      export_my_data: { Args: never; Returns: Json }
      feed_card: { Args: { checkin_id: string }; Returns: Json }
      feed_time: {
        Args: { created_at: string; event_date: string; imported: boolean }
        Returns: string
      }
      friends_leaderboard: {
        Args: { for_year?: number }
        Returns: {
          artists: number
          avatar_path: string
          display_name: string
          events: number
          sets: number
          user_id: string
          username: string
        }[]
      }
      friends_of: { Args: { person: string }; Returns: string[] }
      get_artist_stats: { Args: { target_artist: string }; Returns: Json }
      get_badges: {
        Args: { target_user: string }
        Returns: {
          awarded_at: string
          category: string
          description: string
          description_de: string
          id: string
          level: number
          level_names: Json
          levels: Json
          name: string
          valid_from: string
          valid_to: string
          value: number
        }[]
      }
      get_checkin_card: { Args: { target_checkin: string }; Returns: Json }
      get_community_wrapped: { Args: { for_year: number }; Returns: Json }
      get_entity_checkins: {
        Args: {
          before_time?: string
          entity: string
          page_size?: number
          target: string
        }
        Returns: Json
      }
      get_entity_personal: {
        Args: { entity: string; target: string }
        Returns: Json
      }
      get_entity_upcoming: {
        Args: { entity: string; target: string }
        Returns: {
          date_end: string
          date_start: string
          id: string
          name: string
          status: Database["public"]["Enums"]["entity_status"]
          venue_city: string
          venue_name: string
        }[]
      }
      get_friends_feed: {
        Args: { before_time?: string; page_size?: number }
        Returns: Json
      }
      get_my_spending: {
        Args: { period: string }
        Returns: {
          currency: string
          events: number
          other: number
          tickets: number
        }[]
      }
      get_own_profile: {
        Args: never
        Returns: {
          avatar_path: string | null
          birth_year: number
          created_at: string
          display_name: string
          hidden_for_review: boolean
          home_city: string | null
          id: string
          language: string
          notification_settings: Json
          privacy: Json
          role: Database["public"]["Enums"]["user_role"]
          terms_accepted_at: string | null
          updated_at: string
          username: string
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_profile_by_username: {
        Args: { target_username: string }
        Returns: {
          avatar_path: string
          display_name: string
          id: string
          username: string
        }[]
      }
      get_profile_map: {
        Args: { target_user: string }
        Returns: {
          city: string
          events: number
          lat: number
          lng: number
          name: string
          venue_id: string
        }[]
      }
      get_profile_stats: { Args: { target_user: string }; Returns: Json }
      get_promoter_stats: { Args: { target_promoter: string }; Returns: Json }
      get_public_feed: {
        Args: {
          near_lat?: number
          near_lng?: number
          page_offset?: number
          page_size?: number
        }
        Returns: Json
      }
      get_venue_stats: { Args: { target_venue: string }; Returns: Json }
      get_wrapped: {
        Args: { period: string; target_username: string }
        Returns: Json
      }
      has_profile: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_blocked_between: { Args: { a: string; b: string }; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      is_valid_privacy: { Args: { value: Json }; Returns: boolean }
      keep_alive: { Args: never; Returns: boolean }
      list_blocked: {
        Args: never
        Returns: {
          avatar_path: string
          display_name: string
          id: string
          username: string
        }[]
      }
      list_community_wrapped: { Args: never; Returns: number[] }
      list_friendships: {
        Args: never
        Returns: {
          avatar_path: string
          display_name: string
          id: string
          requested_by: string
          status: Database["public"]["Enums"]["friendship_status"]
          username: string
        }[]
      }
      list_reactions: {
        Args: {
          target: Database["public"]["Enums"]["reaction_target"]
          target_id: string
        }
        Returns: {
          avatar_path: string
          display_name: string
          kind: Database["public"]["Enums"]["reaction_kind"]
          username: string
        }[]
      }
      log_decision: {
        Args: {
          action: string
          details: Json
          entity_id: string
          entity_type: string
        }
        Returns: undefined
      }
      log_merge: {
        Args: {
          action: string
          entity_type: string
          kept: string
          removed: string
          removed_name: string
        }
        Returns: undefined
      }
      mark_wrapped_shared: { Args: { period: string }; Returns: undefined }
      merge_artist: {
        Args: { from_id: string; to_id: string }
        Returns: undefined
      }
      merge_event: {
        Args: { from_id: string; to_id: string }
        Returns: undefined
      }
      merge_promoter: {
        Args: { from_id: string; to_id: string }
        Returns: undefined
      }
      merge_venue: {
        Args: { from_id: string; to_id: string }
        Returns: undefined
      }
      moderate_entity: {
        Args: {
          changes?: Json
          decision: string
          entity_id: string
          entity_table: string
          reason?: string
        }
        Returns: undefined
      }
      moderate_media: {
        Args: { decision: string; media_id: string; reason?: string }
        Returns: undefined
      }
      moderate_merge: {
        Args: { entity_table: string; from_id: string; to_id: string }
        Returns: undefined
      }
      normalize_name: { Args: { value: string }; Returns: string }
      notify_decision: {
        Args: { kind: string; payload: Json; recipient: string }
        Returns: undefined
      }
      notify_friend_checkin: {
        Args: { checkin_id: string }
        Returns: undefined
      }
      notify_wishlist_lineup: {
        Args: { target_set: string }
        Returns: undefined
      }
      privacy_allows: {
        Args: { area: string; owner: string }
        Returns: boolean
      }
      privacy_level: {
        Args: { area: string; owner: string }
        Returns: Database["public"]["Enums"]["visibility"]
      }
      reaction_summary: {
        Args: {
          target: Database["public"]["Enums"]["reaction_target"]
          target_id: string
        }
        Returns: Json
      }
      report_content: {
        Args: { reason: string; target_id: string; target_type: string }
        Returns: undefined
      }
      require_admin: { Args: never; Returns: undefined }
      require_staff: { Args: never; Returns: undefined }
      resolve_report: {
        Args: { decision: string; note?: string; report_id: string }
        Returns: undefined
      }
      review_change_request: {
        Args: { decision: string; reason?: string; request_id: string }
        Returns: undefined
      }
      search_entities: {
        Args: { entity_type: string; max_results?: number; query: string }
        Returns: {
          id: string
          name: string
          score: number
          status: Database["public"]["Enums"]["entity_status"]
        }[]
      }
      search_events: {
        Args: { max_results?: number; query: string }
        Returns: {
          date_end: string
          date_start: string
          id: string
          name: string
          status: Database["public"]["Enums"]["entity_status"]
          venue_city: string
          venue_name: string
        }[]
      }
      search_profiles: {
        Args: { max_results?: number; query: string }
        Returns: {
          avatar_path: string
          display_name: string
          id: string
          username: string
        }[]
      }
      set_event_lifecycle: {
        Args: {
          event_id: string
          lifecycle: Database["public"]["Enums"]["event_lifecycle"]
        }
        Returns: undefined
      }
      set_reaction: {
        Args: {
          kind: Database["public"]["Enums"]["reaction_kind"]
          target: Database["public"]["Enums"]["reaction_target"]
          target_id: string
        }
        Returns: undefined
      }
      staff_dashboard: { Args: never; Returns: Json }
      staff_list_checkins: {
        Args: { target_username: string }
        Returns: {
          date_start: string
          event_name: string
          id: string
          verified_admin: boolean
          verified_gps: boolean
        }[]
      }
      staff_verify_checkin: {
        Args: { checkin_id: string; verified: boolean }
        Returns: undefined
      }
      tagged_checkin: { Args: { checkin_id: string }; Returns: Json }
      upsert_notification: {
        Args: {
          bundle?: string
          kind: string
          payload: Json
          recipient: string
        }
        Returns: undefined
      }
      verify_checkin_gps: {
        Args: {
          captured_at: string
          checkin_id: string
          lat: number
          lng: number
        }
        Returns: boolean
      }
      visibility_allows: {
        Args: {
          level: Database["public"]["Enums"]["visibility"]
          owner: string
        }
        Returns: boolean
      }
    }
    Enums: {
      artist_kind: "person" | "group"
      companion_status: "tagged" | "adopted"
      entity_status: "pending" | "approved" | "rejected"
      event_lifecycle: "scheduled" | "cancelled" | "postponed"
      friendship_status: "pending" | "accepted"
      moderation_status: "pending" | "approved" | "rejected"
      reaction_kind: "bassface" | "dance" | "fire"
      reaction_target: "event_checkin" | "set_checkin"
      request_status: "pending" | "approved" | "rejected"
      set_artist_role: "dj" | "live" | "mc"
      set_type: "solo" | "b2b" | "b2b2b" | "f2f" | "live" | "hybrid"
      tag_scope: "set" | "event"
      user_role: "user" | "moderator" | "admin"
      venue_type:
        | "club"
        | "warehouse"
        | "open_air"
        | "festival_site"
        | "castle"
        | "pool"
        | "boat"
        | "other"
      visibility: "public" | "friends" | "private"
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
      artist_kind: ["person", "group"],
      companion_status: ["tagged", "adopted"],
      entity_status: ["pending", "approved", "rejected"],
      event_lifecycle: ["scheduled", "cancelled", "postponed"],
      friendship_status: ["pending", "accepted"],
      moderation_status: ["pending", "approved", "rejected"],
      reaction_kind: ["bassface", "dance", "fire"],
      reaction_target: ["event_checkin", "set_checkin"],
      request_status: ["pending", "approved", "rejected"],
      set_artist_role: ["dj", "live", "mc"],
      set_type: ["solo", "b2b", "b2b2b", "f2f", "live", "hybrid"],
      tag_scope: ["set", "event"],
      user_role: ["user", "moderator", "admin"],
      venue_type: [
        "club",
        "warehouse",
        "open_air",
        "festival_site",
        "castle",
        "pool",
        "boat",
        "other",
      ],
      visibility: ["public", "friends", "private"],
    },
  },
} as const
