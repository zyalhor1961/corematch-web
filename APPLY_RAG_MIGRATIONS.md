# 🚀 Apply RAG Migrations - Quick Start

**Time required:** 2 minutes
**Difficulty:** Easy

---

## ⚠️ Important

The RAG system is **code-complete** but **NOT active** until you apply the SQL migrations to enable pgvector.

---

## 🎯 Quick Steps

### 1. Open Supabase SQL Editor

Go to: https://supabase.com/dashboard/project/glexllbywdvlxpbanjmn/sql

### 2. Run Migration 1 - Enable pgvector

Copy-paste the entire content of `supabase/migrations/20250117_enable_pgvector.sql`:

```sql
-- =====================================================
-- RAG Foundation - Phase 2
-- Enable pgvector extension for semantic search
-- =====================================================
-- Date: 2025-01-17
-- Objectif: Activer la recherche sémantique (embeddings)

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Vérifier que l'extension est bien installée
COMMENT ON EXTENSION vector IS 'pgvector: vector similarity search for PostgreSQL';
```

Click **Run** ▶️

Expected output: `CREATE EXTENSION`

### 3. Run Migration 2 - Create schema

Copy-paste the **ENTIRE** content of `supabase/migrations/20250117_create_embeddings_schema.sql`

**Note:** This file is ~300 lines. Make sure you copy everything from top to bottom.

Click **Run** ▶️

Expected output: Multiple `CREATE TABLE`, `CREATE INDEX`, `CREATE FUNCTION` statements

### 4. Verify installation

Run this query in SQL Editor:

```sql
-- Check pgvector installed
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Check table exists
SELECT COUNT(*) FROM content_embeddings;

-- Check functions exist
SELECT proname FROM pg_proc WHERE proname LIKE '%embedding%';
```

Expected output:
- ✅ 1 row with `vector` extension
- ✅ 0 rows in content_embeddings (empty table, normal)
- ✅ Multiple functions: `search_embeddings`, `hybrid_search`, etc.

---

## ✅ Done!

Your RAG system is now **ACTIVE** and ready to use!

### Test it

1. Upload a PDF in DAF demo: http://localhost:3000/daf-demo
2. Check logs - you should see:
   ```
   [DAF Upload] Generating RAG embeddings for document...
   [RAG Ingestion] Creating 3 chunks...
   [Embeddings] Generated 3 embeddings in 450ms
   ✓ RAG embeddings generated: 3 chunks, $0.0001
   ```

3. Query the API:
   ```bash
   curl -X POST http://localhost:3000/api/rag/search \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{"query": "factures", "limit": 5}'
   ```

---

## 🐛 Troubleshooting

### Error: "extension vector does not exist"

→ Supabase may not have pgvector enabled by default.

**Solution:** Contact Supabase support or check if your plan supports pgvector.

Alternatively, check if pgvector is available:

```sql
SELECT * FROM pg_available_extensions WHERE name = 'vector';
```

If it shows up, run:

```sql
CREATE EXTENSION vector;
```

### Error: "relation content_embeddings does not exist"

→ Migration 2 didn't run completely.

**Solution:** Re-run `20250117_create_embeddings_schema.sql` entirely.

### No embeddings generated after upload

→ Check OpenAI API key:

```bash
# In .env.local
OPENAI_API_KEY=sk-proj-...
```

→ Check logs for errors:

```bash
npm run dev
# Upload a PDF
# Look for [DAF Upload] and [RAG] logs
```

---

## 📊 Monitor embeddings

Check stats:

```bash
curl http://localhost:3000/api/rag/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Or in SQL:

```sql
SELECT * FROM get_embeddings_stats('YOUR_ORG_ID');
```

---

**That's it! You're ready to use RAG! 🎉**

Next: Read `lib/rag/README.md` for usage examples.
