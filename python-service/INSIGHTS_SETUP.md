# Python Dependencies for Enhanced Insights Agent

## Required Packages

```bash
# Core dependencies (already installed)
pandas
langchain-openai
supabase
python-dotenv

# Redis caching
redis

# PDF export
reportlab

# Excel export
openpyxl
```

## Installation

```bash
cd python-service
pip install redis reportlab openpyxl
```

## Redis Setup (Optional but Recommended)

### Local Development
```bash
# Using Docker
docker run -d -p 6379:6379 redis:alpine

# Or using Homebrew (Mac)
brew install redis
brew services start redis
```

### Production (Railway/Heroku)
Add Redis addon from your platform's marketplace.

Set environment variables:
```
REDIS_HOST=your-redis-host
REDIS_PORT=6379
```

## Environment Variables

Add to `.env`:
```
# Existing
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...

# New for Redis (optional)
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Features Status

✅ Multi-data source support (invoices, clients, products, orders)
✅ Redis caching with 1-hour TTL
✅ Query history tracking in Supabase
✅ Smart AI-generated suggestions
✅ Popular queries tracking
✅ Multi-language support (FR/EN auto-detection)
✅ PDF export with embedded charts
✅ Excel export with formatted data and charts
✅ Enhanced frontend with language toggle
✅ Export buttons (PDF/Excel)

## Notes

- Redis is optional - the system gracefully falls back if Redis is not available
- PDF/Excel export requires reportlab and openpyxl - install only if needed
- Query history is automatically saved to Supabase for analytics
