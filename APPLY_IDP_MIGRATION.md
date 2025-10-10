# Apply IDP Migration to Supabase

## Quick Start

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project
   - Navigate to: **SQL Editor**

2. **Copy the Migration**
   - Open file: `supabase/migrations/007_idp_module.sql`
   - Select all content (Ctrl+A)
   - Copy (Ctrl+C)

3. **Execute in Supabase**
   - Paste into SQL Editor
   - Click **"Run"** button
   - Wait for confirmation

## What This Migration Creates

### 📊 Tables

1. **idp_documents** - Core document storage with accounting-grade audit trail
   - Full document metadata (filename, size, type)
   - Processing status workflow
   - Azure Document Intelligence integration
   - Financial data (amounts, dates, currencies)
   - Vendor/customer information
   - Complete audit trail (created, validated, approved, exported)

2. **idp_extracted_fields** - All extracted fields with confidence scores
   - Field values (text, number, date, JSON)
   - Bounding box coordinates
   - Validation status
   - Human validation tracking

3. **idp_validation_rules** - Business rules for document validation
   - Required fields
   - Confidence thresholds
   - Format validation (regex)
   - Business logic rules

4. **idp_validation_results** - Validation results per document
   - Pass/fail status
   - Error messages
   - Suggested corrections
   - Resolution tracking

5. **idp_audit_log** - Complete audit trail
   - All document operations
   - User actions
   - Before/after changes
   - IP address and user agent

6. **idp_export_batches** - Export to accounting systems
   - Batch exports
   - Multiple format support (CSV, Excel, Sage, QuickBooks, Xero)
   - Status tracking

7. **idp_export_batch_items** - Documents in export batches
   - Links documents to batches
   - Item-level status

### 🔒 Security Features

- ✅ Row Level Security (RLS) enabled on all tables
- ✅ Organization-based access control
- ✅ Role-based permissions (Admin, Manager, Viewer)
- ✅ Soft delete capability
- ✅ Audit logging for compliance

### 📈 Performance Features

- ✅ Comprehensive indexes on frequently queried columns
- ✅ Optimized for filtering by status, date, vendor
- ✅ Fast full-text search on document metadata

### 🎯 Accounting Features

- ✅ High-precision decimal fields (15,4 for amounts)
- ✅ Multi-currency support (ISO 4217)
- ✅ VAT/Tax tracking
- ✅ Invoice and PO number indexing
- ✅ Date-based filtering (document date, due date)
- ✅ Vendor/supplier tracking
- ✅ Export batch management

## Verification

After running the migration, verify with these SQL queries:

```sql
-- Check tables were created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'idp_%'
ORDER BY table_name;

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'idp_%';

-- Check indexes
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename LIKE 'idp_%'
ORDER BY tablename, indexname;
```

Expected results:
- 7 tables created (all starting with `idp_`)
- All tables have `rowsecurity = true`
- 20+ indexes created

## Next Steps

After successful migration:

1. ✅ Tables are ready for IDP document processing
2. ✅ Can start uploading documents
3. ✅ Azure Document Intelligence integration works
4. ✅ Validation rules can be configured
5. ✅ Export functionality available

## Troubleshooting

If you see errors about existing tables:
```sql
-- Drop existing tables if needed (CAUTION: This deletes data!)
DROP TABLE IF EXISTS idp_export_batch_items CASCADE;
DROP TABLE IF EXISTS idp_export_batches CASCADE;
DROP TABLE IF EXISTS idp_audit_log CASCADE;
DROP TABLE IF EXISTS idp_validation_results CASCADE;
DROP TABLE IF EXISTS idp_validation_rules CASCADE;
DROP TABLE IF EXISTS idp_extracted_fields CASCADE;
DROP TABLE IF EXISTS idp_documents CASCADE;
```

Then re-run the migration.
