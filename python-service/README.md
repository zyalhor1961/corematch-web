# CoreMatch Brain - Python Microservice

## Quick Start

### 1. Setup Environment
Copy the example environment file and add your Supabase credentials:
```bash
cd python-service
copy env.example .env
```

Edit `.env` and add:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_KEY`: Your Supabase service role key (not anon key!)

### 2. Run Supabase Migration
In Supabase Studio, run the SQL migration:
```sql
-- See: supabase/migrations/create_jobs_table.sql
```

### 3. Start the Service
```bash
# From project root
docker-compose up --build
```

The Python Brain will be available at `http://localhost:8000`

### 4. Test the Service
```bash
# Health check
curl http://localhost:8000/

# Test invoice analysis
curl -X POST http://localhost:8000/analyze-invoice \
  -H "Content-Type: application/json" \
  -d '{"invoice_id": "INV-001", "amount": 6000.50}'
```

### 5. Test from Next.js
```bash
# Via Next.js proxy
curl -X POST http://localhost:3001/api/brain/analyze-invoice \
  -H "Content-Type: application/json" \
  -d '{"invoice_id": "INV-002", "amount": 3500.00}'
```

## Architecture

```
┌─────────────────────┐         ┌──────────────────┐
│   Next.js (Body)    │◄───────►│  Supabase (DB)   │
│   Port: 3001        │         │  - jobs table    │
│                     │         │  - Realtime      │
└─────────────────────┘         └──────────────────┘
         │                               ▲
         │ HTTP                          │
         ▼                               │
┌─────────────────────┐                  │
│  Python (Brain)     │──────────────────┘
│  Port: 8000         │
│  - FastAPI          │
│  - LangGraph        │
│  - Background Tasks │
└─────────────────────┘
```

## API Endpoints

### Python Service (Port 8000)

- `GET /` - Health check
- `GET /health` - Detailed health status
- `POST /analyze-invoice` - Trigger invoice analysis
  ```json
  {
    "invoice_id": "INV-001",
    "amount": 6000.50
  }
  ```

### Next.js Proxy (Port 3001)

- `GET /api/brain/analyze-invoice` - Check Brain service health
- `POST /api/brain/analyze-invoice` - Analyze invoice (proxied to Python)

## Development

### Hot Reload
The Docker Compose configuration includes volume mounting for hot reload:
- Edit Python files in `python-service/`
- Changes are automatically detected
- Service reloads automatically

### Logs
```bash
# View Python service logs
docker-compose logs -f python_service
```

### Stop Service
```bash
docker-compose down
```

## Troubleshooting

### Port Already in Use
If port 8000 is already in use:
```bash
# Find process using port 8000
netstat -ano | findstr :8000

# Kill the process (replace PID)
taskkill /PID <PID> /F
```

### Supabase Connection Error
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `.env`
- Ensure the `jobs` table exists (run migration)
- Check Supabase project is not paused

### Docker Build Error
```bash
# Clean rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up
```
