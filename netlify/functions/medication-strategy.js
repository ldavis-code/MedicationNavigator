import { neon } from '@neondatabase/serverless';

// Initialize Neon client
const sql = neon(process.env.DATABASE_URL);

// CORS headers for browser requests
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
};

export async function handler(event) {
    // Handle preflight CORS requests
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { medicationId } = event.queryStringParameters || {};

        // Fetch single medication strategy with all details
        if (medicationId) {
            // Get medication strategy
            const strategies = await sql`
                SELECT
                    medication_id,
                    generic_name,
                    brand_name,
                    category,
                    condition,
                    retail_price_low,
                    retail_price_high,
                    retail_price_note,
                    common_mistakes
                FROM medication_strategies
                WHERE medication_id = ${medicationId}
                AND is_active = TRUE
            `;

            if (strategies.length === 0) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ strategy: null, pharmacies: {} })
                };
            }

            const strategy = strategies[0];

            // Get savings options
            const savingsOptions = await sql`
                SELECT
                    id,
                    option_type,
                    name,
                    description,
                    estimated_cost_cents,
                    estimated_cost_note,
                    eligibility_criteria,
                    steps,
                    documents_needed,
                    url,
                    phone,
                    insurance_types
                FROM savings_options
                WHERE medication_id = ${medicationId}
                AND is_active = TRUE
                ORDER BY priority DESC
            `;

            // Get pharmacy availability
            const pharmacies = await sql`
                SELECT
                    pharmacy,
                    is_available,
                    price_cents,
                    price_note,
                    url
                FROM pharmacy_availability
                WHERE medication_id = ${medicationId}
            `;

            // Convert pharmacies array to object
            const pharmacyMap = {};
            for (const p of pharmacies) {
                pharmacyMap[p.pharmacy] = {
                    available: p.is_available,
                    priceCents: p.price_cents,
                    priceNote: p.price_note,
                    url: p.url
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    strategy: {
                        ...strategy,
                        savingsOptions
                    },
                    pharmacies: pharmacyMap
                })
            };
        }

        // Fetch all medication strategies (summary only)
        const allStrategies = await sql`
            SELECT
                medication_id,
                generic_name,
                brand_name,
                category,
                condition,
                retail_price_low,
                retail_price_high
            FROM medication_strategies
            WHERE is_active = TRUE
            ORDER BY brand_name
        `;

        // Fetch all pharmacy availability
        const allPharmacies = await sql`
            SELECT
                medication_id,
                pharmacy,
                is_available
            FROM pharmacy_availability
        `;

        // Group pharmacies by medication
        const pharmacyByMed = {};
        for (const p of allPharmacies) {
            if (!pharmacyByMed[p.medication_id]) {
                pharmacyByMed[p.medication_id] = {};
            }
            pharmacyByMed[p.medication_id][p.pharmacy] = p.is_available;
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                strategies: allStrategies,
                pharmacyAvailability: pharmacyByMed
            })
        };

    } catch (error) {
        console.error('Medication strategy error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
}
