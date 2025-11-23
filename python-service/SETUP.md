# Python Brain Service - Setup Instructions

## ✅ Step 1: Database Migration (COMPLETED)
The `jobs` table has been successfully created in Supabase!

## 📝 Step 2: Configure Environment Variables

You need to create a `.env` file in the `python-service` directory with your Supabase credentials.

### Get Your Service Role Key:
1. Go to your Supabase project: https://supabase.com/dashboard
2. Click on your project
3. Go to **Settings** → **API**
4. Copy the **service_role** key (NOT the anon key!)
   - ⚠️ **Important**: The service_role key is secret and should never be exposed to the client

### Create the .env file:
```bash
cd python-service
copy env.example .env
```

Then edit `.env` and add:
```env
SUPABASE_URL=https://glexllbywdvlxpbanjmn.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here
```

## 🐳 Step 3: Start the Python Brain Service

### Option A: Using Docker (Recommended)
```bash
# From project root (f:\corematch)
docker-compose up --build
```

This will:
- Build the Python service container
- Start the service on port 8000
- Enable hot reload for development

### Option B: Using Python Directly (Alternative)
If you prefer to run without Docker:
```bash
cd python-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## 🧪 Step 4: Test the Service

### Test 1: Health Check
```bash
curl http://localhost:8000/
```
Expected response:
```json
{"status": "CoreMatch Brain is operational 🧠", "version": "1.0.0"}
```

### Test 2: Detailed Health Check
```bash
curl http://localhost:8000/health
```
Expected response:
```json
{"status": "healthy", "supabase": "connected"}
```

### Test 3: Analyze an Invoice
```bash
curl -X POST http://localhost:8000/analyze-invoice \
  -H "Content-Type: application/json" \
  -d "{\"invoice_id\": \"INV-001\", \"amount\": 6000.50}"
```
Expected response:
```json
{"message": "Agent triggered successfully", "job_id": "INV-001"}
```

### Test 4: Check Job Status in Supabase
1. Go to Supabase Studio
2. Open the **Table Editor**
3. Select the `jobs` table
4. You should see a new row with:
   - `invoice_id`: "INV-001"
   - `status`: "completed"
   - `result`: "NEEDS_APPROVAL" (because 6000.50 > 5000)
   - `logs`: Array with analysis details

### Test 5: Test from Next.js
```bash
curl -X POST http://localhost:3001/api/brain/analyze-invoice \
  -H "Content-Type: application/json" \
  -d "{\"invoice_id\": \"INV-002\", \"amount\": 3500.00}"
```

## 🎯 What Happens When You Analyze an Invoice?

1. **Request arrives** at Python service
2. **Job created** in Supabase `jobs` table with status "pending"
3. **Background task starts** - LangGraph agent analyzes the invoice
4. **Agent logic**:
   - If amount > 5000: Status = "NEEDS_APPROVAL"
   - If amount ≤ 5000: Status = "APPROVED"
5. **Job updated** in Supabase with result and logs
6. **Realtime notification** sent to Next.js (if subscribed)

## 🔍 Troubleshooting

### Port 8000 Already in Use
```bash
# Find process using port 8000
netstat -ano | findstr :8000

# Kill the process (replace PID)
taskkill /PID <PID> /F
```

### Supabase Connection Error
- Verify `SUPABASE_URL` is correct
- Verify `SUPABASE_SERVICE_KEY` is the **service_role** key (not anon key)
- Check your Supabase project is not paused

### Docker Build Error
```bash
# Clean rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up
```

## 📊 View Logs
```bash
# View Python service logs
docker-compose logs -f python_service

# View specific number of lines
docker-compose logs --tail=50 python_service
```

## 🛑 Stop the Service
```bash
docker-compose down
```

## 🚀 Next Steps

Once the Python Brain is running:
1. Integrate it with your Invoice pages in Next.js
2. Subscribe to Realtime updates on the `jobs` table
3. Display agent results in the UI
4. Add more agent nodes to the LangGraph workflow
5. Deploy to production (Railway, Render, or Fly.io)
