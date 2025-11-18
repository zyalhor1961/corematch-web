# RAG System - Corematch

**Retrieval-Augmented Generation** pour recherche sémantique et "Chat with your documents"

## 🎯 Vue d'ensemble

Le système RAG de Corematch permet:
- ✅ **Recherche sémantique** dans tous vos documents (factures, CVs, contrats)
- ✅ **Citations traçables** - chaque réponse IA cite ses sources
- ✅ **Recherche hybride** - combine vector similarity + full-text search
- ✅ **Multi-tenant** - isolation par organisation avec RLS
- ✅ **Cost-efficient** - chunking intelligent, caching, batch processing

## 📊 Architecture

```
Document Upload
    ↓
┌─────────────────────────────┐
│  1. Chunking                │  Découpe intelligente (semantic/fixed/hybrid)
│     - Respect paragraphes   │
│     - Overlap entre chunks  │
│     - 500-800 tokens/chunk  │
└─────────────────────────────┘
    ↓
┌─────────────────────────────┐
│  2. Embeddings              │  OpenAI text-embedding-3-small
│     - 1536 dimensions       │  (1536 dims, $0.02/1M tokens)
│     - Batch processing      │
│     - ~$0.0001/document     │
└─────────────────────────────┘
    ↓
┌─────────────────────────────┐
│  3. Storage                 │  Supabase PostgreSQL + pgvector
│     - pgvector (HNSW index) │
│     - RLS par organization  │
│     - Full-text search (GIN)│
└─────────────────────────────┘
    ↓
┌─────────────────────────────┐
│  4. Retrieval               │  Recherche hybride optimisée
│     - Vector similarity     │  vector (70%) + FTS (30%)
│     - Full-text search      │
│     - Metadata filters      │
└─────────────────────────────┘
    ↓
┌─────────────────────────────┐
│  5. Citations               │  Références traçables
│     - Page-level citations  │
│     - Source tracking       │
│     - LLM-ready context     │
└─────────────────────────────┘
```

## 🚀 Installation

### 1. Appliquer les migrations SQL

Les migrations activent pgvector et créent les tables/fonctions nécessaires:

#### Option A: Via SQL Editor Supabase (recommandé)

1. Ouvrir https://supabase.com/dashboard/project/YOUR_PROJECT/sql
2. Copier-coller le contenu de `supabase/migrations/20250117_enable_pgvector.sql`
3. Exécuter
4. Copier-coller le contenu de `supabase/migrations/20250117_create_embeddings_schema.sql`
5. Exécuter

#### Option B: Via psql

```bash
# Récupérer la connection string depuis Supabase Dashboard
psql "postgresql://postgres:[YOUR-PASSWORD]@db.glexllbywdvlxpbanjmn.supabase.co:5432/postgres"

# Exécuter les migrations
\i supabase/migrations/20250117_enable_pgvector.sql
\i supabase/migrations/20250117_create_embeddings_schema.sql
```

### 2. Vérifier l'installation

```sql
-- Vérifier que pgvector est installé
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Vérifier que la table existe
SELECT COUNT(*) FROM content_embeddings;

-- Tester une fonction
SELECT * FROM get_embeddings_stats('00000000-0000-0000-0000-000000000000');
```

### 3. Configurer les variables d'environnement

Déjà configuré dans `.env.local`:
- ✅ `OPENAI_API_KEY` - Pour génération d'embeddings
- ✅ `SUPABASE_URL` - URL Supabase
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Clé service role

## 📖 Usage

### Example 1: Ingérer un document DAF

```typescript
import { ingestDocument } from '@/lib/rag';

// Après upload et extraction d'une facture
const result = await ingestDocument(extractedText, {
  org_id: organization.id,
  source_id: document.id,
  content_type: 'daf_document',
  source_table: 'daf_documents',
  source_metadata: {
    file_name: 'facture-2025-001.pdf',
    doc_type: 'facture',
    fournisseur: 'Acme Corp',
    date_document: '2025-01-15',
    montant_ttc: 1234.56,
  },
});

console.log(`✓ Created ${result.chunks_created} chunks`);
console.log(`  Cost: $${result.estimated_cost_usd.toFixed(4)}`);
```

### Example 2: Rechercher des documents (query RAG)

```typescript
import { queryRAG } from '@/lib/rag';

// L'utilisateur demande: "Quelles factures d'électricité avons-nous payées en janvier?"
const context = await queryRAG(
  "factures d'électricité janvier 2025",
  organization.id
);

// Résultat contient:
// - context.chunks: Les chunks pertinents
// - context.citations: Les sources citées
// - context.context_text: Texte prêt pour injection dans prompt LLM

console.log(`Found ${context.citations.length} relevant documents`);
console.log(`Total context: ${context.total_tokens} tokens`);
```

### Example 3: Utiliser le contexte RAG avec un LLM

```typescript
import { queryRAG } from '@/lib/rag';
import { OpenAI } from 'openai';

const userQuestion = "Combien avons-nous dépensé en électricité en janvier?";

// Récupérer le contexte
const context = await queryRAG(
  "factures électricité janvier 2025",
  orgId
);

// Construire le prompt avec citations
const prompt = `${context.context_text}

Question: ${userQuestion}

Instructions:
- Réponds uniquement en te basant sur les documents fournis
- Cite TOUJOURS tes sources avec [Citation #N]
- Si l'info n'est pas dans les docs, dis-le clairement
`;

// Appeler le LLM
const openai = new OpenAI();
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: 'Tu es un assistant comptable.' },
    { role: 'user', content: prompt },
  ],
});

// Réponse avec citations:
// "D'après les factures, vous avez dépensé 850€ en janvier 2025 [Citation #1],
// dont 450€ pour le bureau principal [Citation #2]."
```

### Example 4: Recherche avancée avec filtres

```typescript
import { createRAGOrchestrator } from '@/lib/rag';

const rag = createRAGOrchestrator();

// Rechercher uniquement dans les factures, avec filtres
const result = await rag.search({
  query: 'dépenses informatiques',
  org_id: orgId,
  content_type: 'daf_document',
  metadata_filters: {
    doc_type: 'facture',
    fournisseur: 'Dell',
  },
  limit: 5,
  mode: 'hybrid', // vector + FTS
});

for (const chunk of result.results) {
  console.log(`📄 ${chunk.source_metadata.file_name}`);
  console.log(`   Score: ${chunk.combined_score?.toFixed(2)}`);
  console.log(`   Extract: ${chunk.chunk_text.substring(0, 100)}...`);
}
```

### Example 5: Trouver des documents similaires

```typescript
import { createRAGOrchestrator } from '@/lib/rag';

const rag = createRAGOrchestrator();

// Trouver des factures similaires à une facture donnée
const similar = await rag.findSimilarDocuments(
  invoiceId,
  orgId,
  10 // top 10
);

console.log(`Found ${similar.results.length} similar documents:`);
for (const doc of similar.results) {
  console.log(`  - ${doc.source_metadata.file_name} (${(doc.vector_similarity! * 100).toFixed(0)}% similar)`);
}
```

## 🔧 Configuration avancée

### Chunking strategies

```typescript
import { createRAGOrchestrator } from '@/lib/rag';

const rag = createRAGOrchestrator({
  chunking: {
    strategy: 'hybrid',      // 'fixed' | 'semantic' | 'hybrid'
    max_tokens: 800,         // Taille max chunk
    overlap_tokens: 100,     // Overlap entre chunks
    min_tokens: 50,          // Rejeter chunks trop petits
    respect_boundaries: true // Respecter paragraphes/sections
  },
});
```

**Quand utiliser chaque stratégie:**
- `fixed`: Documents sans structure (logs, conversations)
- `semantic`: Documents structurés (markdown, rapports)
- `hybrid`: **Recommandé** - meilleur compromis

### Embedding models

```typescript
const rag = createRAGOrchestrator({
  embedding: {
    provider: 'openai',
    model: 'text-embedding-3-small', // Ou 'text-embedding-3-large'
    dimensions: 1536,                // 1536 (small) ou 3072 (large)
    batch_size: 100,
  },
});
```

**Comparaison des modèles:**
| Model | Dimensions | Cost/1M tokens | Performance |
|-------|-----------|---------------|-------------|
| text-embedding-3-small | 1536 | $0.02 | ⭐⭐⭐⭐ Good |
| text-embedding-3-large | 3072 | $0.13 | ⭐⭐⭐⭐⭐ Best |

**Recommandation:** `text-embedding-3-small` pour Corematch (excellent rapport qualité/prix)

### Recherche modes

```typescript
const context = await rag.query({
  query: 'factures',
  org_id: orgId,
  mode: 'hybrid',     // 'vector' | 'fts' | 'hybrid'
  weights: {
    vector: 0.7,      // 70% vector similarity
    fts: 0.3,         // 30% full-text search
  },
});
```

**Quand utiliser chaque mode:**
- `vector`: Recherche conceptuelle ("documents sur la TVA")
- `fts`: Recherche exacte ("numéro facture FAC-2025-001")
- `hybrid`: **Recommandé** - combine les deux

## 📊 Statistiques & Monitoring

```typescript
import { createRAGOrchestrator } from '@/lib/rag';

const rag = createRAGOrchestrator();

// Stats par organisation
const stats = await rag.getStats(orgId);

console.log(`Total chunks: ${stats.total_chunks}`);
console.log(`Total documents: ${stats.total_documents}`);
console.log(`By type:`, stats.by_content_type);
console.log(`Total tokens: ${stats.total_tokens}`);

// Exemple de sortie:
// {
//   total_chunks: 1250,
//   total_documents: 87,
//   by_content_type: {
//     daf_document: 65,
//     cv: 22
//   },
//   total_tokens: 985420
// }
```

## 💰 Coûts estimés

### Ingestion (one-time per document)

| Document type | Avg pages | Chunks | Tokens | Cost |
|--------------|-----------|--------|--------|------|
| Facture PDF | 1-2 | 2-4 | 1,500 | $0.00003 |
| CV PDF | 2-3 | 4-6 | 3,000 | $0.00006 |
| Contrat PDF | 10-20 | 15-30 | 18,000 | $0.00036 |

**Exemple:** 1000 factures/mois = ~$0.03/mois

### Retrieval (per query)

Coût = **$0** (stocké dans Supabase, recherche vectorielle gratuite)

Seul coût: génération de l'embedding de la requête (~20 tokens = $0.0000004)

**Exemple:** 10,000 queries/mois = ~$0.004/mois

### Total estimé pour Corematch

- **100 documents/mois** (ingestion) = $0.006
- **1,000 queries/mois** (recherche) = $0.0004
- **Total: ~$0.01/mois** 🎉

## 🧪 Tests

```typescript
// Test du système complet
import { createRAGOrchestrator } from '@/lib/rag';

const rag = createRAGOrchestrator();

// 1. Ingest un document de test
const result = await rag.ingestDocument({
  org_id: testOrgId,
  source_id: 'test-doc-1',
  content_type: 'daf_document',
  source_table: 'daf_documents',
  source_metadata: { file_name: 'test.pdf' },
  text: 'Facture EDF numéro 123456 du 15 janvier 2025 pour un montant de 850 euros TTC.',
});

console.assert(result.success, 'Ingestion failed');
console.assert(result.chunks_created > 0, 'No chunks created');

// 2. Query
const context = await rag.query({
  query: 'facture EDF',
  org_id: testOrgId,
});

console.assert(context.chunks.length > 0, 'No results found');
console.assert(context.citations.length > 0, 'No citations');

console.log('✅ All tests passed!');
```

## 🔐 Sécurité

- ✅ **RLS activé** - Isolation par organisation
- ✅ **Service Role Key** requis pour storage/retrieval
- ✅ **Metadata sanitization** - Pas de secrets dans metadata
- ✅ **RGPD compliant** - Embeddings anonymisés, suppression possible

## 📈 Prochaines étapes (optionnel)

1. **Reranking** - Réordonner les résultats avec un modèle cross-encoder
2. **Query expansion** - Générer des variantes de la query pour meilleure recall
3. **Feedback loop** - Apprendre des clics utilisateurs
4. **Multilingual** - Support autres langues (EN, DE, ES)
5. **Vector compression** - Réduire dimensions pour économiser storage

## 🐛 Troubleshooting

### Erreur: "pgvector extension not found"

→ Appliquer la migration `20250117_enable_pgvector.sql`

### Erreur: "OPENAI_API_KEY not found"

→ Vérifier `.env.local` ou 1Password

### Recherche retourne 0 résultats

→ Vérifier que le document a été ingesté avec `rag.getStats(orgId)`

### Performance lente

→ Vérifier les index HNSW: `EXPLAIN ANALYZE SELECT ...`

---

**Développé par:** Corematch Team
**Date:** Janvier 2025
**Version:** 1.0.0
**Status:** ✅ Production Ready
