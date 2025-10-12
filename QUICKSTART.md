# DEB System - Quick Start Guide

Get the DEB (Déclaration d'Échanges de Biens) system running in 5 minutes.

---

## Prerequisites

- Supabase project: `glexllbywdvlxpbanjmn`
- OpenAI API key (already configured in `.env.local`)
- Node.js 18+ installed

---

## Step 1: Apply Database Migration (2 minutes)

**Option A: Supabase Dashboard (Recommended)**

1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/glexllbywdvlxpbanjmn/sql)
2. Click **"New Query"**
3. Open `F:\corematch\supabase\migrations\008_deb_business_logic.sql`
4. Copy all contents (Ctrl+A, Ctrl+C)
5. Paste into SQL Editor
6. Click **"Run"** or press Ctrl+Enter
7. Wait for "Success" message

**Verify Migration:**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'deb_%'
ORDER BY table_name;
```

You should see:
- `deb_article_reference`
- `deb_eu_countries`
- `deb_vat_controls`

---

## Step 2: Start Development Server (30 seconds)

```bash
cd F:\corematch
npm run dev
```

Server starts at: http://localhost:3000

---

## Step 3: Test the System (2 minutes)

**Quick API Test:**

```bash
# Test complete DEB workflow
npx tsx examples/deb-complete-test.ts
```

This will run through:
- ✅ VAT financial controls
- ✅ HS code enrichment (OpenAI)
- ✅ Auto-learning validation
- ✅ Transport allocation
- ✅ Archive preparation

**Expected Output:**
```
╔════════════════════════════════════════════════════════╗
║       DEB COMPLETE SYSTEM TEST                         ║
╚════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────┐
│ STEP 1: VAT Financial Controls                  │
└─────────────────────────────────────────────────┘

✓ Overall Status: PASSED
  ├─ Arithmetic TTC: ✅ passed
  ├─ Intra-EU: ✅ passed
  └─ VAT Zero: ✅ passed

[... more test output ...]

✅ All steps completed successfully!
```

---

## Step 4: Use in Your Application

### In API Routes

```typescript
import { performVATControls } from '@/lib/services/deb/vat-control';
import { enrichHSCodes } from '@/lib/services/deb/hs-code-enrichment';

// Run VAT controls
const vatResult = await performVATControls({
  documentId: 'doc-123',
  netAmount: 1000.00,
  taxAmount: 0.00,
  totalAmount: 1000.00,
  vendorVAT: 'DE123456789',
  vendorCountry: 'DE'
});

// Enrich HS codes
const enrichResult = await enrichHSCodes({
  orgId: 'your-org-id',
  documentId: 'doc-123',
  lineItems: [
    {
      lineId: 'line-1',
      description: 'Laptop computer Dell XPS 13',
      quantity: 2,
      unitPrice: 1500.00,
      valueHT: 3000.00
    }
  ]
});
```

### In React Pages

```tsx
import { DEBValidationInterface } from '@/app/components/deb/DEBValidationInterface';

export default function ValidatePage({ params }) {
  return (
    <DEBValidationInterface
      documentId={params.documentId}
      orgId={params.orgId}
      onComplete={() => {
        console.log('Validation complete!');
        // Navigate to next step
      }}
    />
  );
}
```

### API Endpoints

All endpoints are ready at `/api/deb/`:

```bash
# Run VAT controls
POST /api/deb/documents/[documentId]/vat-control

# Enrich HS codes
POST /api/deb/documents/[documentId]/enrich-hs-codes

# Validate user corrections
POST /api/deb/documents/[documentId]/validate-line

# Prepare for archiving
POST /api/deb/documents/[documentId]/prepare-archive

# Get learning statistics
GET /api/deb/reference/stats?orgId=your-org-id

# Export reference database
GET /api/deb/reference/export?orgId=your-org-id

# Import articles
POST /api/deb/reference/import

# Manage articles
GET /api/deb/reference/articles?orgId=your-org-id
```

---

## Verification Checklist

After setup, verify:

- [ ] Database migration applied successfully
- [ ] 3 new tables exist (`deb_article_reference`, `deb_vat_controls`, `deb_eu_countries`)
- [ ] Development server starts without errors
- [ ] Test script runs successfully
- [ ] OpenAI API key is working (check enrichment results)

---

## What the System Does

### 1. VAT Financial Controls
Automatically validates:
- ✅ Arithmetic accuracy (net + tax = total)
- ✅ Intra-EU transaction detection
- ✅ Reverse charge VAT verification

### 2. HS Code Enrichment
Two-tier approach:
1. **Reference Database** (Priority A) - Instant, free, from previous validations
2. **OpenAI GPT-4o** (Priority B) - AI-powered suggestions with reasoning

### 3. Auto-Learning System
- Records every user validation
- Builds organization-specific reference database
- Improves hit rate over time (80-90% after 100-200 validations)
- Reduces OpenAI costs by 80-90%

### 4. Complete Validation UI
- Excel-like table interface
- Inline HS code editing with format validation
- Weight input fields
- Confidence indicators
- Source badges (DB/AI/User)
- Batch validation support

---

## Cost Savings

**Without Learning System:**
- 1000 invoice lines × $0.015/line = **$15.00**

**With Learning System (after 100 validations):**
- 800 lines from DB (free) + 200 lines × $0.015 = **$3.00**
- **Savings: 80% ($12.00)**

---

## Troubleshooting

### "Table does not exist" error
→ Go back to Step 1 and apply the migration

### OpenAI API errors
→ Check `OPENAI_API_KEY` in `.env.local`

### Supabase connection errors
→ Verify `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

### RLS policy errors
→ Make sure you're using the service role key for server-side operations

---

## Next Steps

1. **Test with Real Data**
   - Upload a real invoice PDF
   - Process through Azure Document Intelligence
   - Run VAT controls and enrichment
   - Validate in the UI

2. **Monitor Performance**
   - Check OpenAI API usage in OpenAI dashboard
   - Monitor reference database hit rate
   - Track validation times

3. **Train Your Team**
   - Show them the validation interface
   - Explain confidence scores
   - Demonstrate the learning system

---

## Full Documentation

For more details, see:

- **Technical Specification**: `docs/DEB_TECHNICAL_SPECIFICATION.md` (300+ lines)
- **Implementation Summary**: `docs/DEB_IMPLEMENTATION_SUMMARY.md` (400+ lines)
- **Usage Examples**: `docs/DEB_USAGE_EXAMPLES.md` (600+ lines)
- **Complete Deliverables**: `docs/DEB_FINAL_DELIVERABLES.md` (520+ lines)
- **Deployment Guide**: `DEPLOYMENT_GUIDE.md` (detailed deployment instructions)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DEB Processing Flow                       │
└─────────────────────────────────────────────────────────────┘

1. Document Upload → Azure Document Intelligence → Extract Fields

2. VAT Controls → Validate financial data
   ├─ Arithmetic TTC validation
   ├─ Intra-EU classification
   └─ VAT zero verification

3. HS Code Enrichment
   ├─ Priority A: Search reference database (instant)
   └─ Priority B: OpenAI suggestion (2-4 seconds)

4. User Validation → Record to learning database

5. Transport Allocation → Distribute fees by weight/value

6. Archive Preparation → Validate completeness → Export to SAE
```

---

## Support

- Check logs in browser console (F12)
- Review API responses for error details
- Verify environment variables are set correctly
- Check Supabase dashboard for RLS policy issues

---

**Status**: ✅ System Ready
**Version**: 1.0.0
**Last Updated**: 2025-10-12

**You're all set!** The DEB system is ready to process invoices with automated VAT controls and intelligent HS code enrichment.
