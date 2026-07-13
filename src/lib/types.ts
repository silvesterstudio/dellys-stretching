// Hand-maintained DB types mirroring supabase/migrations. Keep in sync with SQL.
// (You can regenerate with `supabase gen types typescript` once the CLI is set up.)

export type ClassAudience = "adult" | "child";
export type BookingStatus =
  | "pending"
  | "booked"
  | "attended"
  | "no_show"
  | "cancelled";
export type SessionStatus = "scheduled" | "cancelled";
export type MembershipRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";
export type UserRole = "client" | "admin" | "reception";
export type Locale = "ro" | "ru";

export interface Database {
  public: {
    Tables: {
      class_types: {
        Row: {
          id: string;
          key: string;
          audience: ClassAudience;
          name_ro: string;
          name_ru: string;
          description_ro: string | null;
          description_ru: string | null;
          color: string;
          category: string;
          default_capacity: number;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          audience: ClassAudience;
          name_ro: string;
          name_ru: string;
          description_ro?: string | null;
          description_ru?: string | null;
          color?: string;
          category?: string;
          default_capacity?: number;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["class_types"]["Insert"]>;
        Relationships: [];
      };
      guest_bookings: {
        Row: {
          id: string;
          session_id: string | null;
          full_name: string;
          phone: string;
          child_name: string | null;
          status: "new" | "contacted" | "confirmed" | "cancelled";
          lang: Locale;
          class_name: string | null;
          starts_at: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id?: string | null;
          full_name: string;
          phone: string;
          child_name?: string | null;
          status?: "new" | "contacted" | "confirmed" | "cancelled";
          lang?: Locale;
          class_name?: string | null;
          starts_at?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["guest_bookings"]["Insert"]>;
        Relationships: [];
      };
      free_trial_usage: {
        Row: {
          user_id: string;
          category: string;
          used_at: string;
        };
        Insert: {
          user_id: string;
          category: string;
          used_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["free_trial_usage"]["Insert"]>;
        Relationships: [];
      };
      weekly_templates: {
        Row: {
          id: string;
          class_type_id: string;
          weekday: number; // 0=Sunday .. 6=Saturday
          start_time: string; // "HH:MM"
          duration_min: number;
          capacity: number;
          instructor: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          class_type_id: string;
          weekday: number;
          start_time: string;
          duration_min?: number;
          capacity?: number;
          instructor?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["weekly_templates"]["Insert"]>;
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          class_type_id: string;
          template_id: string | null;
          starts_at: string; // timestamptz ISO
          duration_min: number;
          capacity: number;
          instructor: string | null;
          status: SessionStatus;
          booked_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          class_type_id: string;
          template_id?: string | null;
          starts_at: string;
          duration_min?: number;
          capacity?: number;
          instructor?: string | null;
          status?: SessionStatus;
          booked_count?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sessions"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          phone: string | null;
          preferred_lang: Locale;
          role: UserRole;
          notes: string | null;
          dashboard_access: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          phone?: string | null;
          preferred_lang?: Locale;
          role?: UserRole;
          notes?: string | null;
          dashboard_access?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      children: {
        Row: {
          id: string;
          parent_id: string;
          name: string;
          birth_year: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          parent_id: string;
          name: string;
          birth_year?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["children"]["Insert"]>;
        Relationships: [];
      };
      membership_plans: {
        Row: {
          id: string;
          audience: ClassAudience;
          name_ro: string;
          name_ru: string;
          session_count: number;
          price: number;
          currency: string;
          validity_days: number;
          active: boolean;
          featured: boolean;
          sort_order: number;
          system_key: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          audience: ClassAudience;
          name_ro: string;
          name_ru: string;
          session_count: number;
          price: number;
          currency?: string;
          validity_days?: number;
          active?: boolean;
          featured?: boolean;
          sort_order?: number;
          system_key?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["membership_plans"]["Insert"]>;
        Relationships: [];
      };
      legacy_memberships: {
        Row: {
          id: string;
          full_name: string | null;
          phone: string | null;
          phone_norm: string | null;
          email: string | null;
          audience: ClassAudience;
          plan_label: string | null;
          sessions_remaining: number;
          expires_at: string;
          note: string | null;
          status: "pending" | "claimed" | "void";
          claimed_by_user_id: string | null;
          claimed_membership_id: string | null;
          claimed_at: string | null;
          imported_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          full_name?: string | null;
          phone?: string | null;
          email?: string | null;
          audience?: ClassAudience;
          plan_label?: string | null;
          sessions_remaining?: number;
          expires_at: string;
          note?: string | null;
          status?: "pending" | "claimed" | "void";
          claimed_by_user_id?: string | null;
          claimed_membership_id?: string | null;
          claimed_at?: string | null;
          imported_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["legacy_memberships"]["Insert"]>;
        Relationships: [];
      };
      membership_requests: {
        Row: {
          id: string;
          user_id: string;
          plan_id: string;
          status: MembershipRequestStatus;
          note: string | null;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          membership_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_id: string;
          status?: MembershipRequestStatus;
          note?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          membership_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["membership_requests"]["Insert"]>;
        Relationships: [];
      };
      user_memberships: {
        Row: {
          id: string;
          user_id: string;
          plan_id: string;
          sessions_remaining: number;
          expires_at: string;
          assigned_by: string | null;
          note: string | null;
          frozen: boolean;
          freeze_start_date: string | null;
          amount_paid: number | null;
          payment_method: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_id: string;
          sessions_remaining: number;
          expires_at: string;
          assigned_by?: string | null;
          note?: string | null;
          frozen?: boolean;
          freeze_start_date?: string | null;
          amount_paid?: number | null;
          payment_method?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_memberships"]["Insert"]>;
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          child_id: string | null;
          status: BookingStatus;
          membership_id: string | null;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          child_id?: string | null;
          status?: BookingStatus;
          membership_id?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["bookings"]["Insert"]>;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          actor_id: string | null;
          actor_email: string | null;
          action: string;
          target_type: string | null;
          target_id: string | null;
          detail: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          actor_email?: string | null;
          action: string;
          target_type?: string | null;
          target_id?: string | null;
          detail?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_log"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      book_session: {
        Args: { p_session_id: string; p_child_id: string | null };
        Returns: string; // booking id
      };
      cancel_booking: {
        Args: { p_booking_id: string };
        Returns: boolean;
      };
      check_in_booking: {
        Args: { p_booking_id: string; p_membership_id: string | null };
        Returns: boolean;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      generate_sessions: {
        Args: { p_weeks: number };
        Returns: number;
      };
      release_stale_pending: {
        Args: Record<string, never>;
        Returns: number;
      };
      request_membership: {
        Args: { p_plan_id: string };
        Returns: string; // request id
      };
      cancel_membership_request: {
        Args: { p_request_id: string };
        Returns: boolean;
      };
      decide_membership_request: {
        Args: { p_request_id: string; p_approve: boolean };
        Returns: string | null; // membership id when approved
      };
      claim_legacy_memberships: {
        Args: Record<string, never>;
        Returns: number; // how many legacy rows the caller claimed
      };
      admin_claim_legacy: {
        Args: { p_legacy_id: string; p_user_id: string };
        Returns: string; // new user_memberships id
      };
      admin_autolink_legacy: {
        Args: Record<string, never>;
        Returns: number; // how many rows were auto-linked
      };
      hold_guest_seat: {
        Args: { p_session_id: string };
        Returns: boolean; // true if a seat was held (class still open)
      };
      release_guest_seat: {
        Args: { p_session_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
