/**
 * Price Reports API Client
 * Connects to Neon database via Netlify Functions
 * Falls back to localStorage if API is unavailable
 */

const API_BASE = '/.netlify/functions/price-reports';
const LOCAL_STORAGE_KEY = 'med_nav_price_reports';

// Check if we're in development without the API
const isDev = import.meta.env.DEV;

/**
 * Fetch price stats for a specific medication and source
 */
export async function fetchPriceStats(medicationId, source) {
    try {
        const response = await fetch(
            `${API_BASE}?medicationId=${encodeURIComponent(medicationId)}&source=${encodeURIComponent(source)}`
        );

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data.stats;
    } catch (error) {
        console.warn('API unavailable, falling back to localStorage:', error.message);
        return getLocalStats(medicationId, source);
    }
}

/**
 * Submit a new price report
 */
export async function submitPriceReport(medicationId, source, price, location, date) {
    try {
        const response = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ medicationId, source, price, location, date })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `API error: ${response.status}`);
        }

        return { success: true };
    } catch (error) {
        console.warn('API unavailable, saving to localStorage:', error.message);
        return saveLocalReport(medicationId, source, price, location, date);
    }
}

/**
 * Fetch all price stats (bulk load for performance)
 */
export async function fetchAllPriceStats() {
    try {
        const response = await fetch(API_BASE);

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        // Convert to the format expected by the app
        const statsMap = {};
        for (const stat of data.stats) {
            const key = `${stat.medication_id}_${stat.source}`;
            statsMap[key] = {
                min: parseFloat(stat.min_price).toFixed(2),
                max: parseFloat(stat.max_price).toFixed(2),
                avg: parseFloat(stat.avg_price).toFixed(2),
                count: parseInt(stat.recent_reports),
                total: parseInt(stat.total_reports)
            };
        }
        return statsMap;
    } catch (error) {
        console.warn('API unavailable, using localStorage:', error.message);
        return getLocalReports();
    }
}

// ============ LocalStorage Fallback ============

function getLocalReports() {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch (e) {
        console.error('Error reading local price reports:', e);
        return {};
    }
}

function getLocalStats(medicationId, source) {
    const reports = getLocalReports();
    const key = `${medicationId}_${source}`;
    const priceData = reports[key] || [];

    if (priceData.length === 0) return null;

    const prices = priceData.map(r => r.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const recentReports = priceData.filter(r => new Date(r.timestamp) > ninetyDaysAgo);

    return {
        min: min.toFixed(2),
        max: max.toFixed(2),
        avg: avg.toFixed(2),
        count: recentReports.length,
        total: priceData.length
    };
}

function saveLocalReport(medicationId, source, price, location, date) {
    try {
        const reports = getLocalReports();
        const key = `${medicationId}_${source}`;

        if (!reports[key]) {
            reports[key] = [];
        }

        reports[key].push({
            price: parseFloat(price),
            location,
            date,
            timestamp: new Date().toISOString()
        });

        // Keep only last 50 reports per medication-source combo
        if (reports[key].length > 50) {
            reports[key] = reports[key].slice(-50);
        }

        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(reports));
        return { success: true };
    } catch (e) {
        console.error('Error saving local price report:', e);
        return { success: false, error: e.message };
    }
}
