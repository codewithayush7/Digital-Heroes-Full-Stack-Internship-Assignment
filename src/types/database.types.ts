export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "subscriber" | "admin";
export type SubscriptionPlan = "monthly" | "yearly";
export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "canceled"
  | "past_due"
  | "unpaid"
  | "incomplete"
  | "lapsed";
export type DrawStatus = "draft" | "simulated" | "published" | "completed";
export type DrawMode = "random" | "algorithmic";
export type PrizeTier = "tier_5" | "tier_4" | "tier_3";
export type WinnerVerificationStatus =
  | "pending_submission"
  | "pending_review"
  | "approved"
  | "rejected";
export type WinnerPaymentStatus = "pending" | "paid";
export type DonationType = "subscription_allocation" | "independent";
export type DonationStatus = "pending" | "completed" | "failed";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: UserRole;
          charity_id: string | null;
          charity_contribution_pct: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: UserRole;
          charity_id?: string | null;
          charity_contribution_pct?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: UserRole;
          charity_id?: string | null;
          charity_contribution_pct?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          plan_type: SubscriptionPlan;
          status: SubscriptionStatus;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          amount: number;
          currency: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          plan_type: SubscriptionPlan;
          status: SubscriptionStatus;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          amount: number;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          plan_type?: SubscriptionPlan;
          status?: SubscriptionStatus;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          amount?: number;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      charities: {
        Row: {
          id: string;
          name: string;
          slug: string;
          tagline: string | null;
          description: string;
          logo_url: string | null;
          cover_image_url: string | null;
          gallery_images: string[];
          is_featured: boolean;
          website_url: string | null;
          total_funds_raised: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          tagline?: string | null;
          description: string;
          logo_url?: string | null;
          cover_image_url?: string | null;
          gallery_images?: string[];
          is_featured?: boolean;
          website_url?: string | null;
          total_funds_raised?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          tagline?: string | null;
          description?: string;
          logo_url?: string | null;
          cover_image_url?: string | null;
          gallery_images?: string[];
          is_featured?: boolean;
          website_url?: string | null;
          total_funds_raised?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      charity_events: {
        Row: {
          id: string;
          charity_id: string;
          title: string;
          description: string | null;
          event_date: string;
          location: string | null;
          event_type: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          charity_id: string;
          title: string;
          description?: string | null;
          event_date: string;
          location?: string | null;
          event_type?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          charity_id?: string;
          title?: string;
          description?: string | null;
          event_date?: string;
          location?: string | null;
          event_type?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      golf_scores: {
        Row: {
          id: string;
          user_id: string;
          score: number;
          played_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          score: number;
          played_date: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          score?: number;
          played_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      draws: {
        Row: {
          id: string;
          title: string;
          draw_date: string;
          cadence: string;
          status: DrawStatus;
          draw_mode: DrawMode;
          drawn_numbers: number[] | null;
          total_active_subscribers: number;
          subscription_pool_portion: number;
          rollover_jackpot_in: number;
          total_prize_pool: number;
          tier_5_pool: number;
          tier_4_pool: number;
          tier_3_pool: number;
          unclaimed_tier_4: number;
          unclaimed_tier_3: number;
          jackpot_rolled_over: boolean;
          rollover_jackpot_out: number;
          published_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          draw_date: string;
          cadence?: string;
          status?: DrawStatus;
          draw_mode: DrawMode;
          drawn_numbers?: number[] | null;
          total_active_subscribers?: number;
          subscription_pool_portion?: number;
          rollover_jackpot_in?: number;
          total_prize_pool?: number;
          tier_5_pool?: number;
          tier_4_pool?: number;
          tier_3_pool?: number;
          unclaimed_tier_4?: number;
          unclaimed_tier_3?: number;
          jackpot_rolled_over?: boolean;
          rollover_jackpot_out?: number;
          published_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          draw_date?: string;
          cadence?: string;
          status?: DrawStatus;
          draw_mode?: DrawMode;
          drawn_numbers?: number[] | null;
          total_active_subscribers?: number;
          subscription_pool_portion?: number;
          rollover_jackpot_in?: number;
          total_prize_pool?: number;
          tier_5_pool?: number;
          tier_4_pool?: number;
          tier_3_pool?: number;
          unclaimed_tier_4?: number;
          unclaimed_tier_3?: number;
          jackpot_rolled_over?: boolean;
          rollover_jackpot_out?: number;
          published_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      draw_entries: {
        Row: {
          id: string;
          draw_id: string;
          user_id: string;
          scores_snapshot: number[];
          matches_count: number;
          matched_numbers: number[];
          winning_tier: PrizeTier | null;
          prize_amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          draw_id: string;
          user_id: string;
          scores_snapshot: number[];
          matches_count?: number;
          matched_numbers?: number[];
          winning_tier?: PrizeTier | null;
          prize_amount?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          draw_id?: string;
          user_id?: string;
          scores_snapshot?: number[];
          matches_count?: number;
          matched_numbers?: number[];
          winning_tier?: PrizeTier | null;
          prize_amount?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      winners: {
        Row: {
          id: string;
          draw_entry_id: string;
          user_id: string;
          draw_id: string;
          tier: PrizeTier;
          prize_amount: number;
          verification_status: WinnerVerificationStatus;
          proof_image_url: string | null;
          proof_submitted_at: string | null;
          admin_notes: string | null;
          payment_status: WinnerPaymentStatus;
          paid_at: string | null;
          reviewed_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          draw_entry_id: string;
          user_id: string;
          draw_id: string;
          tier: PrizeTier;
          prize_amount: number;
          verification_status?: WinnerVerificationStatus;
          proof_image_url?: string | null;
          proof_submitted_at?: string | null;
          admin_notes?: string | null;
          payment_status?: WinnerPaymentStatus;
          paid_at?: string | null;
          reviewed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          draw_entry_id?: string;
          user_id?: string;
          draw_id?: string;
          tier?: PrizeTier;
          prize_amount?: number;
          verification_status?: WinnerVerificationStatus;
          proof_image_url?: string | null;
          proof_submitted_at?: string | null;
          admin_notes?: string | null;
          payment_status?: WinnerPaymentStatus;
          paid_at?: string | null;
          reviewed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      donations: {
        Row: {
          id: string;
          user_id: string | null;
          charity_id: string;
          amount: number;
          currency: string;
          donation_type: DonationType;
          stripe_payment_id: string | null;
          status: DonationStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          charity_id: string;
          amount: number;
          currency?: string;
          donation_type: DonationType;
          stripe_payment_id?: string | null;
          status?: DonationStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          charity_id?: string;
          amount?: number;
          currency?: string;
          donation_type?: DonationType;
          stripe_payment_id?: string | null;
          status?: DonationStatus;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
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

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Profile = Tables<"profiles">;
