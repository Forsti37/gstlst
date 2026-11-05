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
          visibility: Database["public"]["Enums"]["visibility"]
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
          visibility?: Database["public"]["Enums"]["visibility"]
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
          visibility?: Database["public"]["Enums"]["visibility"]
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
          created_at: string
          id: string
          payload: Json
          read_at: string | null
          recipient_id: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          recipient_id: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          recipient_id?: string
          type?: string
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
          home_city: string | null
          id: string
          language: string
          privacy: Json
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          username: string
        }
        Insert: {
          avatar_path?: string | null
          birth_year: number
          created_at?: string
          display_name: string
          home_city?: string | null
          id: string
          language?: string
          privacy?: Json
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          username: string
        }
        Update: {
          avatar_path?: string | null
          birth_year?: number
          created_at?: string
          display_name?: string
          home_city?: string | null
          id?: string
          language?: string
          privacy?: Json
          role?: Database["public"]["Enums"]["user_role"]
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
          reason: string
          reporter_id: string | null
          resolved_at: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reporter_id?: string | null
          resolved_at?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string | null
          resolved_at?: string | null
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
      are_friends: { Args: { a: string; b: string }; Returns: boolean }
      can_view_checkin: { Args: { checkin_id: string }; Returns: boolean }
      can_view_reaction_target: {
        Args: {
          id: string
          target: Database["public"]["Enums"]["reaction_target"]
        }
        Returns: boolean
      }
      get_own_profile: {
        Args: never
        Returns: {
          avatar_path: string | null
          birth_year: number
          created_at: string
          display_name: string
          home_city: string | null
          id: string
          language: string
          privacy: Json
          role: Database["public"]["Enums"]["user_role"]
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
      is_admin: { Args: never; Returns: boolean }
      is_blocked_between: { Args: { a: string; b: string }; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      keep_alive: { Args: never; Returns: boolean }
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
      normalize_name: { Args: { value: string }; Returns: string }
      require_admin: { Args: never; Returns: undefined }
      search_entities: {
        Args: { entity_type: string; max_results?: number; query: string }
        Returns: {
          id: string
          name: string
          score: number
          status: Database["public"]["Enums"]["entity_status"]
        }[]
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
