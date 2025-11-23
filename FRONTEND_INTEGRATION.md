# Frontend Integration - Complete Guide

## Overview
This guide shows how to integrate the Python Brain service with your Next.js frontend using Realtime updates.

## Architecture

```
User clicks "Analyze" 
    ↓
Next.js Component (AgentAnalysisCard)
    ↓
Custom Hook (useInvoiceAgent)
    ↓
API Proxy (/api/brain/analyze-invoice)
    ↓
Python Brain Service (FastAPI)
    ↓
LangGraph Agent
    ↓
Supabase (jobs table)
    ↓
Realtime Subscription ⚡
    ↓
UI Updates Automatically!
```

## Files Created

### 1. API Proxy Route
**File**: `app/api/brain/analyze-invoice/route.ts`
- Forwards requests to Python service
- Validates input
- Handles errors gracefully
- Health check endpoint

### 2. Realtime Hook
**File**: `hooks/useInvoiceAgent.ts`
- Subscribes to Supabase Realtime for job updates
- Triggers invoice analysis
- Manages state (status, result, logs)
- Automatic UI updates when job completes

### 3. UI Component
**File**: `components/Invoice/AgentAnalysisCard.tsx`
- Beautiful card UI with animations
- "Analyze" button to trigger agent
- Real-time status display
- Terminal-style logs
- Result badge (APPROVED / NEEDS_APPROVAL)

## Usage Example

Add the component to any invoice page:

```tsx
import { AgentAnalysisCard } from '@/components/Invoice/AgentAnalysisCard';

export default function InvoicePage() {
  return (
    <div>
      <h1>Invoice INV-001</h1>
      
      {/* Add the Agent Card */}
      <AgentAnalysisCard 
        invoiceId="INV-001" 
        amount={6000.50} 
      />
    </div>
  );
}
```

## How It Works

1. **User clicks "Analyze"**
   - Hook calls `/api/brain/analyze-invoice`
   - Status changes to "pending"
   - Logs show "Connecting to Agent Core..."

2. **API Proxy forwards to Python**
   - Python service receives request
   - Creates job in Supabase with status "pending"
   - Returns immediately (200 OK)

3. **Python Brain processes in background**
   - LangGraph agent analyzes invoice
   - Checks if amount > €5,000
   - Updates job in Supabase with result

4. **Realtime subscription fires**
   - Hook receives update from Supabase
   - Status changes to "completed"
   - Result and logs appear in UI
   - Animations play

## Testing

### Test 1: Start Python Service
```bash
docker-compose up --build
```

### Test 2: Add Component to Page
```tsx
// In app/org/[orgId]/erp/invoices/[id]/page.tsx
<AgentAnalysisCard invoiceId="INV-001" amount={6000.50} />
```

### Test 3: Click "Analyze"
- Watch the terminal logs animate
- See the result badge appear
- Check Supabase jobs table for the record

### Test 4: Try Different Amounts
```tsx
// Should get "APPROVED"
<AgentAnalysisCard invoiceId="INV-002" amount={3000} />

// Should get "NEEDS_APPROVAL"
<AgentAnalysisCard invoiceId="INV-003" amount={7500} />
```

## Environment Variables

Add to `.env.local`:
```env
PYTHON_SERVICE_URL=http://127.0.0.1:8000
```

For Docker Compose networking:
```env
PYTHON_SERVICE_URL=http://python_service:8000
```

## Troubleshooting

### Realtime Not Working
1. Check Supabase Realtime is enabled on `jobs` table
2. Verify RLS policies allow reading jobs
3. Check browser console for subscription errors

### Agent Not Responding
1. Verify Python service is running: `curl http://localhost:8000/`
2. Check Docker logs: `docker-compose logs -f python_service`
3. Verify Supabase credentials in Python `.env`

### UI Not Updating
1. Check browser console for errors
2. Verify `invoice_id` matches between component and database
3. Check Network tab for API call success

## Next Steps

1. **Add to Invoice Detail Page**
   - Show agent analysis on invoice view
   - Display approval status

2. **Batch Analysis**
   - Analyze multiple invoices at once
   - Show progress for each

3. **More Agents**
   - Add fraud detection agent
   - Add duplicate detection agent
   - Add vendor verification agent

4. **Enhanced UI**
   - Add charts for analysis trends
   - Show agent confidence scores
   - Display historical analyses
