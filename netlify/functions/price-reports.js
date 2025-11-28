import { neon } from '@neondatabase/serverless';

// Initialize Neon client
const sql = neon(process.env.DATABASE_URL);

// CORS headers for browser requests
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
};

export async function handler(event) {
    // Handle preflight CORS requests
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers };
    }

    try {
        // GET: Fetch price reports for a medication/source
        if (event.httpMethod === 'GET') {
            const { medicationId, source } = event.queryStringParameters || {};

            // If specific medication/source requested
            if (medicationId && source) {
                const reports = await sql`
                    SELECT price, location, report_date, created_at
                    FROM price_reports
                    WHERE medication_id = ${medicationId}
                    AND source = ${source}
                    ORDER BY created_at DESC
                    LIMIT 50
                `;

                // Calculate stats
                if (reports.length === 0) {
                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({ stats: null, reports: [] })
                    };
                }

                const prices = reports.map(r => parseFloat(r.price));
                const ninetyDaysAgo = new Date();
                ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
                const recentReports = reports.filter(r => new Date(r.created_at) > ninetyDaysAgo);

                const stats = {
                    min: Math.min(...prices).toFixed(2),
                    max: Math.max(...prices).toFixed(2),
                    avg: (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2),
                    count: recentReports.length,
                    total: reports.length
                };

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ stats, reports })
                };
            }

            // Fetch all stats (for bulk loading)
            const stats = await sql`
                SELECT
                    medication_id,
                    source,
                    MIN(price) as min_price,
                    MAX(price) as max_price,
                    ROUND(AVG(price)::numeric, 2) as avg_price,
                    COUNT(*) as total_reports,
                    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '90 days') as recent_reports
                FROM price_reports
                GROUP BY medication_id, source
            `;

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ stats })
            };
        }

        // POST: Submit a new price report
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body || '{}');
            const { medicationId, source, price, location, date } = body;

            // Validate required fields
            if (!medicationId || !source || !price) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Missing required fields: medicationId, source, price' })
                };
            }

            // Validate price is a positive number
            const priceNum = parseFloat(price);
            if (isNaN(priceNum) || priceNum <= 0 || priceNum > 100000) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid price value' })
                };
            }

            // Optional: hash IP for rate limiting (privacy-preserving)
            const ipHash = event.headers['x-forwarded-for']
                ? Buffer.from(event.headers['x-forwarded-for'].split(',')[0]).toString('base64').slice(0, 16)
                : null;

            // Insert the report
            await sql`
                INSERT INTO price_reports (medication_id, source, price, location, report_date, ip_hash)
                VALUES (${medicationId}, ${source}, ${priceNum}, ${location || null}, ${date || null}, ${ipHash})
            `;

            return {
                statusCode: 201,
                headers,
                body: JSON.stringify({ success: true, message: 'Price report submitted' })
            };
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };

    } catch (error) {
        console.error('Price reports error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
}
