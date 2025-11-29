/**
 * Medication Strategy API Client
 * Fetches medication-specific savings strategies, pharmacy availability, and pricing from database
 */

const API_BASE = '/.netlify/functions/medication-strategy';

// Cache for strategies to avoid repeated API calls
const strategyCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch strategy for a specific medication
 * Returns savings options, pharmacy availability, common mistakes, etc.
 */
export async function fetchMedicationStrategy(medicationId) {
    // Check cache first
    const cached = strategyCache.get(medicationId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }

    try {
        const response = await fetch(
            `${API_BASE}?medicationId=${encodeURIComponent(medicationId)}`
        );

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        // Cache the result
        strategyCache.set(medicationId, {
            data,
            timestamp: Date.now()
        });

        return data;
    } catch (error) {
        console.warn('Could not fetch medication strategy:', error.message);
        return { strategy: null, pharmacies: {} };
    }
}

/**
 * Fetch all medication strategies (summary)
 * Used for bulk loading pharmacy availability
 */
export async function fetchAllMedicationStrategies() {
    try {
        const response = await fetch(API_BASE);

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.warn('Could not fetch medication strategies:', error.message);
        return { strategies: [], pharmacyAvailability: {} };
    }
}

/**
 * Check if a pharmacy carries a specific medication
 * Returns { available, priceNote, url } or null if unknown
 */
export async function checkPharmacyAvailability(medicationId, pharmacy) {
    const { pharmacies } = await fetchMedicationStrategy(medicationId);
    return pharmacies[pharmacy] || null;
}

/**
 * Get savings options filtered by insurance type
 * insuranceType: 'commercial', 'medicare', 'medicaid', 'uninsured'
 */
export function filterSavingsOptionsByInsurance(savingsOptions, insuranceType) {
    if (!savingsOptions || !insuranceType) return savingsOptions;

    return savingsOptions.filter(option => {
        const types = option.insurance_types || [];
        return types.length === 0 || types.includes(insuranceType);
    });
}

/**
 * Format price from cents to display string
 */
export function formatPrice(cents) {
    if (cents === null || cents === undefined) return null;
    if (cents === 0) return 'FREE';
    return `$${(cents / 100).toFixed(0)}`;
}

/**
 * Format price range from cents
 */
export function formatPriceRange(lowCents, highCents) {
    if (!lowCents && !highCents) return null;
    const low = formatPrice(lowCents);
    const high = formatPrice(highCents);
    if (low === high) return low;
    return `${low}-${high}`;
}

/**
 * Clear strategy cache (call after data updates)
 */
export function clearStrategyCache() {
    strategyCache.clear();
}
