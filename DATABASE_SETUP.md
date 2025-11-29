# Neon Database Setup

This project uses [Neon](https://neon.tech) as a serverless PostgreSQL database for storing community-submitted price reports.

## Quick Setup (5 minutes)

### 1. Create a Neon Account & Database

1. Go to [console.neon.tech](https://console.neon.tech)
2. Sign up (free tier available)
3. Create a new project (e.g., "medication-navigator")
4. Copy your connection string (looks like `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`)

### 2. Run the Database Schema

In the Neon dashboard:
1. Go to **SQL Editor**
2. Copy and paste the contents of `db/schema.sql`
3. Click **Run**

This creates the `price_reports` table and necessary indexes.

### 3. Configure Environment Variables

#### For Local Development

Create a `.env` file in the project root:

```
DATABASE_URL=postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

#### For Netlify Deployment

1. Go to your Netlify site dashboard
2. Navigate to **Site settings** → **Environment variables**
3. Add: `DATABASE_URL` = your Neon connection string

### 4. Install Dependencies & Deploy

```bash
npm install
npm run build
```

For local development with Netlify Functions:
```bash
npx netlify dev
```

## How It Works

```
┌─────────────┐     ┌─────────────────────┐     ┌──────────────┐
│   React     │────▶│  Netlify Function   │────▶│    Neon      │
│   Frontend  │     │  (price-reports.js) │     │  PostgreSQL  │
└─────────────┘     └─────────────────────┘     └──────────────┘
       │                                               │
       └───────── localStorage fallback ◀──────────────┘
```

- **Submit price**: Frontend → API → Neon database
- **Read prices**: API → Neon → cached to localStorage for fast renders
- **Fallback**: If API unavailable, uses localStorage (data stays local only)

## API Endpoints

The serverless function is at `/.netlify/functions/price-reports`:

### GET - Fetch price stats
```
GET /.netlify/functions/price-reports?medicationId=tacrolimus&source=costplus
```

### POST - Submit a price report
```json
POST /.netlify/functions/price-reports
{
  "medicationId": "tacrolimus",
  "source": "costplus",
  "price": 25.50,
  "location": "California",
  "date": "2025-01-15"
}
```

## Database Schema

```sql
price_reports
├── id (SERIAL PRIMARY KEY)
├── medication_id (TEXT) - e.g., "tacrolimus"
├── source (TEXT) - e.g., "costplus", "walmart"
├── price (DECIMAL) - reported price
├── location (TEXT) - optional state/region
├── report_date (DATE) - optional
├── created_at (TIMESTAMP)
└── ip_hash (TEXT) - for rate limiting
```

## Costs

- **Neon Free Tier**: 0.5 GB storage, 100 compute hours/month
- This is plenty for thousands of price reports
- No credit card required

## Troubleshooting

### "Error: No database connection"
- Check `DATABASE_URL` is set in Netlify environment variables
- Ensure the connection string includes `?sslmode=require`

### API returns 500 error
- Check Netlify function logs: Site → Functions → price-reports
- Verify schema was run in Neon SQL Editor

### Prices not syncing
- The frontend syncs from API on page load
- Check browser console for API errors
- Data falls back to localStorage if API fails
