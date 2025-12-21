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

-- ============================================
-- MEDICATION STRATEGY TABLES
-- ============================================

-- Medication Strategies Table
-- Core medication data with retail pricing and category info
-- Note: generic_name stores the pharmaceutical/drug name (e.g., "Apixaban")
-- brand_name stores the commercial name (e.g., "Eliquis")
-- These may be the same medication - lookup should match either name
CREATE TABLE IF NOT EXISTS medication_strategies (
    id SERIAL PRIMARY KEY,
    medication_id TEXT UNIQUE NOT NULL, -- matches medications.json id (e.g., "apixaban")
    generic_name TEXT NOT NULL, -- pharmaceutical/drug name (e.g., "Apixaban") - NOTE: may not have a true generic available
    brand_name TEXT NOT NULL, -- commercial/trade name (e.g., "Eliquis")
    category TEXT NOT NULL, -- e.g., "Diabetes", "Immunosuppressant"
    condition TEXT, -- e.g., "Type 2 Diabetes", "Transplant"
    retail_price_low INTEGER, -- in cents (e.g., 90000 = $900)
    retail_price_high INTEGER, -- in cents
    retail_price_note TEXT, -- e.g., "without insurance"
    common_mistakes JSONB DEFAULT '[]'::jsonb, -- Array of warning strings
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medication_strategies_med_id ON medication_strategies(medication_id);
CREATE INDEX IF NOT EXISTS idx_medication_strategies_category ON medication_strategies(category);
CREATE INDEX IF NOT EXISTS idx_medication_strategies_condition ON medication_strategies(condition);
-- Indexes for name-based lookups (supports searching by pharmaceutical or commercial name)
CREATE INDEX IF NOT EXISTS idx_medication_strategies_generic_name ON medication_strategies(LOWER(generic_name));
CREATE INDEX IF NOT EXISTS idx_medication_strategies_brand_name ON medication_strategies(LOWER(brand_name));

-- Savings Options Table
-- Copay cards, PAPs, foundations, discount programs
CREATE TABLE IF NOT EXISTS savings_options (
    id SERIAL PRIMARY KEY,
    medication_id TEXT NOT NULL, -- references medication_strategies.medication_id
    option_type TEXT NOT NULL, -- 'copay_card', 'pap', 'foundation', 'discount_program'
    name TEXT NOT NULL, -- e.g., "Novo Nordisk Copay Card"
    description TEXT,
    estimated_cost_cents INTEGER, -- what patient pays (e.g., 2500 = $25/month)
    estimated_cost_note TEXT, -- e.g., "if commercially insured"
    eligibility_criteria JSONB DEFAULT '[]'::jsonb, -- Array of requirements
    steps JSONB DEFAULT '[]'::jsonb, -- Array of step objects {step_number, action, details, url, phone}
    documents_needed JSONB DEFAULT '[]'::jsonb, -- Array of document strings
    url TEXT,
    phone TEXT,
    priority INTEGER DEFAULT 0, -- display order (higher = show first)
    insurance_types JSONB DEFAULT '[]'::jsonb, -- Valid values: 'commercial', 'medicaid', 'uninsured'. NOTE: copay_card type MUST NEVER include 'medicare' or 'medicare_advantage' - federal anti-kickback law prohibits manufacturer copay assistance for Medicare patients
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_savings_options_med_id ON savings_options(medication_id);
CREATE INDEX IF NOT EXISTS idx_savings_options_type ON savings_options(option_type);

-- Pharmacy Availability Table
-- Which pharmacies/sources carry which medications
CREATE TABLE IF NOT EXISTS pharmacy_availability (
    id SERIAL PRIMARY KEY,
    medication_id TEXT NOT NULL, -- references medication_strategies.medication_id
    pharmacy TEXT NOT NULL, -- 'costplus', 'walmart', 'blinkhealth', 'goodrx', 'amazon', 'singlecare'
    is_available BOOLEAN DEFAULT TRUE,
    price_cents INTEGER, -- if known fixed price
    price_note TEXT, -- e.g., "generic only", "30-day supply"
    url TEXT, -- direct link to medication on pharmacy site
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(medication_id, pharmacy)
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_availability_med_id ON pharmacy_availability(medication_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_availability_pharmacy ON pharmacy_availability(pharmacy);

-- ============================================
-- SEED DATA: Example Medication Strategy (Ozempic)
-- ============================================

-- Insert Ozempic strategy
INSERT INTO medication_strategies (medication_id, generic_name, brand_name, category, condition, retail_price_low, retail_price_high, retail_price_note, common_mistakes)
VALUES (
    'ozempic',
    'Semaglutide',
    'Ozempic',
    'Diabetes',
    'Type 2 Diabetes',
    90000, -- $900
    110000, -- $1100
    'without insurance, per month',
    '[
        "Copay cards are NEVER available for Medicare or Medicare Advantage patients—this is federal law (Anti-Kickback Statute). Medicare patients should look into copay assistance foundations instead.",
        "Copay cards also cannot be used with Medicaid or other government insurance programs.",
        "Patient assistance approval can take 2-4 weeks—apply before you run out of medication.",
        "Some pharmacies charge different prices—always compare before filling."
    ]'::jsonb
)
ON CONFLICT (medication_id) DO NOTHING;

-- Insert Ozempic savings options
INSERT INTO savings_options (medication_id, option_type, name, description, estimated_cost_cents, estimated_cost_note, eligibility_criteria, steps, documents_needed, url, phone, priority, insurance_types)
VALUES
(
    'ozempic',
    'copay_card',
    'Novo Nordisk Savings Card',
    'Manufacturer copay assistance for commercially insured patients',
    2500, -- $25/month
    'if commercially insured, up to 24 months',
    '["Must have commercial insurance", "Cannot use with Medicare, Medicaid, or government insurance", "US residents only"]'::jsonb,
    '[
        {"step_number": 1, "action": "Visit the Novo Nordisk savings website", "details": "Go to novocare.com/ozempic/savings-card", "url": "https://www.novocare.com/ozempic/savings-card.html"},
        {"step_number": 2, "action": "Check eligibility", "details": "Answer a few questions about your insurance"},
        {"step_number": 3, "action": "Activate your card", "details": "Get instant access to your digital savings card"},
        {"step_number": 4, "action": "Present at pharmacy", "details": "Show the card along with your insurance when filling prescription"}
    ]'::jsonb,
    '["Insurance card", "Prescription from doctor"]'::jsonb,
    'https://www.novocare.com/ozempic/savings-card.html',
    '1-888-809-3942',
    100,
    '["commercial"]'::jsonb
),
(
    'ozempic',
    'pap',
    'Novo Nordisk Patient Assistance Program (PAP)',
    'Free medication for uninsured or underinsured patients who qualify',
    0, -- Free
    'if approved based on income',
    '["No insurance or inadequate coverage", "Income at or below 400% Federal Poverty Level", "US residents only", "Not enrolled in Medicare Part D or Medicaid"]'::jsonb,
    '[
        {"step_number": 1, "action": "Call NovoCare", "details": "Speak with a representative to start your application", "phone": "1-888-809-3942"},
        {"step_number": 2, "action": "Complete application", "details": "Fill out the PAP application form with your doctor"},
        {"step_number": 3, "action": "Submit proof of income", "details": "Provide tax return, pay stubs, or signed income statement"},
        {"step_number": 4, "action": "Wait for approval", "details": "Typically 2-4 weeks for processing"},
        {"step_number": 5, "action": "Receive medication", "details": "Medication shipped to your doctor''s office or home"}
    ]'::jsonb,
    '["Completed PAP application form", "Proof of income (tax return, pay stubs, or signed statement)", "Prescription from doctor", "Proof of no insurance or denial letter"]'::jsonb,
    'https://www.novocare.com/ozempic/patient-assistance-program.html',
    '1-888-809-3942',
    90,
    '["uninsured"]'::jsonb
)
ON CONFLICT DO NOTHING;

-- Insert pharmacy availability for Ozempic
INSERT INTO pharmacy_availability (medication_id, pharmacy, is_available, price_note, url)
VALUES
    ('ozempic', 'costplus', FALSE, 'Brand-name GLP-1 not available', NULL),
    ('ozempic', 'walmart', TRUE, 'Check pharmacy for pricing', 'https://www.walmart.com/cp/pharmacy'),
    ('ozempic', 'goodrx', TRUE, 'Coupons available, prices vary', 'https://www.goodrx.com/ozempic'),
    ('ozempic', 'blinkhealth', TRUE, 'Check for current pricing', 'https://www.blinkhealth.com/ozempic'),
    ('ozempic', 'singlecare', TRUE, 'Discount card available', 'https://www.singlecare.com/prescription/ozempic')
ON CONFLICT (medication_id, pharmacy) DO NOTHING;

-- ============================================
-- SEED DATA: Eliquis (Apixaban) Strategy
-- ============================================

-- Insert Eliquis strategy
INSERT INTO medication_strategies (medication_id, generic_name, brand_name, category, condition, retail_price_low, retail_price_high, retail_price_note, common_mistakes)
VALUES (
    'apixaban',
    'Apixaban',
    'Eliquis',
    'Anticoagulant',
    'Blood Clot Prevention',
    50000, -- $500
    60000, -- $600
    'without insurance, per month',
    '[
        "Copay cards are NEVER available for Medicare or Medicare Advantage patients—this is federal law (Anti-Kickback Statute). Medicare patients should look into Patient Assistance Foundations instead.",
        "Copay cards also cannot be used with Medicaid or other government insurance programs.",
        "Do not stop taking Eliquis without talking to your doctor—stopping suddenly increases stroke risk.",
        "Patient assistance approval can take 2-4 weeks—apply before you run out of medication.",
        "Generic apixaban is NOT yet available in the US. Be cautious of online pharmacies claiming to sell generic versions."
    ]'::jsonb
)
ON CONFLICT (medication_id) DO NOTHING;

-- Insert Eliquis savings options
INSERT INTO savings_options (medication_id, option_type, name, description, estimated_cost_cents, estimated_cost_note, eligibility_criteria, steps, documents_needed, url, phone, priority, insurance_types)
VALUES
(
    'apixaban',
    'copay_card',
    'Eliquis Free Trial and Savings Card',
    'Manufacturer copay assistance for commercially insured patients',
    1000, -- $10/month
    'if commercially insured, pay as little as $10/month',
    '["Must have commercial insurance", "Cannot use with Medicare, Medicaid, or government insurance", "US residents only", "Maximum annual benefit may apply"]'::jsonb,
    '[
        {"step_number": 1, "action": "Visit the BMS Access Support website", "details": "Go to eliquis.com/savings or call BMS Access Support", "url": "https://www.eliquis.com/savings"},
        {"step_number": 2, "action": "Check eligibility", "details": "Answer questions about your insurance coverage"},
        {"step_number": 3, "action": "Activate your card", "details": "Get instant access to your digital savings card or request physical card"},
        {"step_number": 4, "action": "Present at pharmacy", "details": "Show the card along with your insurance when filling prescription"}
    ]'::jsonb,
    '["Insurance card", "Prescription from doctor"]'::jsonb,
    'https://www.eliquis.com/savings',
    '1-844-468-1842',
    100,
    '["commercial"]'::jsonb
),
(
    'apixaban',
    'pap',
    'Bristol Myers Squibb Patient Assistance Foundation',
    'Free medication for uninsured or underinsured patients who qualify based on income',
    0, -- Free
    'if approved based on income',
    '["No insurance or inadequate prescription coverage", "Income at or below 400% Federal Poverty Level", "US residents only", "Not eligible for or enrolled in government insurance programs that cover medications"]'::jsonb,
    '[
        {"step_number": 1, "action": "Call BMS Access Support", "details": "Speak with a representative to start your application", "phone": "1-844-468-1842"},
        {"step_number": 2, "action": "Complete application", "details": "Fill out the Patient Assistance Foundation application form with your doctor"},
        {"step_number": 3, "action": "Submit proof of income", "details": "Provide tax return, pay stubs, Social Security statement, or signed income statement"},
        {"step_number": 4, "action": "Wait for approval", "details": "Typically 2-4 weeks for processing"},
        {"step_number": 5, "action": "Receive medication", "details": "Medication shipped to your doctor''s office or directly to your home"}
    ]'::jsonb,
    '["Completed Patient Assistance Foundation application form", "Proof of income (tax return, pay stubs, or signed statement)", "Prescription from doctor", "Proof of no insurance or coverage denial letter"]'::jsonb,
    'https://www.bmsaccesssupport.bmscustomerconnect.com/',
    '1-844-468-1842',
    90,
    '["uninsured"]'::jsonb
)
ON CONFLICT DO NOTHING;

-- Insert pharmacy availability for Eliquis
INSERT INTO pharmacy_availability (medication_id, pharmacy, is_available, price_note, url)
VALUES
    ('apixaban', 'costplus', FALSE, 'Brand-name anticoagulant not available', NULL),
    ('apixaban', 'walmart', TRUE, 'Check pharmacy for pricing', 'https://www.walmart.com/cp/pharmacy'),
    ('apixaban', 'goodrx', TRUE, 'Coupons available, prices vary by pharmacy', 'https://www.goodrx.com/eliquis'),
    ('apixaban', 'blinkhealth', TRUE, 'Check for current pricing', 'https://www.blinkhealth.com'),
    ('apixaban', 'singlecare', TRUE, 'Discount card available', 'https://www.singlecare.com/prescription/eliquis')
ON CONFLICT (medication_id, pharmacy) DO NOTHING;

-- ============================================
-- MEDICATION STRATEGY VIEW
-- ============================================

-- Full medication strategy view with savings options
CREATE OR REPLACE VIEW medication_strategy_full AS
SELECT
    ms.medication_id,
    ms.generic_name,
    ms.brand_name,
    ms.category,
    ms.condition,
    ms.retail_price_low,
    ms.retail_price_high,
    ms.retail_price_note,
    ms.common_mistakes,
    COALESCE(
        json_agg(
            json_build_object(
                'id', so.id,
                'type', so.option_type,
                'name', so.name,
                'description', so.description,
                'cost_cents', so.estimated_cost_cents,
                'cost_note', so.estimated_cost_note,
                'eligibility', so.eligibility_criteria,
                'steps', so.steps,
                'documents', so.documents_needed,
                'url', so.url,
                'phone', so.phone,
                'insurance_types', so.insurance_types
            ) ORDER BY so.priority DESC
        ) FILTER (WHERE so.id IS NOT NULL),
        '[]'
    ) as savings_options
FROM medication_strategies ms
LEFT JOIN savings_options so ON ms.medication_id = so.medication_id AND so.is_active = TRUE
WHERE ms.is_active = TRUE
GROUP BY ms.id;

-- Pharmacy availability view
CREATE OR REPLACE VIEW medication_pharmacy_status AS
SELECT
    pa.medication_id,
    json_object_agg(
        pa.pharmacy,
        json_build_object(
            'available', pa.is_available,
            'price_cents', pa.price_cents,
            'price_note', pa.price_note,
            'url', pa.url
        )
    ) as pharmacies
FROM pharmacy_availability pa
GROUP BY pa.medication_id;

-- =====================================================
-- SYSTEM EXPERIENCE SURVEY TABLES
-- No PHI collected - all anonymous/aggregated
-- =====================================================

-- Main survey responses table
-- Collects anonymous feedback about medication access barriers
CREATE TABLE IF NOT EXISTS survey_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255), -- anonymous session tracking
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    survey_version VARCHAR(20) DEFAULT '1.0',

    -- Cost Barriers
    skipped_due_to_cost VARCHAR(10), -- 'Yes', 'No'
    rationed_doses VARCHAR(10),
    monthly_oop_range VARCHAR(50),
    cost_spike_month VARCHAR(100),

    -- Access & Delays
    days_to_fill VARCHAR(50),
    pharmacy_calls VARCHAR(50),
    out_of_stock_frequency VARCHAR(50),
    specialty_delays VARCHAR(10), -- 'Yes', 'No', 'N/A'

    -- Navigation Burden
    pap_hours_spent VARCHAR(50),
    pap_applied_vs_approved VARCHAR(50),
    pap_denial_reason VARCHAR(100),
    how_found_assistance VARCHAR(100),

    -- Communication Gaps
    told_cost_before_discharge VARCHAR(10),
    team_discussed_assistance VARCHAR(10),
    surprised_by_cost VARCHAR(10),
    knew_about_copay_cards VARCHAR(10),

    -- Insurance Friction
    step_therapy_required VARCHAR(10),
    formulary_change_midyear VARCHAR(10),
    prior_auth_denials VARCHAR(50),
    appealed_denial VARCHAR(100),

    -- Demographics (all optional, no PII)
    condition_category VARCHAR(100),
    years_managing VARCHAR(50),
    insurance_type VARCHAR(100),
    region VARCHAR(50)
);

-- Indexes for fast aggregation queries
CREATE INDEX IF NOT EXISTS idx_survey_created ON survey_responses(created_at);
CREATE INDEX IF NOT EXISTS idx_survey_condition ON survey_responses(condition_category);
CREATE INDEX IF NOT EXISTS idx_survey_region ON survey_responses(region);

-- =====================================================
-- CONTEXTUAL MICRO-SURVEYS (per medication)
-- =====================================================

-- Medication Experience Table
-- Quick capture when adding a medication to track real-world issues
CREATE TABLE IF NOT EXISTS medication_experience (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255),
    medication_name VARCHAR(255), -- generic name only
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Quick capture when adding a medication
    experienced_delay VARCHAR(10),
    delay_days VARCHAR(50),
    cost_surprise VARCHAR(10),
    prior_auth_needed VARCHAR(10),
    prior_auth_outcome VARCHAR(50),
    used_assistance_program VARCHAR(10),
    assistance_type VARCHAR(100) -- 'manufacturer', 'foundation', 'state', etc.
);

CREATE INDEX IF NOT EXISTS idx_med_exp_medication ON medication_experience(medication_name);
CREATE INDEX IF NOT EXISTS idx_med_exp_session ON medication_experience(session_id);

-- =====================================================
-- AGGREGATED STATS VIEWS (for dashboards/reports)
-- =====================================================

-- Failure Point Summary View
-- Aggregates survey responses to show common failure points
CREATE OR REPLACE VIEW failure_point_summary AS
SELECT
    COUNT(*) as total_responses,

    -- Cost barriers
    ROUND(100.0 * COUNT(*) FILTER (WHERE skipped_due_to_cost = 'Yes') / NULLIF(COUNT(*), 0), 1) as pct_skipped_due_to_cost,
    ROUND(100.0 * COUNT(*) FILTER (WHERE rationed_doses = 'Yes') / NULLIF(COUNT(*), 0), 1) as pct_rationed_doses,
    ROUND(100.0 * COUNT(*) FILTER (WHERE surprised_by_cost = 'Yes') / NULLIF(COUNT(*), 0), 1) as pct_surprised_by_cost,

    -- Communication failures
    ROUND(100.0 * COUNT(*) FILTER (WHERE told_cost_before_discharge = 'No') / NULLIF(COUNT(*), 0), 1) as pct_not_told_costs,
    ROUND(100.0 * COUNT(*) FILTER (WHERE team_discussed_assistance = 'No') / NULLIF(COUNT(*), 0), 1) as pct_no_assistance_discussion,

    -- Insurance friction
    ROUND(100.0 * COUNT(*) FILTER (WHERE step_therapy_required = 'Yes') / NULLIF(COUNT(*), 0), 1) as pct_step_therapy,
    ROUND(100.0 * COUNT(*) FILTER (WHERE formulary_change_midyear = 'Yes') / NULLIF(COUNT(*), 0), 1) as pct_formulary_changes

FROM survey_responses;

-- Regional Summary View
-- Breakdown of survey responses by region
CREATE OR REPLACE VIEW regional_summary AS
SELECT
    region,
    COUNT(*) as responses,
    ROUND(100.0 * COUNT(*) FILTER (WHERE skipped_due_to_cost = 'Yes') / NULLIF(COUNT(*), 0), 1) as pct_skipped,
    ROUND(100.0 * COUNT(*) FILTER (WHERE surprised_by_cost = 'Yes') / NULLIF(COUNT(*), 0), 1) as pct_surprised
FROM survey_responses
WHERE region IS NOT NULL
GROUP BY region;

-- Insurance Type Summary View
-- Breakdown of survey responses by insurance type
CREATE OR REPLACE VIEW insurance_summary AS
SELECT
    insurance_type,
    COUNT(*) as responses,
    ROUND(100.0 * COUNT(*) FILTER (WHERE prior_auth_denials IN ('3-5', '6+')) / NULLIF(COUNT(*), 0), 1) as pct_multiple_denials,
    ROUND(100.0 * COUNT(*) FILTER (WHERE step_therapy_required = 'Yes') / NULLIF(COUNT(*), 0), 1) as pct_step_therapy
FROM survey_responses
WHERE insurance_type IS NOT NULL
GROUP BY insurance_type
