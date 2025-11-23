# Testing the Complete Integration

## 🎯 Goal
Test the full loop: UI → Next.js API → Python Brain → LangGraph → Supabase → Realtime → UI

## Prerequisites

### 1. Python Service Running
```bash
# Terminal 1: Start Python Brain
cd f:\corematch
docker-compose up --build
```

You should see:
```
python_service_1  | INFO:     Application startup complete.
python_service_1  | INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 2. Next.js Running
```bash
# Terminal 2: Start Next.js
npm run dev
```

### 3. Supabase Configuration
- ✅ `jobs` table created
- ✅ Realtime enabled
- ✅ Python service has Service Role Key in `.env`

## 🧪 Test Scenarios

### Test 1: Invoice Below Threshold (Should Auto-Approve)
1. Navigate to: `http://localhost:3001/org/75322f8c-4741-4e56-a973-92d68a261e4e/erp/invoices/INV-002`
2. Modify the mock data to use amount: `3000.00`
3. Click "Analyze"
4. **Expected Result**:
   - Status: "completed"
   - Result: "APPROVED" (green badge)
   - Logs: "Amount 3000.00 is within limits. Auto-approved."

### Test 2: Invoice Above Threshold (Should Need Approval)
1. Navigate to: `http://localhost:3001/org/75322f8c-4741-4e56-a973-92d68a261e4e/erp/invoices/INV-001`
2. Amount is `6000.50` (already above threshold)
3. Click "Analyze"
4. **Expected Result**:
   - Status: "completed"
   - Result: "NEEDS_APPROVAL" (amber badge)
   - Logs: "Amount 6000.50 exceeds limit of 5000.00. Escalating to CFO."

### Test 3: Verify Supabase Job Tracking
1. After clicking "Analyze", go to Supabase Studio
2. Open Table Editor → `jobs` table
3. **Expected to see**:
   - New row with `invoice_id`: "INV-001"
   - `status`: "completed"
   - `result`: "NEEDS_APPROVAL"
   - `logs`: Array with analysis messages
   - Timestamps for `created_at` and `updated_at`

### Test 4: Realtime Updates
1. Open browser DevTools (F12) → Console
2. Click "Analyze"
3. **Expected to see**:
   ```
   ⚡ Realtime Update: {status: "processing", ...}
   ⚡ Realtime Update: {status: "completed", result: "NEEDS_APPROVAL", ...}
   ```

### Test 5: Python Service Logs
1. Watch the Docker terminal while clicking "Analyze"
2. **Expected to see**:
   ```
   🤖 Accountant analyzing Invoice #INV-001...
   ✅ Job INV-001 completed: NEEDS_APPROVAL
   ```

## 🐛 Troubleshooting

### Issue: "Failed to reach the Neural Core"
**Solution**: 
- Check Python service is running: `curl http://localhost:8000/`
- Verify `PYTHON_SERVICE_URL` in `.env.local`

### Issue: UI doesn't update after clicking "Analyze"
**Solution**:
- Check browser console for errors
- Verify Realtime is enabled on `jobs` table
- Check Supabase connection in Python service

### Issue: "Agent connection failed"
**Solution**:
- Check Python service logs for errors
- Verify Supabase Service Role Key in `python-service/.env`
- Test Python service directly: 
  ```bash
  curl -X POST http://localhost:8000/analyze-invoice \
    -H "Content-Type: application/json" \
    -d '{"invoice_id": "TEST-001", "amount": 6000}'
  ```

### Issue: Job stays in "pending" status
**Solution**:
- Check Python service logs for errors
- Verify LangGraph dependencies are installed
- Check Supabase write permissions

## 📊 Success Criteria

✅ Python service starts without errors  
✅ Next.js connects to Python service  
✅ Clicking "Analyze" creates job in Supabase  
✅ Agent processes invoice and updates job  
✅ UI receives Realtime update  
✅ Result badge appears with correct status  
✅ Logs display in terminal-style UI  
✅ Different amounts produce different results  

## 🎬 Demo Flow

1. **Start Services**: Python + Next.js running
2. **Navigate**: Go to invoice detail page
3. **Analyze**: Click the "Analyze" button
4. **Watch**: Terminal logs animate
5. **Result**: Badge appears (green or amber)
6. **Verify**: Check Supabase for job record

## 📸 Expected UI States

### State 1: Idle
- "Analyze" button visible
- No logs or results

### State 2: Pending/Processing
- "Analyze" button hidden
- Terminal shows "Connecting to Agent Core..."
- Purple pulsing animation
- "Agent is thinking..." message

### State 3: Completed
- Result badge (APPROVED or NEEDS_APPROVAL)
- Full logs visible
- Timestamp for each log entry
- No animation

### State 4: Failed
- Red error badge
- "Connection Lost" message
- Retry by refreshing page

## 🚀 Next Steps After Testing

1. **Add More Agents**: Fraud detection, duplicate checking
2. **Batch Processing**: Analyze multiple invoices
3. **Historical View**: Show past analyses
4. **Confidence Scores**: Display agent certainty
5. **Manual Override**: Allow users to override agent decisions
