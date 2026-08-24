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

// Every outcome the kiosk can show. Mirrors the codes returned by kiosk_scan()
// in migration 0024 — keep the two in sync.
export type KioskScanCode =
  | "ok"
  | "not_found" // QR belongs to no account
  | "wrong_location" // member of the other gym
  | "already_checked_in"
  | "no_class" // nothing running now they could join
  | "class_full"
  | "wrong_audience" // holds a usable bundle, but for the other audience
  | "no_membership" // nothing usable at this studio at all
  | "options"; // not a refusal: here is what you could check into, pick one

// Failures produced by the API route itself, before or instead of kiosk_scan:
// a tablet whose token isn't recognised, throttling, or a dead connection.
export type KioskTransportCode =
  | "device_unknown"
  | "rate_limited"
  | "bad_request"
  | "server_error"
  | "connection";

export type KioskResultCode = KioskScanCode | KioskTransportCode;

// One thing the member could check into: a class, and for a kids class the
// particular child. A parent with two children booked into the same class gets
// two of these, which is what makes "which one?" answerable on screen instead of
// by scanning twice.
export interface KioskOption {
  sessionId: string;
  childId: string | null;
  // Who this seat is for — the child for a kids class, else the member.
  personName: string;
  className_ro: string;
  className_ru: string;
  color: string | null;
  startsAt: string;
  // They already hold this seat, as opposed to walking in on it.
  reserved: boolean;
  payable: boolean;
}

export interface KioskScanResult {
  ok: boolean;
  code: KioskResultCode;
  // Who is entering. For a child's seat this is the CHILD's name, not the
  // account holder's — kids have no account of their own, so a parent's QR is
  // what admits them and the screen must still name the right person.
  clientName?: string | null;
  // The account holder, set only when clientName above is a child.
  parentName?: string | null;
  // How many more seats on this QR are still unscanned for this class, i.e. a
  // second child the parent has to scan for.
  alsoBooked?: number | null;
  homeLocation?: string | null;
  className_ro?: string | null;
  className_ru?: string | null;
  color?: string | null;
  startsAt?: string | null;
  walkIn?: boolean;
  freeTrial?: boolean;
  sessionsRemaining?: number | null;
  // Present only on code === "options": what this QR could check into now.
  options?: KioskOption[];
  // Present when more than one seat was taken in a single confirm: every entry
  // that went through, and every one that did not. A parent checking in two
  // children is one trip through the door, so the screen names them together.
  admitted?: KioskScanResult[];
  refused?: KioskScanResult[];
}

export interface Database {
  public: {
    Tables: {
      locations: {
        Row: {
          id: string;
          key: string;
          name: string;
          address_ro: string;
          address_ru: string;
          phone: string | null;
          maps_url: string | null;
          active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          name: string;
          address_ro?: string;
          address_ru?: string;
          phone?: string | null;
          maps_url?: string | null;
          active?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["locations"]["Insert"]>;
        Relationships: [];
      };
      kiosk_devices: {
        Row: {
          id: string;
          token: string;
          label: string | null;
          location_id: string;
          active: boolean;
          last_seen_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          token: string;
          label?: string | null;
          location_id: string;
          active?: boolean;
          last_seen_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["kiosk_devices"]["Insert"]>;
        Relationships: [];
      };
      checkin_logs: {
        Row: {
          id: string;
          user_id: string | null;
          booking_id: string | null;
          session_id: string | null;
          location_id: string | null;
          membership_id: string | null;
          device_id: string | null;
          result: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          booking_id?: string | null;
          session_id?: string | null;
          location_id?: string | null;
          membership_id?: string | null;
          device_id?: string | null;
          result: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["checkin_logs"]["Insert"]>;
        Relationships: [];
      };
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
          category: string | null;
          claimed_by: string | null;
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
          category?: string | null;
          claimed_by?: string | null;
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
          location_id: string;
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
          location_id: string;
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
          location_id: string;
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
          location_id: string;
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
          // Client: their home gym. Staff: the gym they run — null means all gyms.
          location_id: string | null;
          // Permanent QR identity. Bearer credential: never render it anywhere
          // other than the owner's own dashboard.
          qr_uuid: string;
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
          location_id?: string | null;
          qr_uuid?: string;
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
          location_id: string;
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
          location_id: string;
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
      link_guest_bookings: {
        Args: { p_user: string; p_phone: string };
        Returns: number;
      };
      guest_funnel_stats: {
        Args: Record<string, never>;
        Returns: { guests: number; accounts: number; memberships: number };
      };
      // Front-door QR check-in, one call: resolves the tablet from its token,
      // stamps its heartbeat and decides. Service role only. This is what the
      // API route uses; kiosk_scan below is the core it delegates to.
      kiosk_scan_by_token: {
        Args: { p_qr: string; p_device_token: string };
        Returns: KioskScanResult;
      };
      // Step one of the door: who is this, and what could they check into now.
      // Writes nothing, so a member who walks away mid-list leaves no trace.
      kiosk_options: {
        Args: { p_qr: string; p_device_token: string };
        Returns: KioskScanResult;
      };
      // Step two: do the one they tapped. Re-applies every guard — the list was
      // a suggestion made seconds ago by a tablet nobody trusts.
      kiosk_check_in_choice: {
        Args: { p_qr: string; p_device_token: string; p_session: string; p_child: string | null };
        Returns: KioskScanResult;
      };
      // The decision itself, taking an already-resolved location. Kept callable
      // on its own so the front desk / tests can drive it directly.
      kiosk_scan: {
        Args: { p_qr: string; p_location: string; p_device?: string | null };
        Returns: KioskScanResult;
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
