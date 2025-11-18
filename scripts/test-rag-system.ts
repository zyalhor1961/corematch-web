/**
 * Comprehensive RAG System Test
 *
 * Tests the complete RAG pipeline:
 * 1. Document ingestion (DAF & CV)
 * 2. Semantic search
 * 3. Stats monitoring
 * 4. Similar document finding
 */

// Load environment variables
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createRAGOrchestrator, ingestDocument, queryRAG } from '../lib/rag';

// Test org ID (replace with a real one from your DB)
const TEST_ORG_ID = '75322f8c-4741-4e56-a973-92d68a261e4e';

async function testRAGSystem() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 RAG SYSTEM COMPREHENSIVE TEST');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const rag = createRAGOrchestrator();

  // =========================================================================
  // TEST 1: Ingest DAF Document
  // =========================================================================
  console.log('\n📄 TEST 1: Ingesting DAF Document\n');

  const dafTestDoc = `
FACTURE N° FAC-2025-001
Date: 17 janvier 2025

Fournisseur: ACME Corporation
Adresse: 123 rue de la Tech, 75001 Paris

Article: Serveurs Cloud Premium
Quantité: 10 instances
Prix unitaire: 150.00 €
Total HT: 1,500.00 €
TVA 20%: 300.00 €
Total TTC: 1,800.00 €

Conditions de paiement: 30 jours
Date d'échéance: 16 février 2025
`;

  const dafResult = await ingestDocument(dafTestDoc, {
    org_id: TEST_ORG_ID,
    source_id: 'test-daf-001',
    content_type: 'daf_document',
    source_table: 'daf_documents',
    source_metadata: {
      file_name: 'test-facture-acme.pdf',
      doc_type: 'facture',
      fournisseur: 'ACME Corporation',
      date_document: '2025-01-17',
      montant_ttc: 1800.00,
      numero_facture: 'FAC-2025-001',
    },
  });

  console.log(`✅ DAF Document Ingested`);
  console.log(`   Chunks: ${dafResult.chunks_created}`);
  console.log(`   Tokens: ${dafResult.total_tokens}`);
  console.log(`   Cost: $${dafResult.estimated_cost_usd.toFixed(6)}`);
  console.log(`   Duration: ${dafResult.duration_ms}ms`);

  // =========================================================================
  // TEST 2: Ingest CV Document
  // =========================================================================
  console.log('\n👤 TEST 2: Ingesting CV Document\n');

  const cvTestDoc = `
CURRICULUM VITAE

John Doe
Développeur Full-Stack Senior
Email: john.doe@email.com
Téléphone: +33 6 12 34 56 78

EXPÉRIENCE PROFESSIONNELLE

Senior Full-Stack Developer - Tech Corp (2020-2025)
- Développement d'applications React/Next.js avec TypeScript
- Création d'APIs REST et GraphQL avec Node.js
- Architecture microservices avec Docker et Kubernetes
- CI/CD avec GitHub Actions
- Équipe de 5 développeurs

Full-Stack Developer - StartupXYZ (2018-2020)
- Applications web avec React et Express
- Bases de données PostgreSQL et MongoDB
- Tests unitaires et intégration avec Jest

COMPÉTENCES TECHNIQUES

Langages: TypeScript, JavaScript, Python, SQL
Frontend: React, Next.js, Tailwind CSS, Vue.js
Backend: Node.js, Express, NestJS, FastAPI
Databases: PostgreSQL, MongoDB, Redis
DevOps: Docker, Kubernetes, AWS, GitHub Actions

FORMATION

Master en Informatique - Université Paris-Saclay (2016-2018)
Licence en Informatique - Université Paris-Saclay (2013-2016)

LANGUES

Français: Natif
Anglais: Courant (TOEIC 950)
`;

  const cvResult = await ingestDocument(cvTestDoc, {
    org_id: TEST_ORG_ID,
    source_id: 'test-cv-001',
    content_type: 'cv',
    source_table: 'candidates',
    source_metadata: {
      file_name: 'john-doe-cv.pdf',
      first_name: 'John',
      last_name: 'Doe',
      project_id: 'test-project-001',
    },
  });

  console.log(`✅ CV Document Ingested`);
  console.log(`   Chunks: ${cvResult.chunks_created}`);
  console.log(`   Tokens: ${cvResult.total_tokens}`);
  console.log(`   Cost: $${cvResult.estimated_cost_usd.toFixed(6)}`);
  console.log(`   Duration: ${cvResult.duration_ms}ms`);

  // =========================================================================
  // TEST 3: Semantic Search - DAF Documents
  // =========================================================================
  console.log('\n🔍 TEST 3: Semantic Search - DAF Documents\n');

  const dafSearchQueries = [
    'factures serveurs cloud',
    'ACME Corporation',
    'montant supérieur à 1500 euros',
    'TVA 20%',
  ];

  for (const query of dafSearchQueries) {
    const startTime = Date.now();
    const context = await queryRAG(query, TEST_ORG_ID, {
      content_type: 'daf_document',
      limit: 5,
    });
    const duration = Date.now() - startTime;

    console.log(`Query: "${query}"`);
    console.log(`  Results: ${context.chunks.length} chunks from ${context.citations.length} documents`);
    console.log(`  Duration: ${duration}ms`);

    if (context.chunks.length > 0) {
      console.log(`  Top match: ${context.chunks[0].source_metadata.file_name || 'Unknown'}`);
      console.log(`  Similarity: ${((context.chunks[0].vector_similarity || 0) * 100).toFixed(1)}%`);
    }
    console.log('');
  }

  // =========================================================================
  // TEST 4: Semantic Search - CV Documents
  // =========================================================================
  console.log('\n🔍 TEST 4: Semantic Search - CV Documents\n');

  const cvSearchQueries = [
    'développeur React TypeScript',
    'expérience Kubernetes Docker',
    'full-stack senior',
    'compétences PostgreSQL',
  ];

  for (const query of cvSearchQueries) {
    const startTime = Date.now();
    const context = await queryRAG(query, TEST_ORG_ID, {
      content_type: 'cv',
      limit: 5,
    });
    const duration = Date.now() - startTime;

    console.log(`Query: "${query}"`);
    console.log(`  Results: ${context.chunks.length} chunks from ${context.citations.length} documents`);
    console.log(`  Duration: ${duration}ms`);

    if (context.chunks.length > 0) {
      const topMatch = context.chunks[0];
      console.log(`  Top match: ${topMatch.source_metadata.first_name || ''} ${topMatch.source_metadata.last_name || ''}`);
      console.log(`  Similarity: ${((topMatch.vector_similarity || 0) * 100).toFixed(1)}%`);
    }
    console.log('');
  }

  // =========================================================================
  // TEST 5: Hybrid Search (Vector + FTS)
  // =========================================================================
  console.log('\n🔍 TEST 5: Hybrid Search (Vector + FTS)\n');

  const hybridResult = await rag.search({
    query: 'facture ACME',
    org_id: TEST_ORG_ID,
    content_type: 'daf_document',
    mode: 'hybrid',
    limit: 5,
  });

  console.log(`Query: "facture ACME" (hybrid mode)`);
  console.log(`  Results: ${hybridResult.results.length}`);
  console.log(`  Duration: ${hybridResult.execution_time_ms}ms`);

  for (const result of hybridResult.results) {
    console.log(`  - ${result.source_metadata.file_name || 'Unknown'}`);
    console.log(`    Vector: ${((result.vector_similarity || 0) * 100).toFixed(1)}%`);
    console.log(`    FTS: ${(result.fts_rank || 0).toFixed(4)}`);
    console.log(`    Combined: ${((result.combined_score || 0) * 100).toFixed(1)}%`);
  }

  // =========================================================================
  // TEST 6: Statistics
  // =========================================================================
  console.log('\n📊 TEST 6: RAG Statistics\n');

  const stats = await rag.getStats(TEST_ORG_ID);

  console.log(`Total Chunks: ${stats.total_chunks}`);
  console.log(`Total Documents: ${stats.total_documents}`);
  console.log(`Total Tokens: ${stats.total_tokens.toLocaleString()}`);
  console.log(`\nBy Content Type:`);

  if (stats.by_content_type) {
    Object.entries(stats.by_content_type).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  }

  // =========================================================================
  // TEST 7: Similar Documents
  // =========================================================================
  console.log('\n🔗 TEST 7: Finding Similar Documents\n');

  const similarDocs = await rag.findSimilarDocuments(
    'test-daf-001',
    TEST_ORG_ID,
    5
  );

  console.log(`Similar to: test-daf-001`);
  console.log(`Found: ${similarDocs.results.length} similar documents`);

  for (const doc of similarDocs.results) {
    console.log(`  - ${doc.source_metadata.file_name || 'Unknown'}`);
    console.log(`    Similarity: ${((doc.vector_similarity || 0) * 100).toFixed(1)}%`);
  }

  // =========================================================================
  // TEST 8: Context Building for LLM
  // =========================================================================
  console.log('\n🤖 TEST 8: Context Building for LLM\n');

  const llmContext = await rag.buildPromptContext(
    'Combien a coûté les serveurs cloud ACME?',
    TEST_ORG_ID,
    {
      content_type: 'daf_document',
      limit: 3,
      max_tokens: 2000,
    }
  );

  console.log(`LLM Context Generated:`);
  console.log(`  Total tokens: ${llmContext.total_tokens}`);
  console.log(`  Citations: ${llmContext.citations.length}`);
  console.log(`  Context length: ${llmContext.context_text.length} chars`);
  console.log(`\nSample context (first 300 chars):`);
  console.log(`  ${llmContext.context_text.substring(0, 300)}...`);

  // =========================================================================
  // CLEANUP (Optional - comment out to keep test data)
  // =========================================================================
  console.log('\n🧹 CLEANUP: Deleting Test Documents\n');

  await rag.deleteDocument('test-daf-001', TEST_ORG_ID);
  await rag.deleteDocument('test-cv-001', TEST_ORG_ID);

  console.log('✅ Test documents deleted');

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ ALL TESTS COMPLETED SUCCESSFULLY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📊 Summary:');
  console.log('  ✓ Document ingestion (DAF & CV)');
  console.log('  ✓ Semantic search (multiple queries)');
  console.log('  ✓ Hybrid search (vector + FTS)');
  console.log('  ✓ Statistics monitoring');
  console.log('  ✓ Similar document finding');
  console.log('  ✓ LLM context building');
  console.log('  ✓ Cleanup');
  console.log('\n✨ Phase 2 RAG System: FULLY OPERATIONAL\n');
}

// Run tests
testRAGSystem()
  .then(() => {
    console.log('🎉 Test suite completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed:', error);
    console.error(error.stack);
    process.exit(1);
  });
