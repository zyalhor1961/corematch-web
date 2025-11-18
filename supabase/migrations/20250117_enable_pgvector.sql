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
