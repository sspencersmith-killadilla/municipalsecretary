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
      agenda_items: {
        Row: {
          closed_session_citation: string | null
          created_at: string
          display_number: string | null
          id: string
          is_closed_session: boolean
          is_consent: boolean
          item_id: string | null
          meeting_id: string
          outcome: string | null
          position: number
          public_action_note: string | null
          section_name: string
          section_order: number
          time_certain: string | null
          title: string
          updated_at: string
        }
        Insert: {
          closed_session_citation?: string | null
          created_at?: string
          display_number?: string | null
          id?: string
          is_closed_session?: boolean
          is_consent?: boolean
          item_id?: string | null
          meeting_id: string
          outcome?: string | null
          position?: number
          public_action_note?: string | null
          section_name?: string
          section_order?: number
          time_certain?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          closed_session_citation?: string | null
          created_at?: string
          display_number?: string | null
          id?: string
          is_closed_session?: boolean
          is_consent?: boolean
          item_id?: string | null
          meeting_id?: string
          outcome?: string | null
          position?: number
          public_action_note?: string | null
          section_name?: string
          section_order?: number
          time_certain?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "legislative_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_template_sections: {
        Row: {
          allows_items: boolean
          created_at: string
          id: string
          is_consent: boolean
          name: string
          section_order: number
          template_id: string
        }
        Insert: {
          allows_items?: boolean
          created_at?: string
          id?: string
          is_consent?: boolean
          name: string
          section_order?: number
          template_id: string
        }
        Update: {
          allows_items?: boolean
          created_at?: string
          id?: string
          is_consent?: boolean
          name?: string
          section_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_template_sections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "agenda_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_templates: {
        Row: {
          body_id: string | null
          created_at: string
          id: string
          name: string
          numbering_style: string
          updated_at: string
        }
        Insert: {
          body_id?: string | null
          created_at?: string
          id?: string
          name: string
          numbering_style?: string
          updated_at?: string
        }
        Update: {
          body_id?: string | null
          created_at?: string
          id?: string
          name?: string
          numbering_style?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_templates_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "bodies"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          member_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          member_id: string
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          member_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          detail: string | null
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      bodies: {
        Row: {
          active: boolean
          created_at: string
          default_location: string | null
          description: string | null
          id: string
          meeting_cadence: string | null
          name: string
          quorum_type: string
          quorum_value: number | null
          seat_count: number
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_location?: string | null
          description?: string | null
          id?: string
          meeting_cadence?: string | null
          name: string
          quorum_type?: string
          quorum_value?: number | null
          seat_count?: number
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          default_location?: string | null
          description?: string | null
          id?: string
          meeting_cadence?: string | null
          name?: string
          quorum_type?: string
          quorum_value?: number | null
          seat_count?: number
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      body_permissions: {
        Row: {
          body_id: string
          can_submit: boolean
          created_at: string
          id: string
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body_id: string
          can_submit?: boolean
          created_at?: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body_id?: string
          can_submit?: boolean
          created_at?: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "body_permissions_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "bodies"
            referencedColumns: ["id"]
          },
        ]
      }
      body_seats: {
        Row: {
          body_id: string
          created_at: string
          id: string
          member_id: string | null
          seat_label: string
          sort_order: number
          term_end: string | null
          term_start: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          body_id: string
          created_at?: string
          id?: string
          member_id?: string | null
          seat_label: string
          sort_order?: number
          term_end?: string | null
          term_start?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          body_id?: string
          created_at?: string
          id?: string
          member_id?: string | null
          seat_label?: string
          sort_order?: number
          term_end?: string | null
          term_start?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "body_seats_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "body_seats_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      closed_minutes: {
        Row: {
          citation: string
          content: string
          created_at: string
          id: string
          meeting_id: string
          public_action_taken: string | null
          sealed: boolean
          updated_at: string
        }
        Insert: {
          citation: string
          content?: string
          created_at?: string
          id?: string
          meeting_id: string
          public_action_taken?: string | null
          sealed?: boolean
          updated_at?: string
        }
        Update: {
          citation?: string
          content?: string
          created_at?: string
          id?: string
          meeting_id?: string
          public_action_taken?: string | null
          sealed?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "closed_minutes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: true
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      disposition_log: {
        Row: {
          authority: string | null
          created_at: string
          description: string
          disposed_at: string
          disposed_by: string | null
          entity_id: string | null
          id: string
          record_class: string
        }
        Insert: {
          authority?: string | null
          created_at?: string
          description: string
          disposed_at?: string
          disposed_by?: string | null
          entity_id?: string | null
          id?: string
          record_class: string
        }
        Update: {
          authority?: string | null
          created_at?: string
          description?: string
          disposed_at?: string
          disposed_by?: string | null
          entity_id?: string | null
          id?: string
          record_class?: string
        }
        Relationships: []
      }
      document_exports: {
        Row: {
          created_at: string
          doc_type: string
          file_name: string
          generated_by: string | null
          id: string
          meeting_id: string
          version: number
        }
        Insert: {
          created_at?: string
          doc_type: string
          file_name: string
          generated_by?: string | null
          id?: string
          meeting_id: string
          version: number
        }
        Update: {
          created_at?: string
          doc_type?: string
          file_name?: string
          generated_by?: string | null
          id?: string
          meeting_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_exports_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      item_attachments: {
        Row: {
          content_type: string | null
          created_at: string
          file_name: string
          id: string
          item_id: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          file_name: string
          id?: string
          item_id: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          content_type?: string | null
          created_at?: string
          file_name?: string
          id?: string
          item_id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_attachments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "legislative_items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_types: {
        Row: {
          active: boolean
          created_at: string
          custom_fields: Json
          default_vote_rule_id: string | null
          default_workflow_template_id: string | null
          description: string | null
          id: string
          name: string
          readings_required: number
          requires_public_hearing: boolean
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          custom_fields?: Json
          default_vote_rule_id?: string | null
          default_workflow_template_id?: string | null
          description?: string | null
          id?: string
          name: string
          readings_required?: number
          requires_public_hearing?: boolean
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          custom_fields?: Json
          default_vote_rule_id?: string | null
          default_workflow_template_id?: string | null
          description?: string | null
          id?: string
          name?: string
          readings_required?: number
          requires_public_hearing?: boolean
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_types_default_vote_rule_id_fkey"
            columns: ["default_vote_rule_id"]
            isOneToOne: false
            referencedRelation: "vote_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_types_default_workflow_template_id_fkey"
            columns: ["default_workflow_template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      item_versions: {
        Row: {
          body_text: string | null
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          note: string | null
          title: string | null
          version: number
        }
        Insert: {
          body_text?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          note?: string | null
          title?: string | null
          version?: number
        }
        Update: {
          body_text?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          note?: string | null
          title?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "item_versions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "legislative_items"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_holds: {
        Row: {
          active: boolean
          created_at: string
          entity_id: string | null
          id: string
          placed_at: string
          placed_by: string | null
          reason: string
          record_class: string
          released_at: string | null
          scope_note: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          entity_id?: string | null
          id?: string
          placed_at?: string
          placed_by?: string | null
          reason: string
          record_class: string
          released_at?: string | null
          scope_note?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          entity_id?: string | null
          id?: string
          placed_at?: string
          placed_by?: string | null
          reason?: string
          record_class?: string
          released_at?: string | null
          scope_note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      legislative_items: {
        Row: {
          adopted_at: string | null
          assigned_number: string | null
          body_id: string | null
          body_text: string | null
          codification_reference: string | null
          created_at: string
          created_by: string | null
          custom_values: Json
          department: string | null
          effective_date: string | null
          file_number: string | null
          fiscal_impact: string | null
          id: string
          item_type_id: string | null
          plain_summary: string | null
          publication_date: string | null
          readings_completed: number
          sponsor: string | null
          status: Database["public"]["Enums"]["item_status"]
          summary: string | null
          title: string
          updated_at: string
          veto_status: string | null
        }
        Insert: {
          adopted_at?: string | null
          assigned_number?: string | null
          body_id?: string | null
          body_text?: string | null
          codification_reference?: string | null
          created_at?: string
          created_by?: string | null
          custom_values?: Json
          department?: string | null
          effective_date?: string | null
          file_number?: string | null
          fiscal_impact?: string | null
          id?: string
          item_type_id?: string | null
          plain_summary?: string | null
          publication_date?: string | null
          readings_completed?: number
          sponsor?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          summary?: string | null
          title: string
          updated_at?: string
          veto_status?: string | null
        }
        Update: {
          adopted_at?: string | null
          assigned_number?: string | null
          body_id?: string | null
          body_text?: string | null
          codification_reference?: string | null
          created_at?: string
          created_by?: string | null
          custom_values?: Json
          department?: string | null
          effective_date?: string | null
          file_number?: string | null
          fiscal_impact?: string | null
          id?: string
          item_type_id?: string | null
          plain_summary?: string | null
          publication_date?: string | null
          readings_completed?: number
          sponsor?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          summary?: string | null
          title?: string
          updated_at?: string
          veto_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legislative_items_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legislative_items_item_type_id_fkey"
            columns: ["item_type_id"]
            isOneToOne: false
            referencedRelation: "item_types"
            referencedColumns: ["id"]
          },
        ]
      }
      media_index: {
        Row: {
          agenda_item_id: string | null
          created_at: string
          id: string
          label: string
          media_id: string
          offset_seconds: number
        }
        Insert: {
          agenda_item_id?: string | null
          created_at?: string
          id?: string
          label: string
          media_id: string
          offset_seconds?: number
        }
        Update: {
          agenda_item_id?: string | null
          created_at?: string
          id?: string
          label?: string
          media_id?: string
          offset_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "media_index_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_index_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "meeting_media"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_media: {
        Row: {
          captions_available: boolean
          captions_url: string | null
          created_at: string
          id: string
          media_type: string
          meeting_id: string
          provider: string | null
          published: boolean
          updated_at: string
          url: string
        }
        Insert: {
          captions_available?: boolean
          captions_url?: string | null
          created_at?: string
          id?: string
          media_type?: string
          meeting_id: string
          provider?: string | null
          published?: boolean
          updated_at?: string
          url: string
        }
        Update: {
          captions_available?: boolean
          captions_url?: string | null
          created_at?: string
          id?: string
          media_type?: string
          meeting_id?: string
          provider?: string | null
          published?: boolean
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_media_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_notices: {
        Row: {
          compliance_note: string | null
          compliant: boolean
          content: string
          created_at: string
          deadline_at: string | null
          id: string
          kind: Database["public"]["Enums"]["notice_kind"]
          meeting_id: string
          posted_at: string
          posted_by: string | null
          posted_by_name: string | null
          posting_locations: string[]
          version: number
        }
        Insert: {
          compliance_note?: string | null
          compliant?: boolean
          content: string
          created_at?: string
          deadline_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["notice_kind"]
          meeting_id: string
          posted_at?: string
          posted_by?: string | null
          posted_by_name?: string | null
          posting_locations?: string[]
          version?: number
        }
        Update: {
          compliance_note?: string | null
          compliant?: boolean
          content?: string
          created_at?: string
          deadline_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["notice_kind"]
          meeting_id?: string
          posted_at?: string
          posted_by?: string | null
          posted_by_name?: string | null
          posting_locations?: string[]
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "meeting_notices_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          agenda_template_id: string | null
          body_id: string
          cancellation_reason: string | null
          cancelled_at: string | null
          comment_deadline: string | null
          comments_open: boolean
          continued_from_meeting_id: string | null
          created_at: string
          current_agenda_item_id: string | null
          emergency_justification: string | null
          id: string
          location: string | null
          meeting_kind: Database["public"]["Enums"]["meeting_kind"]
          notes: string | null
          published_at: string | null
          speaker_seconds: number
          starts_at: string
          status: Database["public"]["Enums"]["meeting_status"]
          title: string
          updated_at: string
        }
        Insert: {
          agenda_template_id?: string | null
          body_id: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          comment_deadline?: string | null
          comments_open?: boolean
          continued_from_meeting_id?: string | null
          created_at?: string
          current_agenda_item_id?: string | null
          emergency_justification?: string | null
          id?: string
          location?: string | null
          meeting_kind?: Database["public"]["Enums"]["meeting_kind"]
          notes?: string | null
          published_at?: string | null
          speaker_seconds?: number
          starts_at: string
          status?: Database["public"]["Enums"]["meeting_status"]
          title: string
          updated_at?: string
        }
        Update: {
          agenda_template_id?: string | null
          body_id?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          comment_deadline?: string | null
          comments_open?: boolean
          continued_from_meeting_id?: string | null
          created_at?: string
          current_agenda_item_id?: string | null
          emergency_justification?: string | null
          id?: string
          location?: string | null
          meeting_kind?: Database["public"]["Enums"]["meeting_kind"]
          notes?: string | null
          published_at?: string | null
          speaker_seconds?: number
          starts_at?: string
          status?: Database["public"]["Enums"]["meeting_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_agenda_template_id_fkey"
            columns: ["agenda_template_id"]
            isOneToOne: false
            referencedRelation: "agenda_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_continued_from_meeting_id_fkey"
            columns: ["continued_from_meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          active: boolean
          bio: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          photo_url: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          photo_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          photo_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      minutes: {
        Row: {
          certification_note: string | null
          certified_at: string | null
          certified_by: string | null
          content: string
          created_at: string
          finalized: boolean
          finalized_at: string | null
          finalized_by: string | null
          id: string
          integrity_hash: string | null
          meeting_id: string
          updated_at: string
        }
        Insert: {
          certification_note?: string | null
          certified_at?: string | null
          certified_by?: string | null
          content?: string
          created_at?: string
          finalized?: boolean
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          integrity_hash?: string | null
          meeting_id: string
          updated_at?: string
        }
        Update: {
          certification_note?: string | null
          certified_at?: string | null
          certified_by?: string | null
          content?: string
          created_at?: string
          finalized?: boolean
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          integrity_hash?: string | null
          meeting_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "minutes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: true
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      motions: {
        Row: {
          agenda_item_id: string | null
          created_at: string
          id: string
          is_open: boolean
          meeting_id: string
          mover_id: string | null
          result: string | null
          seconder_id: string | null
          tally: Json | null
          text: string
          updated_at: string
          vote_rule_id: string | null
        }
        Insert: {
          agenda_item_id?: string | null
          created_at?: string
          id?: string
          is_open?: boolean
          meeting_id: string
          mover_id?: string | null
          result?: string | null
          seconder_id?: string | null
          tally?: Json | null
          text: string
          updated_at?: string
          vote_rule_id?: string | null
        }
        Update: {
          agenda_item_id?: string | null
          created_at?: string
          id?: string
          is_open?: boolean
          meeting_id?: string
          mover_id?: string | null
          result?: string | null
          seconder_id?: string | null
          tally?: Json | null
          text?: string
          updated_at?: string
          vote_rule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "motions_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motions_mover_id_fkey"
            columns: ["mover_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motions_seconder_id_fkey"
            columns: ["seconder_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motions_vote_rule_id_fkey"
            columns: ["vote_rule_id"]
            isOneToOne: false
            referencedRelation: "vote_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      numbering_rules: {
        Row: {
          body_id: string | null
          created_at: string
          current_seq: number
          id: string
          item_type_id: string
          last_reset_year: number | null
          pattern: string
          reset: Database["public"]["Enums"]["reset_policy"]
          updated_at: string
        }
        Insert: {
          body_id?: string | null
          created_at?: string
          current_seq?: number
          id?: string
          item_type_id: string
          last_reset_year?: number | null
          pattern?: string
          reset?: Database["public"]["Enums"]["reset_policy"]
          updated_at?: string
        }
        Update: {
          body_id?: string | null
          created_at?: string
          current_seq?: number
          id?: string
          item_type_id?: string
          last_reset_year?: number | null
          pattern?: string
          reset?: Database["public"]["Enums"]["reset_policy"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "numbering_rules_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "numbering_rules_item_type_id_fkey"
            columns: ["item_type_id"]
            isOneToOne: false
            referencedRelation: "item_types"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          email: string | null
          full_name: string | null
          id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      public_comments: {
        Row: {
          address: string | null
          agenda_item_id: string | null
          body: string
          comment_type: Database["public"]["Enums"]["comment_type"]
          created_at: string
          email: string | null
          full_name: string
          id: string
          meeting_id: string
          moderated_at: string | null
          moderated_by: string | null
          moderation_note: string | null
          organization: string | null
          position: Database["public"]["Enums"]["comment_position"]
          status: Database["public"]["Enums"]["moderation_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          agenda_item_id?: string | null
          body: string
          comment_type?: Database["public"]["Enums"]["comment_type"]
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          meeting_id: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_note?: string | null
          organization?: string | null
          position?: Database["public"]["Enums"]["comment_position"]
          status?: Database["public"]["Enums"]["moderation_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          agenda_item_id?: string | null
          body?: string
          comment_type?: Database["public"]["Enums"]["comment_type"]
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          meeting_id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_note?: string | null
          organization?: string | null
          position?: Database["public"]["Enums"]["comment_position"]
          status?: Database["public"]["Enums"]["moderation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_comments_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_comments_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      records_request_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          note: string | null
          request_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          request_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "records_request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "records_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      records_requests: {
        Row: {
          assigned_to: string | null
          closed_at: string | null
          created_at: string
          description: string
          due_at: string | null
          fee_estimate: number | null
          id: string
          received_at: string
          redaction_note: string | null
          requester_email: string | null
          requester_name: string
          requester_phone: string | null
          response_note: string | null
          status: Database["public"]["Enums"]["request_status"]
          tracking_code: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          closed_at?: string | null
          created_at?: string
          description: string
          due_at?: string | null
          fee_estimate?: number | null
          id?: string
          received_at?: string
          redaction_note?: string | null
          requester_email?: string | null
          requester_name: string
          requester_phone?: string | null
          response_note?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          tracking_code?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          closed_at?: string | null
          created_at?: string
          description?: string
          due_at?: string | null
          fee_estimate?: number | null
          id?: string
          received_at?: string
          redaction_note?: string | null
          requester_email?: string | null
          requester_name?: string
          requester_phone?: string | null
          response_note?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          tracking_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      retention_policies: {
        Row: {
          citation: string | null
          created_at: string
          id: string
          label: string
          note: string | null
          permanent: boolean
          record_class: string
          retention_years: number | null
          updated_at: string
        }
        Insert: {
          citation?: string | null
          created_at?: string
          id?: string
          label: string
          note?: string | null
          permanent?: boolean
          record_class: string
          retention_years?: number | null
          updated_at?: string
        }
        Update: {
          citation?: string | null
          created_at?: string
          id?: string
          label?: string
          note?: string | null
          permanent?: boolean
          record_class?: string
          retention_years?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          contact_email: string | null
          id: number
          municipality_name: string
          notice_days: number
          posting_deadline_hours: number
          public_comment_enabled: boolean
          tagline: string | null
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          id?: number
          municipality_name?: string
          notice_days?: number
          posting_deadline_hours?: number
          public_comment_enabled?: boolean
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          id?: number
          municipality_name?: string
          notice_days?: number
          posting_deadline_hours?: number
          public_comment_enabled?: boolean
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      speaker_queue: {
        Row: {
          affiliation: string | null
          agenda_item_id: string | null
          comment_id: string | null
          created_at: string
          id: string
          meeting_id: string
          position: number
          seconds_allowed: number
          seconds_used: number | null
          speaker_name: string
          started_at: string | null
          status: Database["public"]["Enums"]["speaker_status"]
          updated_at: string
        }
        Insert: {
          affiliation?: string | null
          agenda_item_id?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          meeting_id: string
          position?: number
          seconds_allowed?: number
          seconds_used?: number | null
          speaker_name: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["speaker_status"]
          updated_at?: string
        }
        Update: {
          affiliation?: string | null
          agenda_item_id?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          meeting_id?: string
          position?: number
          seconds_allowed?: number
          seconds_used?: number | null
          speaker_name?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["speaker_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "speaker_queue_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speaker_queue_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "public_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speaker_queue_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          body_id: string | null
          confirmed: boolean
          created_at: string
          email: string
          id: string
          notify_agendas: boolean
          notify_changes: boolean
          notify_minutes: boolean
          token: string
          updated_at: string
        }
        Insert: {
          body_id?: string | null
          confirmed?: boolean
          created_at?: string
          email: string
          id?: string
          notify_agendas?: boolean
          notify_changes?: boolean
          notify_minutes?: boolean
          token?: string
          updated_at?: string
        }
        Update: {
          body_id?: string | null
          confirmed?: boolean
          created_at?: string
          email?: string
          id?: string
          notify_agendas?: boolean
          notify_changes?: boolean
          notify_minutes?: boolean
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "bodies"
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
      vote_rules: {
        Row: {
          abstain_counts_as: string
          basis: Database["public"]["Enums"]["vote_basis"]
          created_at: string
          description: string | null
          fraction: number
          id: string
          name: string
          recusal_reduces_base: boolean
          updated_at: string
        }
        Insert: {
          abstain_counts_as?: string
          basis?: Database["public"]["Enums"]["vote_basis"]
          created_at?: string
          description?: string | null
          fraction?: number
          id?: string
          name: string
          recusal_reduces_base?: boolean
          updated_at?: string
        }
        Update: {
          abstain_counts_as?: string
          basis?: Database["public"]["Enums"]["vote_basis"]
          created_at?: string
          description?: string | null
          fraction?: number
          id?: string
          name?: string
          recusal_reduces_base?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      votes: {
        Row: {
          choice: Database["public"]["Enums"]["vote_choice"]
          created_at: string
          id: string
          member_id: string
          motion_id: string
          recorded_by: string | null
        }
        Insert: {
          choice: Database["public"]["Enums"]["vote_choice"]
          created_at?: string
          id?: string
          member_id: string
          motion_id: string
          recorded_by?: string | null
        }
        Update: {
          choice?: Database["public"]["Enums"]["vote_choice"]
          created_at?: string
          id?: string
          member_id?: string
          motion_id?: string
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "votes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_motion_id_fkey"
            columns: ["motion_id"]
            isOneToOne: false
            referencedRelation: "motions"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_instances: {
        Row: {
          created_at: string
          id: string
          item_id: string
          state: Database["public"]["Enums"]["workflow_state"]
          template_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          state?: Database["public"]["Enums"]["workflow_state"]
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          state?: Database["public"]["Enums"]["workflow_state"]
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_instances_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "legislative_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_step_actions: {
        Row: {
          acted_at: string | null
          acted_by: string | null
          approver_role: Database["public"]["Enums"]["app_role"] | null
          approver_user_id: string | null
          comment: string | null
          created_at: string
          id: string
          instance_id: string
          state: Database["public"]["Enums"]["workflow_state"]
          step_id: string | null
          step_name: string
          step_order: number
        }
        Insert: {
          acted_at?: string | null
          acted_by?: string | null
          approver_role?: Database["public"]["Enums"]["app_role"] | null
          approver_user_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          instance_id: string
          state?: Database["public"]["Enums"]["workflow_state"]
          step_id?: string | null
          step_name: string
          step_order?: number
        }
        Update: {
          acted_at?: string | null
          acted_by?: string | null
          approver_role?: Database["public"]["Enums"]["app_role"] | null
          approver_user_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          instance_id?: string
          state?: Database["public"]["Enums"]["workflow_state"]
          step_id?: string | null
          step_name?: string
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "workflow_step_actions_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "workflow_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_step_actions_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_steps: {
        Row: {
          approver_role: Database["public"]["Enums"]["app_role"] | null
          approver_user_id: string | null
          created_at: string
          id: string
          name: string
          required: boolean
          step_order: number
          template_id: string
        }
        Insert: {
          approver_role?: Database["public"]["Enums"]["app_role"] | null
          approver_user_id?: string | null
          created_at?: string
          id?: string
          name: string
          required?: boolean
          step_order?: number
          template_id: string
        }
        Update: {
          approver_role?: Database["public"]["Enums"]["app_role"] | null
          approver_user_id?: string | null
          created_at?: string
          id?: string
          name?: string
          required?: boolean
          step_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_templates: {
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_item_number: { Args: { _item_id: string }; Returns: string }
      can_manage: { Args: { _user_id: string }; Returns: boolean }
      can_submit_to_body: {
        Args: { _body_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "clerk"
        | "attorney"
        | "department_staff"
        | "board_member"
        | "viewer"
      attendance_status: "present" | "absent" | "excused" | "remote"
      comment_position: "support" | "oppose" | "neutral"
      comment_type: "speak" | "written"
      item_status:
        | "draft"
        | "in_review"
        | "approved"
        | "scheduled"
        | "adopted"
        | "failed"
        | "tabled"
        | "withdrawn"
      meeting_kind:
        | "regular"
        | "special"
        | "emergency"
        | "continued"
        | "workshop"
      meeting_status:
        | "draft"
        | "published"
        | "in_progress"
        | "adjourned"
        | "cancelled"
      moderation_status: "pending" | "approved" | "rejected"
      notice_kind:
        | "original"
        | "amended"
        | "cancellation"
        | "continuation"
        | "emergency"
      request_status:
        | "received"
        | "in_progress"
        | "awaiting_clarification"
        | "fulfilled"
        | "denied"
        | "withdrawn"
      reset_policy: "annual" | "never"
      speaker_status: "waiting" | "speaking" | "done" | "yielded"
      vote_basis: "present" | "full_membership" | "quorum"
      vote_choice: "aye" | "nay" | "abstain" | "recuse" | "absent"
      workflow_state: "pending" | "approved" | "rejected" | "skipped"
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
        "clerk",
        "attorney",
        "department_staff",
        "board_member",
        "viewer",
      ],
      attendance_status: ["present", "absent", "excused", "remote"],
      comment_position: ["support", "oppose", "neutral"],
      comment_type: ["speak", "written"],
      item_status: [
        "draft",
        "in_review",
        "approved",
        "scheduled",
        "adopted",
        "failed",
        "tabled",
        "withdrawn",
      ],
      meeting_kind: [
        "regular",
        "special",
        "emergency",
        "continued",
        "workshop",
      ],
      meeting_status: [
        "draft",
        "published",
        "in_progress",
        "adjourned",
        "cancelled",
      ],
      moderation_status: ["pending", "approved", "rejected"],
      notice_kind: [
        "original",
        "amended",
        "cancellation",
        "continuation",
        "emergency",
      ],
      request_status: [
        "received",
        "in_progress",
        "awaiting_clarification",
        "fulfilled",
        "denied",
        "withdrawn",
      ],
      reset_policy: ["annual", "never"],
      speaker_status: ["waiting", "speaking", "done", "yielded"],
      vote_basis: ["present", "full_membership", "quorum"],
      vote_choice: ["aye", "nay", "abstain", "recuse", "absent"],
      workflow_state: ["pending", "approved", "rejected", "skipped"],
    },
  },
} as const
