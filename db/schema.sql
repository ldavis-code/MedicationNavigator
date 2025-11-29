-- Neon Database Schema for Medication Navigator
-- Run this in your Neon SQL Editor: https://console.neon.tech

-- ============================================
-- USER AND SUBSCRIPTION TABLES
-- ============================================

-- Users Table
-- Stores user account information
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    user_role TEXT DEFAULT 'patient', -- patient, carepartner, social_worker
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    email_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);

-- Index for email lookups (login)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Subscription Plans Table
-- Defines available subscription tiers
CREATE TABLE IF NOT EXISTS subscription_plans (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL, -- Price in cents (e.g., 999 = $9.99)
    billing_interval TEXT NOT NULL DEFAULT 'monthly', -- monthly, yearly, one_time
    features JSONB DEFAULT '[]'::jsonb, -- Array of feature strings
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Subscriptions Table
-- Links users to their subscription plans
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
    status TEXT NOT NULL DEFAULT 'active', -- active, cancelled, expired, past_due
    current_period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    stripe_subscription_id TEXT, -- For Stripe integration
    stripe_customer_id TEXT, -- For Stripe integration
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for subscription queries
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_sub ON user_subscriptions(stripe_subscription_id);

-- Billing History Table
-- Tracks payment transactions
CREATE TABLE IF NOT EXISTS billing_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id INTEGER REFERENCES user_subscriptions(id) ON DELETE SET NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'usd',
    status TEXT NOT NULL, -- succeeded, failed, pending, refunded
    stripe_payment_intent_id TEXT,
    stripe_invoice_id TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for billing history lookups
CREATE INDEX IF NOT EXISTS idx_billing_history_user_id ON billing_history(user_id);

-- ============================================
-- SEED DATA: Subscription Plans
-- ============================================

-- Insert default subscription plans
INSERT INTO subscription_plans (name, slug, description, price_cents, billing_interval, features, display_order)
VALUES
    ('Free', 'free', 'Basic access to medication pricing information', 0, 'monthly',
     '["View medication prices", "Access 5 pricing sources", "Community price reports"]'::jsonb, 1),
    ('General Population', 'general', 'Full access for the general population', 999, 'monthly',
     '["All Free features", "Personalized medication tracking", "Price alerts and notifications", "Advanced price comparison", "Export medication lists", "Priority support"]'::jsonb, 2),
    ('General Population Annual', 'general-annual', 'Full access - annual billing (save 17%)', 9900, 'yearly',
     '["All General Population features", "2 months free with annual billing", "Early access to new features"]'::jsonb, 3)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- PRICE REPORTS TABLE (Community Submissions)
-- ============================================

-- Price Reports Table
-- Stores community-submitted medication prices
CREATE TABLE IF NOT EXISTS price_reports (
    id SERIAL PRIMARY KEY,
    medication_id TEXT NOT NULL,
    source TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    location TEXT,
    report_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Optional: for future rate limiting / spam prevention
    ip_hash TEXT
);

-- Index for fast lookups by medication and source
CREATE INDEX IF NOT EXISTS idx_price_reports_med_source
ON price_reports(medication_id, source);

-- Index for filtering by date (for 90-day window)
CREATE INDEX IF NOT EXISTS idx_price_reports_created_at
ON price_reports(created_at);

-- Optional: Add a view for aggregated stats
CREATE OR REPLACE VIEW price_report_stats AS
SELECT
    medication_id,
    source,
    MIN(price) as min_price,
    MAX(price) as max_price,
    ROUND(AVG(price)::numeric, 2) as avg_price,
    COUNT(*) as total_reports,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '90 days') as recent_reports
FROM price_reports
GROUP BY medication_id, source;

-- ============================================
-- SUBSCRIPTION VIEWS
-- ============================================

-- Active Subscriptions View
-- Shows users with their active subscription details
CREATE OR REPLACE VIEW active_subscriptions AS
SELECT
    u.id as user_id,
    u.email,
    u.first_name,
    u.last_name,
    sp.name as plan_name,
    sp.slug as plan_slug,
    sp.price_cents,
    sp.billing_interval,
    us.status,
    us.current_period_start,
    us.current_period_end,
    us.cancel_at_period_end
FROM users u
JOIN user_subscriptions us ON u.id = us.user_id
JOIN subscription_plans sp ON us.plan_id = sp.id
WHERE us.status = 'active'
  AND u.is_active = TRUE;

-- User Plan Status View
-- Quick lookup for checking user's current plan
CREATE OR REPLACE VIEW user_plan_status AS
SELECT
    u.id as user_id,
    u.email,
    COALESCE(sp.slug, 'free') as current_plan,
    COALESCE(sp.name, 'Free') as plan_name,
    COALESCE(sp.price_cents, 0) as price_cents,
    CASE
        WHEN us.status = 'active' AND us.current_period_end > NOW() THEN TRUE
        WHEN sp.slug = 'free' THEN TRUE
        ELSE FALSE
    END as is_plan_active,
    us.current_period_end as expires_at
FROM users u
LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id;
