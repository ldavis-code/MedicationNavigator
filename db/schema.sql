-- Neon Database Schema for Medication Navigator
-- Run this in your Neon SQL Editor: https://console.neon.tech

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
