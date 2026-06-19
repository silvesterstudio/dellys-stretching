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
export type UserRole = "client" | "admin";
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
          default_capacity?: number;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["class_types"]["Insert"]>;
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
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          phone?: string | null;
          preferred_lang?: Locale;
          role?: UserRole;
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
          sort_order: number;
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
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["membership_plans"]["Insert"]>;
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
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
