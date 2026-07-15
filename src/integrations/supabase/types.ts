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
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          avg_sentiment: number | null
          created_at: string
          dedupe_key: string | null
          evidence_message_ids: string[]
          first_seen_at: string
          id: string
          last_seen_at: string
          level: Database["public"]["Enums"]["alert_level"]
          max_risk: number | null
          message_count: number
          neighborhood: string | null
          org_id: string
          recommended_action: string | null
          resolved_at: string | null
          stage: string
          summary: string
          topic: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          avg_sentiment?: number | null
          created_at?: string
          dedupe_key?: string | null
          evidence_message_ids?: string[]
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          level: Database["public"]["Enums"]["alert_level"]
          max_risk?: number | null
          message_count?: number
          neighborhood?: string | null
          org_id: string
          recommended_action?: string | null
          resolved_at?: string | null
          stage?: string
          summary: string
          topic: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          avg_sentiment?: number | null
          created_at?: string
          dedupe_key?: string | null
          evidence_message_ids?: string[]
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          level?: Database["public"]["Enums"]["alert_level"]
          max_risk?: number | null
          message_count?: number
          neighborhood?: string | null
          org_id?: string
          recommended_action?: string | null
          resolved_at?: string | null
          stage?: string
          summary?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          org_id: string
          target_id: string | null
          target_kind: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          org_id: string
          target_id?: string | null
          target_kind?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          org_id?: string
          target_id?: string | null
          target_kind?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_aggregates: {
        Row: {
          avg_sentiment: number | null
          bucket_date: string
          group_id: string | null
          id: string
          message_count: number
          org_id: string
          risk_events: number
          top_neighborhoods: Json
          top_topics: Json
        }
        Insert: {
          avg_sentiment?: number | null
          bucket_date: string
          group_id?: string | null
          id?: string
          message_count?: number
          org_id: string
          risk_events?: number
          top_neighborhoods?: Json
          top_topics?: Json
        }
        Update: {
          avg_sentiment?: number | null
          bucket_date?: string
          group_id?: string | null
          id?: string
          message_count?: number
          org_id?: string
          risk_events?: number
          top_neighborhoods?: Json
          top_topics?: Json
        }
        Relationships: [
          {
            foreignKeyName: "daily_aggregates_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_aggregates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      elected_officials: {
        Row: {
          alignment: string
          ano_eleicao: number
          cargo_codigo: string | null
          cargo_nome: string
          cod_municipio_tse: string
          created_at: string
          foto_url: string | null
          id: string
          imported_at: string
          is_elected: boolean
          nome: string
          nome_urna: string | null
          notes: string | null
          numero: string
          org_id: string
          partido_nome: string | null
          partido_sigla: string | null
          situacao_turno: string | null
          tse_candidate_id: string | null
          uf: string
          updated_at: string
        }
        Insert: {
          alignment?: string
          ano_eleicao: number
          cargo_codigo?: string | null
          cargo_nome: string
          cod_municipio_tse: string
          created_at?: string
          foto_url?: string | null
          id?: string
          imported_at?: string
          is_elected?: boolean
          nome: string
          nome_urna?: string | null
          notes?: string | null
          numero: string
          org_id: string
          partido_nome?: string | null
          partido_sigla?: string | null
          situacao_turno?: string | null
          tse_candidate_id?: string | null
          uf: string
          updated_at?: string
        }
        Update: {
          alignment?: string
          ano_eleicao?: number
          cargo_codigo?: string | null
          cargo_nome?: string
          cod_municipio_tse?: string
          created_at?: string
          foto_url?: string | null
          id?: string
          imported_at?: string
          is_elected?: boolean
          nome?: string
          nome_urna?: string | null
          notes?: string | null
          numero?: string
          org_id?: string
          partido_nome?: string | null
          partido_sigla?: string | null
          situacao_turno?: string | null
          tse_candidate_id?: string | null
          uf?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "elected_officials_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lgpd_events: {
        Row: {
          created_at: string
          details: Json
          event_type: string
          id: string
          org_id: string
          subject_id: string | null
          subject_kind: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          org_id: string
          subject_id?: string | null
          subject_kind?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          org_id?: string
          subject_id?: string | null
          subject_kind?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lgpd_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      member_author_links: {
        Row: {
          author_hash: string
          confidence: number
          confirmed_by: string | null
          created_at: string
          id: string
          member_id: string
          org_id: string
        }
        Insert: {
          author_hash: string
          confidence?: number
          confirmed_by?: string | null
          created_at?: string
          id?: string
          member_id: string
          org_id: string
        }
        Update: {
          author_hash?: string
          confidence?: number
          confirmed_by?: string | null
          created_at?: string
          id?: string
          member_id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_author_links_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "tracked_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_author_links_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      member_daily_stats: {
        Row: {
          avg_response_minutes: number | null
          avg_sentiment: number | null
          bucket_date: string
          id: string
          insults_count: number
          member_id: string
          message_count: number
          org_id: string
          topics: Json
        }
        Insert: {
          avg_response_minutes?: number | null
          avg_sentiment?: number | null
          bucket_date: string
          id?: string
          insults_count?: number
          member_id: string
          message_count?: number
          org_id: string
          topics?: Json
        }
        Update: {
          avg_response_minutes?: number | null
          avg_sentiment?: number | null
          bucket_date?: string
          id?: string
          insults_count?: number
          member_id?: string
          message_count?: number
          org_id?: string
          topics?: Json
        }
        Relationships: [
          {
            foreignKeyName: "member_daily_stats_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "tracked_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_daily_stats_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_analyses: {
        Row: {
          created_at: string
          id: string
          intensity: number | null
          is_actionable: boolean
          mentioned_allies: string[]
          mentioned_entities: string[]
          mentioned_opponents: string[]
          message_id: string
          model_version: string | null
          neighborhood: string | null
          org_id: string
          raw_response: Json | null
          risk_score: number
          sentiment: number | null
          subtopic: string | null
          summary: string | null
          topic: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          intensity?: number | null
          is_actionable?: boolean
          mentioned_allies?: string[]
          mentioned_entities?: string[]
          mentioned_opponents?: string[]
          message_id: string
          model_version?: string | null
          neighborhood?: string | null
          org_id: string
          raw_response?: Json | null
          risk_score?: number
          sentiment?: number | null
          subtopic?: string | null
          summary?: string | null
          topic?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          intensity?: number | null
          is_actionable?: boolean
          mentioned_allies?: string[]
          mentioned_entities?: string[]
          mentioned_opponents?: string[]
          message_id?: string
          model_version?: string | null
          neighborhood?: string | null
          org_id?: string
          raw_response?: Json | null
          risk_score?: number
          sentiment?: number | null
          subtopic?: string | null
          summary?: string | null
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_analyses_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "raw_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_analyses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_adversaries: {
        Row: {
          activity_score: number
          avatar_url: string | null
          created_at: string
          display_name: string
          handle: string | null
          id: string
          org_id: string
          party: string | null
          recent_actions: Json
          role: string | null
          sentiment: number | null
          top_topics: Json
          updated_at: string
        }
        Insert: {
          activity_score?: number
          avatar_url?: string | null
          created_at?: string
          display_name: string
          handle?: string | null
          id?: string
          org_id: string
          party?: string | null
          recent_actions?: Json
          role?: string | null
          sentiment?: number | null
          top_topics?: Json
          updated_at?: string
        }
        Update: {
          activity_score?: number
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          handle?: string | null
          id?: string
          org_id?: string
          party?: string | null
          recent_actions?: Json
          role?: string | null
          sentiment?: number | null
          top_topics?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_adversaries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_instagram_targets: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          handle: string
          id: string
          kind: string
          label: string | null
          last_scanned_at: string | null
          last_status: string | null
          org_id: string
          posts_per_scan: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          handle: string
          id?: string
          kind?: string
          label?: string | null
          last_scanned_at?: string | null
          last_status?: string | null
          org_id: string
          posts_per_scan?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          handle?: string
          id?: string
          kind?: string
          label?: string | null
          last_scanned_at?: string | null
          last_status?: string | null
          org_id?: string
          posts_per_scan?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_instagram_targets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_lgpd_policy: {
        Row: {
          allow_export: boolean
          dpo_email: string | null
          org_id: string
          retention_days: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allow_export?: boolean
          dpo_email?: string | null
          org_id: string
          retention_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allow_export?: boolean
          dpo_email?: string | null
          org_id?: string
          retention_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_lgpd_policy_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_territory: {
        Row: {
          city_slug: string
          created_at: string
          geojson: Json
          id: string
          org_id: string
          updated_at: string
        }
        Insert: {
          city_slug: string
          created_at?: string
          geojson: Json
          id?: string
          org_id: string
          updated_at?: string
        }
        Update: {
          city_slug?: string
          created_at?: string
          geojson?: Json
          id?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_territory_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_vocabulary: {
        Row: {
          aliases: string[]
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["vocab_kind"]
          metadata: Json
          org_id: string
          value: string
        }
        Insert: {
          aliases?: string[]
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["vocab_kind"]
          metadata?: Json
          org_id: string
          value: string
        }
        Update: {
          aliases?: string[]
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["vocab_kind"]
          metadata?: Json
          org_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_vocabulary_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_whatsapp_numbers: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          label: string | null
          org_id: string
          phone_jid: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          label?: string | null
          org_id: string
          phone_jid: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          label?: string | null
          org_id?: string
          phone_jid?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_whatsapp_numbers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          author_hash_salt: string
          city: string | null
          created_at: string
          created_by: string | null
          id: string
          is_demo: boolean
          name: string
          slug: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          author_hash_salt?: string
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          name: string
          slug?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          author_hash_salt?: string
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          slug?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          granted_at: string
          granted_by: string | null
          note: string | null
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          note?: string | null
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          evolution_api_key: string | null
          evolution_base_url: string | null
          evolution_connected_phone: string | null
          evolution_connection_status: string
          evolution_instance_name: string | null
          evolution_last_seen_at: string | null
          id: string
          updated_at: string
          updated_by: string | null
          webhook_token: string
        }
        Insert: {
          evolution_api_key?: string | null
          evolution_base_url?: string | null
          evolution_connected_phone?: string | null
          evolution_connection_status?: string
          evolution_instance_name?: string | null
          evolution_last_seen_at?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
          webhook_token?: string
        }
        Update: {
          evolution_api_key?: string | null
          evolution_base_url?: string | null
          evolution_connected_phone?: string | null
          evolution_connection_status?: string
          evolution_instance_name?: string | null
          evolution_last_seen_at?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
          webhook_token?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      raw_messages: {
        Row: {
          analysis_status: string
          author_hash: string | null
          content: string | null
          external_id: string | null
          group_id: string | null
          id: string
          ingested_at: string
          media_kind: string | null
          media_mime: string | null
          org_id: string
          posted_at: string
          raw_payload: Json | null
          source_id: string
        }
        Insert: {
          analysis_status?: string
          author_hash?: string | null
          content?: string | null
          external_id?: string | null
          group_id?: string | null
          id?: string
          ingested_at?: string
          media_kind?: string | null
          media_mime?: string | null
          org_id: string
          posted_at: string
          raw_payload?: Json | null
          source_id: string
        }
        Update: {
          analysis_status?: string
          author_hash?: string | null
          content?: string | null
          external_id?: string | null
          group_id?: string | null
          id?: string
          ingested_at?: string
          media_kind?: string | null
          media_mime?: string | null
          org_id?: string
          posted_at?: string
          raw_payload?: Json | null
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_messages_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          data: Json
          generated_at: string
          id: string
          kind: Database["public"]["Enums"]["report_kind"]
          markdown: string
          model_version: string | null
          org_id: string
          period_end: string
          period_start: string
          title: string
        }
        Insert: {
          data?: Json
          generated_at?: string
          id?: string
          kind: Database["public"]["Enums"]["report_kind"]
          markdown: string
          model_version?: string | null
          org_id: string
          period_end: string
          period_start: string
          title: string
        }
        Update: {
          data?: Json
          generated_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["report_kind"]
          markdown?: string
          model_version?: string | null
          org_id?: string
          period_end?: string
          period_start?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["source_kind"]
          label: string
          org_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["source_kind"]
          label: string
          org_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["source_kind"]
          label?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sources_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          avg_sentiment: number | null
          bucket_date: string
          id: string
          label: string
          max_risk: number
          message_count: number
          org_id: string
          sample_message_ids: string[]
          top_neighborhoods: Json
          trend: string | null
          updated_at: string
        }
        Insert: {
          avg_sentiment?: number | null
          bucket_date: string
          id?: string
          label: string
          max_risk?: number
          message_count?: number
          org_id: string
          sample_message_ids?: string[]
          top_neighborhoods?: Json
          trend?: string | null
          updated_at?: string
        }
        Update: {
          avg_sentiment?: number | null
          bucket_date?: string
          id?: string
          label?: string
          max_risk?: number
          message_count?: number
          org_id?: string
          sample_message_ids?: string[]
          top_neighborhoods?: Json
          trend?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tracked_members: {
        Row: {
          author_hash: string | null
          created_at: string
          display_name: string
          group_id: string | null
          id: string
          neighborhood: string | null
          notes: string | null
          org_id: string
          role: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          author_hash?: string | null
          created_at?: string
          display_name: string
          group_id?: string | null
          id?: string
          neighborhood?: string | null
          notes?: string | null
          org_id: string
          role?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          author_hash?: string | null
          created_at?: string
          display_name?: string
          group_id?: string | null
          id?: string
          neighborhood?: string | null
          notes?: string | null
          org_id?: string
          role?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracked_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracked_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_groups: {
        Row: {
          created_at: string
          id: string
          instance_id: string
          is_monitored: boolean
          monitored_at: string | null
          monitored_by: string | null
          neighborhood_tag: string | null
          notes: string | null
          org_id: string
          participant_count: number | null
          picture_url: string | null
          remote_jid: string
          subject: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          instance_id: string
          is_monitored?: boolean
          monitored_at?: string | null
          monitored_by?: string | null
          neighborhood_tag?: string | null
          notes?: string | null
          org_id: string
          participant_count?: number | null
          picture_url?: string | null
          remote_jid: string
          subject?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          instance_id?: string
          is_monitored?: boolean
          monitored_at?: string | null
          monitored_by?: string | null
          neighborhood_tag?: string | null
          notes?: string | null
          org_id?: string
          participant_count?: number | null
          picture_url?: string | null
          remote_jid?: string
          subject?: string | null
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_groups_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_groups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          connected_phone: string | null
          connection_status: string
          created_at: string
          evolution_api_key: string
          evolution_base_url: string
          id: string
          instance_name: string
          last_seen_at: string | null
          org_id: string
          source_id: string
          updated_at: string
          webhook_token: string
        }
        Insert: {
          connected_phone?: string | null
          connection_status?: string
          created_at?: string
          evolution_api_key: string
          evolution_base_url: string
          id?: string
          instance_name: string
          last_seen_at?: string | null
          org_id: string
          source_id: string
          updated_at?: string
          webhook_token?: string
        }
        Update: {
          connected_phone?: string | null
          connection_status?: string
          created_at?: string
          evolution_api_key?: string
          evolution_base_url?: string
          id?: string
          instance_name?: string
          last_seen_at?: string | null
          org_id?: string
          source_id?: string
          updated_at?: string
          webhook_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_instances_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: true
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      enter_demo_mode: { Args: never; Returns: string }
      has_org_access: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      has_org_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { _user_id?: string }; Returns: boolean }
    }
    Enums: {
      alert_level: "amarelo" | "laranja" | "vermelho"
      app_role: "owner" | "analyst" | "viewer"
      report_kind: "daily" | "weekly" | "monthly"
      source_kind:
        | "whatsapp"
        | "instagram"
        | "facebook"
        | "x"
        | "news"
        | "web_search"
      vocab_kind:
        | "neighborhood"
        | "opponent"
        | "ally"
        | "department"
        | "facility"
        | "sensitive_term"
        | "news_domain"
        | "focus_term"
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
      alert_level: ["amarelo", "laranja", "vermelho"],
      app_role: ["owner", "analyst", "viewer"],
      report_kind: ["daily", "weekly", "monthly"],
      source_kind: [
        "whatsapp",
        "instagram",
        "facebook",
        "x",
        "news",
        "web_search",
      ],
      vocab_kind: [
        "neighborhood",
        "opponent",
        "ally",
        "department",
        "facility",
        "sensitive_term",
        "news_domain",
        "focus_term",
      ],
    },
  },
} as const
