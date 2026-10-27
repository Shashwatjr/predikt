-- INFERRED LOCAL REHEARSAL ONLY. Review before any upgrade use.
CREATE TYPE "RoomStatus" AS ENUM ('created', 'predictions_open', 'predictions_locked', 'live', 'completed', 'cancelled');

CREATE TYPE "Visibility" AS ENUM ('private', 'invite_only', 'public');

CREATE TYPE "LocationDisplayMode" AS ENUM ('ghost', 'approximate', 'delayed', 'exact', 'progress', 'fuzzy', 'delayed_trail', 'trusted_circle', 'verified_arrival');

CREATE TYPE "PredictionVisibilityMode" AS ENUM ('hidden_until_lock', 'visible_after_submit', 'creator_visible');

CREATE TYPE "ReportType" AS ENUM ('harassment', 'spam', 'betting_or_cash', 'unsafe_location', 'inappropriate_content', 'fake_result', 'other');

CREATE TYPE "ReportStatus" AS ENUM ('submitted', 'in_review', 'resolved', 'dismissed');

CREATE TYPE "DisputeStatus" AS ENUM ('submitted', 'in_review', 'resolved', 'dismissed');

CREATE TYPE "MilestoneType" AS ENUM ('intermediate', 'final_destination');

CREATE TYPE "MilestoneStatus" AS ENUM ('pending', 'prediction_open', 'prediction_locked', 'reached', 'cancelled');

CREATE TYPE "CloutTransactionType" AS ENUM ('earn', 'spend', 'adjustment', 'expire');

CREATE TYPE "RewardType" AS ENUM ('AURA', 'RIZZ', 'GEMS');

CREATE TYPE "DropType" AS ENUM ('voucher', 'flex', 'aura_boost', 'creator_perk', 'mystery_drop');

CREATE TYPE "DropStatus" AS ENUM ('active', 'inactive', 'expired');

CREATE TYPE "UserDropStatus" AS ENUM ('unlocked', 'redeemed', 'expired');

CREATE TYPE "RoomDropRuleType" AS ENUM ('overall_winner', 'exact_hit', 'beat_ai', 'clout_unlock', 'milestone_winner');

CREATE TYPE "FlexType" AS ENUM ('exact_hit', 'dot_hunter', 'dot_master', 'sharp_shot', 'near_perfect', 'streak', 'beat_ai', 'milestone_master', 'room_champion', 'early_user');

CREATE TYPE "SocialMode" AS ENUM ('none', 'instagram_live', 'facebook_live', 'youtube_live', 'custom');

CREATE TYPE "RoomCategory" AS ENUM ('journey', 'milestone_journey', 'fitness', 'delivery', 'travel', 'creator_challenge', 'brand_room', 'ai_vs_human', 'custom');

CREATE TYPE "MovementAvatarType" AS ENUM ('car', 'bike', 'delivery_bike', 'walker', 'runner', 'truck', 'train', 'flight', 'bus', 'custom');

CREATE TYPE "CreatorVerificationStatus" AS ENUM ('pending_review', 'verified', 'active', 'suspended', 'rejected');

CREATE TYPE "PlanType" AS ENUM ('free', 'creator_starter', 'creator_pro', 'creator_max', 'brand_starter', 'brand_growth', 'enterprise');

CREATE TYPE "PlanStatus" AS ENUM ('active', 'inactive', 'deprecated');

CREATE TYPE "SponsorStatus" AS ENUM ('active', 'inactive', 'pending_review', 'suspended');

CREATE TYPE "CampaignType" AS ENUM ('sponsored_journey', 'delivery_dash', 'road_trip_challenge', 'fitness_challenge', 'creator_live', 'brand_room', 'ai_vs_human', 'custom');

CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'pending_approval', 'active', 'paused', 'completed', 'cancelled');

CREATE TYPE "AdminStatus" AS ENUM ('active', 'suspended', 'disabled');

CREATE TYPE "ConsentType" AS ENUM ('terms_acceptance', 'privacy_policy_acceptance', 'location_processing', 'creator_public_profile', 'marketing_communications', 'sponsored_campaign_participation', 'analytics_processing', 'ai_prediction_comparison');

CREATE TYPE "ConsentStatus" AS ENUM ('granted', 'withdrawn', 'denied');

CREATE TYPE "PrivacyRequestType" AS ENUM ('access', 'delete', 'rectify', 'export', 'restrict', 'object', 'withdraw_consent');

CREATE TYPE "PrivacyRequestStatus" AS ENUM ('submitted', 'in_review', 'verified', 'processing', 'completed', 'rejected');

CREATE TYPE "AiSystemStatus" AS ENUM ('planned', 'active', 'retired');

CREATE TABLE "users" (
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "predikt_handle" TEXT,
    "profile_image" TEXT,
    "avatar_key" TEXT,
    "selected_background_key" TEXT,
    "password_hash" TEXT,
    "is_guest" BOOLEAN NOT NULL DEFAULT false,
    "guest_key" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "total_aura" INTEGER NOT NULL DEFAULT 0,
    "weekly_aura" INTEGER NOT NULL DEFAULT 0,
    "clout_balance" INTEGER NOT NULL DEFAULT 0,
    "lifetime_clout_earned" INTEGER NOT NULL DEFAULT 0,
    "credit_balance" INTEGER NOT NULL DEFAULT 0,
    "prediction_accuracy_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rooms_created_count" INTEGER NOT NULL DEFAULT 0,
    "predictions_made_count" INTEGER NOT NULL DEFAULT 0,
    "wins_count" INTEGER NOT NULL DEFAULT 0,
    "current_streak" INTEGER NOT NULL DEFAULT 0,
    "longest_streak" INTEGER NOT NULL DEFAULT 0,
    "terms_accepted_at" TIMESTAMP(3),
    "privacy_accepted_at" TIMESTAMP(3),
    "marketing_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "ai_personalisation_opt_out" BOOLEAN NOT NULL DEFAULT false,
    "preferred_commentary_personality" TEXT,
    "ai_commentary_opt_out" BOOLEAN NOT NULL DEFAULT false,
    "commentary_enabled" BOOLEAN NOT NULL DEFAULT true,
    "commentary_tone_level" TEXT NOT NULL DEFAULT 'playful',
    "location_consent_status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "prediction_rooms" (
    "room_id" TEXT NOT NULL,
    "creator_user_id" TEXT NOT NULL,
    "room_title" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "category" TEXT,
    "mode" TEXT,
    "template_key" TEXT,
    "baseline_source" TEXT,
    "baseline_label" TEXT,
    "baseline_value" JSONB,
    "baseline_snapshot" JSONB,
    "baseline_captured_at" TIMESTAMP(3),
    "provider_name" TEXT,
    "provider_confidence" TEXT,
    "host_prediction" JSONB,
    "oracle_bot_prediction" JSONB,
    "options" JSONB,
    "room_type" TEXT NOT NULL DEFAULT 'journey',
    "answer_type" TEXT NOT NULL DEFAULT 'exact_time',
    "prediction_mode" TEXT NOT NULL DEFAULT 'milestone',
    "prediction_visibility_mode" "PredictionVisibilityMode" NOT NULL DEFAULT 'hidden_until_lock',
    "room_category" "RoomCategory" NOT NULL DEFAULT 'journey',
    "starting_point_label" TEXT NOT NULL,
    "destination_label" TEXT NOT NULL,
    "starting_lat" DOUBLE PRECISION,
    "starting_lng" DOUBLE PRECISION,
    "destination_lat" DOUBLE PRECISION,
    "destination_lng" DOUBLE PRECISION,
    "status" "RoomStatus" NOT NULL DEFAULT 'created',
    "visibility" "Visibility" NOT NULL DEFAULT 'invite_only',
    "location_display_mode" "LocationDisplayMode" NOT NULL DEFAULT 'approximate',
    "safety_delay_minutes" INTEGER NOT NULL DEFAULT 10,
    "visible_movement_start_time" TIMESTAMP(3),
    "disable_route_replay" BOOLEAN NOT NULL DEFAULT true,
    "hide_exact_start" BOOLEAN NOT NULL DEFAULT true,
    "hide_exact_destination" BOOLEAN NOT NULL DEFAULT true,
    "auto_pause_near_destination" BOOLEAN NOT NULL DEFAULT true,
    "social_mode" "SocialMode" NOT NULL DEFAULT 'none',
    "creator_social_platform" TEXT,
    "creator_social_handle" TEXT,
    "social_live_url" TEXT,
    "pinned_comment_text" TEXT,
    "share_card_title" TEXT,
    "share_card_subtitle" TEXT,
    "instagram_story_text" TEXT,
    "facebook_post_text" TEXT,
    "qr_code_payload" TEXT,
    "result_share_text" TEXT,
    "movement_avatar_type" "MovementAvatarType" NOT NULL DEFAULT 'car',
    "movement_avatar_url" TEXT,
    "is_sponsored" BOOLEAN NOT NULL DEFAULT false,
    "sponsor_name" TEXT,
    "sponsor_logo_url" TEXT,
    "sponsor_brand_color" TEXT,
    "sponsor_tagline" TEXT,
    "result_card_sponsor_text" TEXT,
    "invite_code" TEXT NOT NULL,
    "rematch_of_room_id" TEXT,
    "planned_start_time" TIMESTAMP(3),
    "start_time" TIMESTAMP(3),
    "prediction_close_time" TIMESTAMP(3) NOT NULL,
    "lock_time" TIMESTAMP(3),
    "edit_deadline" TIMESTAMP(3),
    "result_deadline" TIMESTAMP(3),
    "journey_status" TEXT NOT NULL DEFAULT 'scheduled',
    "journey_scheduled_start_at" TIMESTAMP(3),
    "journey_started_at" TIMESTAMP(3),
    "last_traveller_update_at" TIMESTAMP(3),
    "expected_duration_seconds" INTEGER,
    "grace_period_seconds" INTEGER,
    "auto_close_at" TIMESTAMP(3),
    "no_start_cutoff_at" TIMESTAMP(3),
    "arrival_confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "auto_closed_at" TIMESTAMP(3),
    "abandoned_at" TIMESTAMP(3),
    "closure_reason_code" TEXT,
    "closure_note" TEXT,
    "scoring_rule" JSONB,
    "outcome_source" TEXT,
    "confidence_level" TEXT,
    "selected_background" TEXT,
    "selected_room_theme" TEXT,
    "participant_safety_message" TEXT NOT NULL DEFAULT 'Location shown with delay for safety.',
    "result_disputed" BOOLEAN NOT NULL DEFAULT false,
    "rewards_suppressed" BOOLEAN NOT NULL DEFAULT false,
    "actual_end_time" TIMESTAMP(3),
    "ai_predicted_time" TIMESTAMP(3),
    "map_predicted_time" TIMESTAMP(3),
    "crowd_average_time" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prediction_rooms_pkey" PRIMARY KEY ("room_id")
);

CREATE TABLE "room_commentaries" (
    "commentary_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "generated_by_user_id" TEXT,
    "personality" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "punchline" TEXT NOT NULL,
    "supporting_line" TEXT,
    "safety_mode" TEXT NOT NULL DEFAULT 'deterministic',
    "provider" TEXT NOT NULL DEFAULT 'templates',
    "provider_version" TEXT,
    "template_key" TEXT,
    "generation_version" INTEGER NOT NULL DEFAULT 1,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "regenerated_at" TIMESTAMP(3),
    "moderation_status" TEXT NOT NULL DEFAULT 'approved',
    "moderation_reason" TEXT,
    "reported_count" INTEGER NOT NULL DEFAULT 0,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_commentaries_pkey" PRIMARY KEY ("commentary_id")
);

CREATE TABLE "user_badges" (
    "user_badge_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "badge_key" TEXT NOT NULL,
    "room_id" TEXT,
    "category" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT,
    "awarded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("user_badge_id")
);

CREATE TABLE "room_milestones" (
    "milestone_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "milestone_order" INTEGER NOT NULL,
    "milestone_name" TEXT NOT NULL,
    "milestone_type" "MilestoneType" NOT NULL DEFAULT 'intermediate',
    "location_label" TEXT,
    "milestone_lat" DOUBLE PRECISION,
    "milestone_lng" DOUBLE PRECISION,
    "prediction_close_time" TIMESTAMP(3),
    "actual_reached_time" TIMESTAMP(3),
    "actual_option_key" TEXT,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'pending',
    "aura_multiplier" DECIMAL(5,2) NOT NULL DEFAULT 1.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_milestones_pkey" PRIMARY KEY ("milestone_id")
);

CREATE TABLE "milestone_predictions" (
    "prediction_id" TEXT NOT NULL,
    "milestone_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "predicted_reached_time" TIMESTAMP(3) NOT NULL,
    "selected_option_key" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edit_deadline" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "locked_status" BOOLEAN NOT NULL DEFAULT false,
    "difference_from_actual_minutes" DOUBLE PRECISION,
    "difference_from_actual_seconds" INTEGER,
    "rank_for_milestone" INTEGER,
    "base_aura" INTEGER NOT NULL DEFAULT 0,
    "rank_bonus_aura" INTEGER NOT NULL DEFAULT 0,
    "multiplier" DECIMAL(5,2) NOT NULL DEFAULT 1.0,
    "total_aura_awarded" INTEGER NOT NULL DEFAULT 0,
    "clout_awarded" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "milestone_predictions_pkey" PRIMARY KEY ("prediction_id")
);

CREATE TABLE "room_results" (
    "room_result_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "total_room_aura" INTEGER NOT NULL DEFAULT 0,
    "total_room_clout" INTEGER NOT NULL DEFAULT 0,
    "milestones_won" INTEGER NOT NULL DEFAULT 0,
    "overall_rank" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_results_pkey" PRIMARY KEY ("room_result_id")
);

CREATE TABLE "user_room_preferences" (
    "user_room_preference_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "hidden_from_dashboard" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_room_preferences_pkey" PRIMARY KEY ("user_room_preference_id")
);

CREATE TABLE "room_memberships" (
    "membership_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL,
    "left_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_memberships_pkey" PRIMARY KEY ("membership_id")
);

CREATE TABLE "user_notifications" (
    "notification_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "room_id" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "action_label" TEXT,
    "action_target" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("notification_id")
);

CREATE TABLE "user_reliability_ledger" (
    "reliability_ledger_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "room_id" TEXT,
    "event_type" TEXT NOT NULL,
    "points_delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_reliability_ledger_pkey" PRIMARY KEY ("reliability_ledger_id")
);

CREATE TABLE "live_location_events" (
    "location_event_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "creator_user_id" TEXT NOT NULL,
    "raw_lat" DOUBLE PRECISION,
    "raw_lng" DOUBLE PRECISION,
    "progress_percentage" DOUBLE PRECISION,
    "eta_minutes" INTEGER,
    "display_lat" DOUBLE PRECISION,
    "display_lng" DOUBLE PRECISION,
    "current_milestone_id" TEXT,
    "location_display_mode" "LocationDisplayMode" NOT NULL DEFAULT 'approximate',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_location_events_pkey" PRIMARY KEY ("location_event_id")
);

CREATE TABLE "aura_transactions" (
    "transaction_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "room_id" TEXT,
    "milestone_id" TEXT,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aura_transactions_pkey" PRIMARY KEY ("transaction_id")
);

CREATE TABLE "clout_transactions" (
    "transaction_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "room_id" TEXT,
    "milestone_id" TEXT,
    "amount" INTEGER NOT NULL,
    "transaction_type" "CloutTransactionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clout_transactions_pkey" PRIMARY KEY ("transaction_id")
);

CREATE TABLE "credit_ledger" (
    "credit_ledger_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "source_id" TEXT,
    "source_type" TEXT,
    "idempotency_key" TEXT,
    "expires_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledger_pkey" PRIMARY KEY ("credit_ledger_id")
);

CREATE TABLE "reward_accounts" (
    "reward_account_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "aura_balance" INTEGER NOT NULL DEFAULT 0,
    "rizz_balance" INTEGER NOT NULL DEFAULT 0,
    "gem_balance" INTEGER NOT NULL DEFAULT 0,
    "lifetime_aura" INTEGER NOT NULL DEFAULT 0,
    "lifetime_rizz" INTEGER NOT NULL DEFAULT 0,
    "lifetime_gems" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reward_accounts_pkey" PRIMARY KEY ("reward_account_id")
);

CREATE TABLE "reward_ledger_entries" (
    "reward_ledger_entry_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reward_type" "RewardType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reason_code" TEXT NOT NULL,
    "source_type" TEXT,
    "source_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_ledger_entries_pkey" PRIMARY KEY ("reward_ledger_entry_id")
);

CREATE TABLE "reward_rules" (
    "reason_code" TEXT NOT NULL,
    "reward_type" "RewardType" NOT NULL,
    "base_amount" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "daily_cap" INTEGER,
    "per_source_cap" INTEGER,
    "config_json" JSONB,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reward_rules_pkey" PRIMARY KEY ("reason_code")
);

CREATE TABLE "user_sessions" (
    "user_session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("user_session_id")
);

CREATE TABLE "reports" (
    "report_id" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "target_user_id" TEXT,
    "room_id" TEXT,
    "report_type" "ReportType" NOT NULL,
    "reason" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'submitted',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("report_id")
);

CREATE TABLE "user_blocks" (
    "blocker_id" TEXT NOT NULL,
    "blocked_id" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("blocker_id","blocked_id")
);

CREATE TABLE "room_disputes" (
    "dispute_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'submitted',
    "resolution" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "room_disputes_pkey" PRIMARY KEY ("dispute_id")
);

CREATE TABLE "result_reactions" (
    "result_reaction_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "result_reactions_pkey" PRIMARY KEY ("result_reaction_id")
);

CREATE TABLE "drops" (
    "drop_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "drop_type" "DropType" NOT NULL,
    "sponsor_name" TEXT,
    "clout_cost" INTEGER NOT NULL DEFAULT 0,
    "inventory_limit" INTEGER,
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "terms" TEXT,
    "status" "DropStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drops_pkey" PRIMARY KEY ("drop_id")
);

CREATE TABLE "user_drops" (
    "user_drop_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "drop_id" TEXT NOT NULL,
    "room_id" TEXT,
    "redemption_code" TEXT,
    "status" "UserDropStatus" NOT NULL DEFAULT 'unlocked',
    "unlocked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemed_at" TIMESTAMP(3),

    CONSTRAINT "user_drops_pkey" PRIMARY KEY ("user_drop_id")
);

CREATE TABLE "room_drop_rules" (
    "room_drop_rule_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "drop_id" TEXT NOT NULL,
    "rule_type" "RoomDropRuleType" NOT NULL,
    "max_winners" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_drop_rules_pkey" PRIMARY KEY ("room_drop_rule_id")
);

CREATE TABLE "flexes" (
    "flex_id" TEXT NOT NULL,
    "flex_name" TEXT NOT NULL,
    "flex_type" "FlexType" NOT NULL,
    "description" TEXT,
    "criteria" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flexes_pkey" PRIMARY KEY ("flex_id")
);

CREATE TABLE "user_flexes" (
    "user_flex_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "flex_id" TEXT NOT NULL,
    "room_id" TEXT,
    "milestone_id" TEXT,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_flexes_pkey" PRIMARY KEY ("user_flex_id")
);

CREATE TABLE "creator_profiles" (
    "creator_profile_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "display_name" TEXT,
    "handle" TEXT,
    "instagram_handle" TEXT,
    "facebook_page" TEXT,
    "youtube_handle" TEXT,
    "creator_category" TEXT,
    "audience_size_label" TEXT,
    "subscription_plan" TEXT,
    "verification_status" "CreatorVerificationStatus" NOT NULL DEFAULT 'pending_review',
    "revenue_share_percent" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creator_profiles_pkey" PRIMARY KEY ("creator_profile_id")
);

CREATE TABLE "subscription_plans" (
    "plan_id" TEXT NOT NULL,
    "plan_name" TEXT NOT NULL,
    "plan_type" "PlanType" NOT NULL,
    "monthly_price_inr" INTEGER,
    "yearly_price_inr" INTEGER,
    "max_rooms_per_month" INTEGER,
    "max_participants_per_room" INTEGER,
    "custom_branding_allowed" BOOLEAN NOT NULL DEFAULT false,
    "sponsored_rooms_allowed" BOOLEAN NOT NULL DEFAULT false,
    "analytics_allowed" BOOLEAN NOT NULL DEFAULT false,
    "drops_allowed" BOOLEAN NOT NULL DEFAULT true,
    "status" "PlanStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("plan_id")
);

CREATE TABLE "sponsors" (
    "sponsor_id" TEXT NOT NULL,
    "sponsor_name" TEXT NOT NULL,
    "logo_url" TEXT,
    "brand_color" TEXT,
    "website_url" TEXT,
    "industry" TEXT,
    "status" "SponsorStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sponsors_pkey" PRIMARY KEY ("sponsor_id")
);

CREATE TABLE "campaigns" (
    "campaign_id" TEXT NOT NULL,
    "sponsor_id" TEXT,
    "campaign_name" TEXT NOT NULL,
    "campaign_type" "CampaignType" NOT NULL,
    "creator_user_id" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "budget_label" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("campaign_id")
);

CREATE TABLE "campaign_metrics" (
    "metric_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "room_id" TEXT,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "joins" INTEGER NOT NULL DEFAULT 0,
    "predictions_submitted" INTEGER NOT NULL DEFAULT 0,
    "unique_participants" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "drops_unlocked" INTEGER NOT NULL DEFAULT 0,
    "drops_redeemed" INTEGER NOT NULL DEFAULT 0,
    "result_cards_shared" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_metrics_pkey" PRIMARY KEY ("metric_id")
);

CREATE TABLE "admin_roles" (
    "role_id" TEXT NOT NULL,
    "role_name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_roles_pkey" PRIMARY KEY ("role_id")
);

CREATE TABLE "admin_users" (
    "admin_user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "status" "AdminStatus" NOT NULL DEFAULT 'active',
    "last_login_at" TIMESTAMP(3),
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("admin_user_id")
);

CREATE TABLE "audit_logs" (
    "audit_log_id" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_role" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "before_value" JSONB,
    "after_value" JSONB,
    "reason" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "correlation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("audit_log_id")
);

CREATE TABLE "consent_records" (
    "consent_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "consent_type" "ConsentType" NOT NULL,
    "status" "ConsentStatus" NOT NULL,
    "policy_version" TEXT NOT NULL,
    "source" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "consented_at" TIMESTAMP(3),
    "withdrawn_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("consent_id")
);

CREATE TABLE "privacy_requests" (
    "privacy_request_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "request_type" "PrivacyRequestType" NOT NULL,
    "status" "PrivacyRequestStatus" NOT NULL DEFAULT 'submitted',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "assigned_admin_id" TEXT,
    "resolution_notes" TEXT,
    "export_file_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "privacy_requests_pkey" PRIMARY KEY ("privacy_request_id")
);

CREATE TABLE "ai_system_inventory" (
    "ai_system_id" TEXT NOT NULL,
    "feature_name" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "provider" TEXT,
    "model_name" TEXT,
    "input_data_categories" JSONB,
    "output_type" TEXT,
    "risk_classification" TEXT,
    "human_oversight" TEXT,
    "transparency_notice" TEXT,
    "version" TEXT,
    "status" "AiSystemStatus" NOT NULL DEFAULT 'planned',
    "last_reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_system_inventory_pkey" PRIMARY KEY ("ai_system_id")
);

CREATE TABLE "follows" (
    "follower_id" TEXT NOT NULL,
    "following_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("follower_id","following_id")
);

CREATE TABLE "daily_spin_claims" (
    "spin_claim_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reward_type" TEXT NOT NULL,
    "reward_value" INTEGER,
    "claimed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claim_date" TEXT NOT NULL,

    CONSTRAINT "daily_spin_claims_pkey" PRIMARY KEY ("spin_claim_id")
);

CREATE TABLE "activity_events" (
    "activity_event_id" TEXT NOT NULL,
    "user_id" TEXT,
    "platform" TEXT,
    "event_type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("activity_event_id")
);

CREATE TABLE "journey_routes" (
    "journey_route_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "start_place_id" TEXT NOT NULL,
    "start_label" TEXT NOT NULL,
    "start_lat" DECIMAL(10,7),
    "start_lng" DECIMAL(10,7),
    "destination_place_id" TEXT NOT NULL,
    "destination_label" TEXT NOT NULL,
    "destination_lat" DECIMAL(10,7),
    "destination_lng" DECIMAL(10,7),
    "travel_mode" TEXT NOT NULL,
    "distance_meters" INTEGER,
    "estimated_duration_seconds" INTEGER,
    "route_summary" TEXT,
    "encoded_polyline" TEXT,
    "privacy_mode" TEXT NOT NULL DEFAULT 'approximate_delayed',
    "safety_delay_minutes" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journey_routes_pkey" PRIMARY KEY ("journey_route_id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

CREATE UNIQUE INDEX "users_predikt_handle_key" ON "users"("predikt_handle");

CREATE UNIQUE INDEX "users_guest_key_key" ON "users"("guest_key");

CREATE UNIQUE INDEX "prediction_rooms_invite_code_key" ON "prediction_rooms"("invite_code");

CREATE INDEX "room_commentaries_room_id_idx" ON "room_commentaries"("room_id");

CREATE INDEX "room_commentaries_room_id_is_current_idx" ON "room_commentaries"("room_id", "is_current");

CREATE INDEX "room_commentaries_moderation_status_idx" ON "room_commentaries"("moderation_status");

CREATE INDEX "user_badges_user_id_awarded_at_idx" ON "user_badges"("user_id", "awarded_at");

CREATE INDEX "user_badges_badge_key_idx" ON "user_badges"("badge_key");

CREATE INDEX "user_badges_room_id_idx" ON "user_badges"("room_id");

CREATE UNIQUE INDEX "user_badges_user_id_room_id_badge_key_key" ON "user_badges"("user_id", "room_id", "badge_key");

CREATE UNIQUE INDEX "room_milestones_room_id_milestone_order_key" ON "room_milestones"("room_id", "milestone_order");

CREATE UNIQUE INDEX "milestone_predictions_milestone_id_user_id_key" ON "milestone_predictions"("milestone_id", "user_id");

CREATE UNIQUE INDEX "room_results_room_id_user_id_key" ON "room_results"("room_id", "user_id");

CREATE UNIQUE INDEX "user_room_preferences_user_id_room_id_key" ON "user_room_preferences"("user_id", "room_id");

CREATE INDEX "room_memberships_user_id_idx" ON "room_memberships"("user_id");

CREATE INDEX "room_memberships_room_id_idx" ON "room_memberships"("room_id");

CREATE INDEX "room_memberships_status_idx" ON "room_memberships"("status");

CREATE UNIQUE INDEX "room_memberships_room_id_user_id_key" ON "room_memberships"("room_id", "user_id");

CREATE INDEX "user_notifications_user_id_status_idx" ON "user_notifications"("user_id", "status");

CREATE INDEX "user_notifications_user_id_created_at_idx" ON "user_notifications"("user_id", "created_at");

CREATE INDEX "user_notifications_room_id_idx" ON "user_notifications"("room_id");

CREATE UNIQUE INDEX "credit_ledger_idempotency_key_key" ON "credit_ledger"("idempotency_key");

CREATE UNIQUE INDEX "reward_accounts_user_id_key" ON "reward_accounts"("user_id");

CREATE UNIQUE INDEX "reward_ledger_entries_idempotency_key_key" ON "reward_ledger_entries"("idempotency_key");

CREATE INDEX "reward_ledger_entries_user_id_reward_type_created_at_idx" ON "reward_ledger_entries"("user_id", "reward_type", "created_at");

CREATE INDEX "reward_ledger_entries_reason_code_created_at_idx" ON "reward_ledger_entries"("reason_code", "created_at");

CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");

CREATE INDEX "reports_status_idx" ON "reports"("status");

CREATE INDEX "reports_report_type_idx" ON "reports"("report_type");

CREATE INDEX "reports_created_at_idx" ON "reports"("created_at");

CREATE UNIQUE INDEX "result_reactions_room_id_user_id_emoji_key" ON "result_reactions"("room_id", "user_id", "emoji");

CREATE UNIQUE INDEX "flexes_flex_name_key" ON "flexes"("flex_name");

CREATE UNIQUE INDEX "creator_profiles_user_id_key" ON "creator_profiles"("user_id");

CREATE UNIQUE INDEX "creator_profiles_handle_key" ON "creator_profiles"("handle");

CREATE UNIQUE INDEX "admin_roles_role_name_key" ON "admin_roles"("role_name");

CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

CREATE UNIQUE INDEX "daily_spin_claims_user_id_claim_date_key" ON "daily_spin_claims"("user_id", "claim_date");

CREATE INDEX "activity_events_event_type_idx" ON "activity_events"("event_type");

CREATE INDEX "activity_events_created_at_idx" ON "activity_events"("created_at");

CREATE INDEX "activity_events_user_id_idx" ON "activity_events"("user_id");

CREATE UNIQUE INDEX "journey_routes_room_id_key" ON "journey_routes"("room_id");

ALTER TABLE "prediction_rooms" ADD CONSTRAINT "prediction_rooms_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "prediction_rooms" ADD CONSTRAINT "prediction_rooms_rematch_of_room_id_fkey" FOREIGN KEY ("rematch_of_room_id") REFERENCES "prediction_rooms"("room_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "room_commentaries" ADD CONSTRAINT "room_commentaries_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "prediction_rooms"("room_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "room_commentaries" ADD CONSTRAINT "room_commentaries_generated_by_user_id_fkey" FOREIGN KEY ("generated_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "prediction_rooms"("room_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "room_milestones" ADD CONSTRAINT "room_milestones_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "prediction_rooms"("room_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "milestone_predictions" ADD CONSTRAINT "milestone_predictions_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "room_milestones"("milestone_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "milestone_predictions" ADD CONSTRAINT "milestone_predictions_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "prediction_rooms"("room_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "milestone_predictions" ADD CONSTRAINT "milestone_predictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "room_results" ADD CONSTRAINT "room_results_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "prediction_rooms"("room_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "room_results" ADD CONSTRAINT "room_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_room_preferences" ADD CONSTRAINT "user_room_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_room_preferences" ADD CONSTRAINT "user_room_preferences_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "prediction_rooms"("room_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "room_memberships" ADD CONSTRAINT "room_memberships_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "prediction_rooms"("room_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "room_memberships" ADD CONSTRAINT "room_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "prediction_rooms"("room_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "user_reliability_ledger" ADD CONSTRAINT "user_reliability_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_reliability_ledger" ADD CONSTRAINT "user_reliability_ledger_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "prediction_rooms"("room_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "live_location_events" ADD CONSTRAINT "live_location_events_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "prediction_rooms"("room_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "live_location_events" ADD CONSTRAINT "live_location_events_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "live_location_events" ADD CONSTRAINT "live_location_events_current_milestone_id_fkey" FOREIGN KEY ("current_milestone_id") REFERENCES "room_milestones"("milestone_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "aura_transactions" ADD CONSTRAINT "aura_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "aura_transactions" ADD CONSTRAINT "aura_transactions_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "prediction_rooms"("room_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "aura_transactions" ADD CONSTRAINT "aura_transactions_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "room_milestones"("milestone_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "clout_transactions" ADD CONSTRAINT "clout_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "clout_transactions" ADD CONSTRAINT "clout_transactions_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "prediction_rooms"("room_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "clout_transactions" ADD CONSTRAINT "clout_transactions_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "room_milestones"("milestone_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "prediction_rooms"("room_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reward_accounts" ADD CONSTRAINT "reward_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reward_ledger_entries" ADD CONSTRAINT "reward_ledger_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reports" ADD CONSTRAINT "reports_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reports" ADD CONSTRAINT "reports_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "prediction_rooms"("room_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "room_disputes" ADD CONSTRAINT "room_disputes_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "prediction_rooms"("room_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "room_disputes" ADD CONSTRAINT "room_disputes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "result_reactions" ADD CONSTRAINT "result_reactions_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "prediction_rooms"("room_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "result_reactions" ADD CONSTRAINT "result_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_drops" ADD CONSTRAINT "user_drops_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_drops" ADD CONSTRAINT "user_drops_drop_id_fkey" FOREIGN KEY ("drop_id") REFERENCES "drops"("drop_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_drops" ADD CONSTRAINT "user_drops_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "prediction_rooms"("room_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "room_drop_rules" ADD CONSTRAINT "room_drop_rules_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "prediction_rooms"("room_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "room_drop_rules" ADD CONSTRAINT "room_drop_rules_drop_id_fkey" FOREIGN KEY ("drop_id") REFERENCES "drops"("drop_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_flexes" ADD CONSTRAINT "user_flexes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_flexes" ADD CONSTRAINT "user_flexes_flex_id_fkey" FOREIGN KEY ("flex_id") REFERENCES "flexes"("flex_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_flexes" ADD CONSTRAINT "user_flexes_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "prediction_rooms"("room_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "user_flexes" ADD CONSTRAINT "user_flexes_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "room_milestones"("milestone_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "sponsors"("sponsor_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "campaign_metrics" ADD CONSTRAINT "campaign_metrics_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("campaign_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "campaign_metrics" ADD CONSTRAINT "campaign_metrics_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "prediction_rooms"("room_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "admin_roles"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_assigned_admin_id_fkey" FOREIGN KEY ("assigned_admin_id") REFERENCES "admin_users"("admin_user_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "daily_spin_claims" ADD CONSTRAINT "daily_spin_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "journey_routes" ADD CONSTRAINT "journey_routes_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "prediction_rooms"("room_id") ON DELETE RESTRICT ON UPDATE CASCADE;
