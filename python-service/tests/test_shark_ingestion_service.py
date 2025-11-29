"""
Integration Tests for Shark Ingestion Service - Phase 2.2

Tests:
1. test_ingest_btp_article_creates_project_and_news
2. test_ingest_same_project_twice_reuses_project
3. test_ingest_non_btp_article

These tests require:
- OPENAI_API_KEY (for LLM extraction)
- SUPABASE_URL + SUPABASE_SERVICE_KEY (for database operations)
- A valid tenant_id in the organizations table
"""

import os
import sys
import pytest
import asyncio
from datetime import datetime
from uuid import UUID, uuid4

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()


# ============================================================
# TEST ARTICLES
# ============================================================

ARTICLE_BTP_TOULOUSE = """
Toulouse : La mairie lance un vaste projet de rénovation de 200 logements sociaux

La ville de Toulouse a annoncé ce mardi le lancement d'un ambitieux programme de réhabilitation
énergétique portant sur 200 logements sociaux dans le quartier des Izards.

Le projet, estimé à 15 millions d'euros, prévoit l'isolation thermique par l'extérieur,
le remplacement des menuiseries et la modernisation des systèmes de chauffage.
Les travaux devraient démarrer au premier trimestre 2025 pour une livraison prévue fin 2026.

Toulouse Métropole Habitat, maître d'ouvrage du projet, a confié la maîtrise d'œuvre
au cabinet d'architecture Cardete Huet. L'appel d'offres pour les entreprises de
travaux sera lancé en janvier prochain.
"""

ARTICLE_BTP_TOULOUSE_VARIANT = """
Quartier des Izards : avancement du projet de réhabilitation

Le chantier de rénovation des 200 logements sociaux du quartier des Izards à Toulouse
avance selon le calendrier prévu. Les travaux d'isolation ont débuté sur les premiers
bâtiments.

Toulouse Métropole Habitat confirme que le budget de 15M€ est respecté.
L'entreprise Eiffage a remporté le lot principal de gros œuvre.
La livraison reste programmée pour fin 2026.
"""

ARTICLE_NON_BTP = """
Les nouveaux restaurants à découvrir à Paris ce week-end

La capitale regorge de nouvelles adresses gourmandes. Voici notre sélection
des meilleurs restaurants ouverts récemment.

1. Chez Marcel - Un bistrot traditionnel revisité
2. Le Jardin Secret - Cuisine végétarienne créative
3. Tokyo Ramen - Les meilleurs ramen de Paris

Réservez dès maintenant pour profiter de ces nouvelles tables.
"""


# ============================================================
# FIXTURES
# ============================================================

@pytest.fixture
def test_tenant_id():
    """
    Get or create a test tenant ID.

    In real tests, this should be a valid tenant_id from the organizations table.
    For CI/CD, you might want to create a test tenant.
    """
    # Try to get from environment or use a known test tenant
    env_tenant = os.getenv("TEST_TENANT_ID")
    if env_tenant:
        return UUID(env_tenant)

    # Fallback: generate a UUID (won't work without real tenant in DB)
    return uuid4()


@pytest.fixture
def supabase_client():
    """Get Supabase client for cleanup operations."""
    from services.shark_ingestion_service import get_supabase
    return get_supabase()


# ============================================================
# PYDANTIC MODEL TESTS (No API/DB required)
# ============================================================

class TestPydanticModels:
    """Test Pydantic models without API calls."""

    def test_article_ingestion_input(self):
        """Test ArticleIngestionInput model."""
        from services.shark_ingestion_service import ArticleIngestionInput

        input_data = ArticleIngestionInput(
            tenant_id=uuid4(),
            source_url="https://test.com/article",
            source_name="Test Source",
            published_at=datetime.now(),
            full_text="Test article text"
        )

        assert input_data.source_url == "https://test.com/article"
        assert input_data.full_text == "Test article text"
        print("\n✓ ArticleIngestionInput model OK")

    def test_ingestion_result(self):
        """Test IngestionResult model."""
        from services.shark_ingestion_service import IngestionResult

        result = IngestionResult(
            tenant_id=uuid4(),
            project_id=uuid4(),
            news_id=uuid4(),
            organization_ids=[uuid4(), uuid4()],
            created_project=True,
            reused_existing_project=False,
            created_organizations_count=2,
            reused_organizations_count=0,
            message="OK"
        )

        assert result.created_project is True
        assert result.created_organizations_count == 2
        assert len(result.organization_ids) == 2
        print("\n✓ IngestionResult model OK")

    def test_ingestion_result_defaults(self):
        """Test IngestionResult with defaults."""
        from services.shark_ingestion_service import IngestionResult

        result = IngestionResult(tenant_id=uuid4())

        assert result.project_id is None
        assert result.news_id is None
        assert result.organization_ids == []
        assert result.created_project is False
        print("\n✓ IngestionResult defaults OK")


# ============================================================
# HELPER FUNCTION TESTS (No API/DB required)
# ============================================================

class TestHelperFunctions:
    """Test helper functions."""

    def test_normalize_name(self):
        """Test name normalization for deduplication."""
        from services.shark_ingestion_service import normalize_name

        # Basic normalization
        assert normalize_name("PROJET TEST") == "test"  # removes "projet"
        assert "toulouse" in normalize_name("Projet de rénovation Toulouse")

        # Accents
        result = normalize_name("Rénovation énergétique")
        assert "e" in result  # accents removed
        assert "é" not in result

        # Stopwords
        result = normalize_name("Le projet de construction de la mairie")
        assert "le" not in result.split()
        assert "de" not in result.split()

        print("\n✓ normalize_name OK")

    def test_extract_title_from_text(self):
        """Test title extraction from text."""
        from services.shark_ingestion_service import extract_title_from_text

        text = "Premier titre de l'article\n\nContenu de l'article..."
        title = extract_title_from_text(text)

        assert title == "Premier titre de l'article"

        # Empty text
        assert extract_title_from_text("") == "Article sans titre"
        assert extract_title_from_text(None) == "Article sans titre"

        print("\n✓ extract_title_from_text OK")


# ============================================================
# INTEGRATION TESTS (Require API keys and DB)
# ============================================================

class TestIngestionIntegration:
    """
    Integration tests for the full ingestion pipeline.

    Require:
    - OPENAI_API_KEY
    - SUPABASE_URL + SUPABASE_SERVICE_KEY
    - Valid tenant in organizations table
    """

    @pytest.mark.asyncio
    async def test_ingest_btp_article_creates_project_and_news(self, test_tenant_id, supabase_client):
        """
        Test 1: Ingest a BTP article and verify:
        - Project created in shark_projects
        - News created in shark_news_items
        - Link created in shark_project_news
        - Organizations created with links
        """
        from services.shark_ingestion_service import (
            ingest_article_as_project,
            ArticleIngestionInput
        )

        # Unique URL to avoid conflicts
        unique_url = f"https://test.com/toulouse-{uuid4().hex[:8]}"

        input_data = ArticleIngestionInput(
            tenant_id=test_tenant_id,
            source_url=unique_url,
            source_name="Le Moniteur Test",
            published_at=datetime(2024, 11, 29),
            full_text=ARTICLE_BTP_TOULOUSE
        )

        result = await ingest_article_as_project(input_data)

        # Assertions
        assert result.project_id is not None, "Should create a project"
        assert result.news_id is not None, "Should create a news item"
        assert result.created_project is True, "Should be a new project"
        assert len(result.organization_ids) > 0, "Should have organizations"

        print(f"\n✓ Created project: {result.project_id}")
        print(f"  News: {result.news_id}")
        print(f"  Organizations: {len(result.organization_ids)}")
        print(f"  Created orgs: {result.created_organizations_count}")

        # Verify in database
        project = supabase_client.table("shark_projects").select("*").eq(
            "id", str(result.project_id)
        ).execute()

        assert len(project.data) == 1, "Project should exist in DB"
        assert project.data[0]["tenant_id"] == str(test_tenant_id)
        print(f"  Project name: {project.data[0]['name']}")

        # Verify news exists
        news = supabase_client.table("shark_news_items").select("*").eq(
            "id", str(result.news_id)
        ).execute()

        assert len(news.data) == 1, "News should exist in DB"
        print(f"  News title: {news.data[0]['title'][:50]}...")

        # Verify project-news link
        link = supabase_client.table("shark_project_news").select("*").eq(
            "project_id", str(result.project_id)
        ).eq("news_id", str(result.news_id)).execute()

        assert len(link.data) == 1, "Project-news link should exist"
        print("  Project-news link: OK")

        # Cleanup (optional - comment out to inspect data)
        # await self._cleanup_test_data(result, supabase_client)

    @pytest.mark.asyncio
    async def test_ingest_same_project_twice_reuses_project(self, test_tenant_id, supabase_client):
        """
        Test 2: Ingest two articles about the same project.
        Second ingestion should reuse the existing project.
        """
        from services.shark_ingestion_service import (
            ingest_article_as_project,
            ArticleIngestionInput
        )

        # First article
        url1 = f"https://test.com/izards-v1-{uuid4().hex[:8]}"
        input1 = ArticleIngestionInput(
            tenant_id=test_tenant_id,
            source_url=url1,
            source_name="Le Moniteur",
            published_at=datetime(2024, 11, 29),
            full_text=ARTICLE_BTP_TOULOUSE
        )

        result1 = await ingest_article_as_project(input1)
        assert result1.project_id is not None
        assert result1.created_project is True
        print(f"\n✓ First ingestion - created project: {result1.project_id}")

        # Second article (same project, different URL)
        url2 = f"https://test.com/izards-v2-{uuid4().hex[:8]}"
        input2 = ArticleIngestionInput(
            tenant_id=test_tenant_id,
            source_url=url2,
            source_name="Batiactu",
            published_at=datetime(2024, 12, 1),
            full_text=ARTICLE_BTP_TOULOUSE_VARIANT
        )

        result2 = await ingest_article_as_project(input2)

        # Should reuse the same project
        assert result2.project_id is not None
        assert result2.project_id == result1.project_id, "Should reuse same project"
        assert result2.reused_existing_project is True, "Should be marked as reused"
        assert result2.created_project is False

        print(f"✓ Second ingestion - reused project: {result2.project_id}")
        print(f"  Same project: {result1.project_id == result2.project_id}")

        # Verify two news items linked to same project
        links = supabase_client.table("shark_project_news").select("*").eq(
            "project_id", str(result1.project_id)
        ).execute()

        assert len(links.data) >= 2, "Should have at least 2 news linked"
        print(f"  News items linked to project: {len(links.data)}")

    @pytest.mark.asyncio
    async def test_ingest_non_btp_article(self, test_tenant_id, supabase_client):
        """
        Test 3: Ingest a non-BTP article.
        Should NOT create a project, but may create news.
        """
        from services.shark_ingestion_service import (
            ingest_article_as_project,
            ArticleIngestionInput
        )

        unique_url = f"https://test.com/restaurants-{uuid4().hex[:8]}"

        input_data = ArticleIngestionInput(
            tenant_id=test_tenant_id,
            source_url=unique_url,
            source_name="Le Figaro",
            published_at=datetime(2024, 11, 29),
            full_text=ARTICLE_NON_BTP
        )

        result = await ingest_article_as_project(input_data)

        # Assertions
        assert result.project_id is None, "Should NOT create a project"
        assert result.created_project is False
        assert result.reused_existing_project is False
        assert "No valid BTP project" in result.message

        print(f"\n✓ Non-BTP article - no project created")
        print(f"  Message: {result.message}")
        print(f"  News ID: {result.news_id}")

        # News should still be created (optional behavior)
        if result.news_id:
            news = supabase_client.table("shark_news_items").select("title").eq(
                "id", str(result.news_id)
            ).execute()
            print(f"  News created: {news.data[0]['title'][:40]}...")

    async def _cleanup_test_data(self, result, db):
        """Clean up test data (optional helper)."""
        if result.project_id:
            db.table("shark_project_news").delete().eq(
                "project_id", str(result.project_id)
            ).execute()
            db.table("shark_project_organizations").delete().eq(
                "project_id", str(result.project_id)
            ).execute()
            db.table("shark_projects").delete().eq(
                "id", str(result.project_id)
            ).execute()

        if result.news_id:
            db.table("shark_news_items").delete().eq(
                "id", str(result.news_id)
            ).execute()

        for org_id in result.organization_ids:
            db.table("shark_organizations").delete().eq(
                "id", str(org_id)
            ).execute()


# ============================================================
# MAIN TEST RUNNER
# ============================================================

if __name__ == "__main__":
    print("=" * 60)
    print("Shark Ingestion Service - Integration Tests")
    print("=" * 60)

    # Run synchronous tests first
    print("\n--- Pydantic Model Tests ---")
    model_tests = TestPydanticModels()
    model_tests.test_article_ingestion_input()
    model_tests.test_ingestion_result()
    model_tests.test_ingestion_result_defaults()

    print("\n--- Helper Function Tests ---")
    helper_tests = TestHelperFunctions()
    helper_tests.test_normalize_name()
    helper_tests.test_extract_title_from_text()

    # Check for required environment variables
    missing = []
    if not os.getenv("OPENAI_API_KEY"):
        missing.append("OPENAI_API_KEY")
    if not os.getenv("SUPABASE_URL"):
        missing.append("SUPABASE_URL")
    if not os.getenv("SUPABASE_SERVICE_KEY"):
        missing.append("SUPABASE_SERVICE_KEY")

    if missing:
        print("\n" + "=" * 60)
        print(f"Missing env vars for integration tests: {', '.join(missing)}")
        print("Integration tests skipped.")
        print("=" * 60)
        sys.exit(0)

    # Get test tenant ID
    test_tenant = os.getenv("TEST_TENANT_ID")
    if not test_tenant:
        print("\n" + "=" * 60)
        print("TEST_TENANT_ID not set. Integration tests skipped.")
        print("Set it with: export TEST_TENANT_ID=your-org-uuid")
        print("=" * 60)
        sys.exit(0)

    tenant_id = UUID(test_tenant)
    print(f"\nUsing test tenant: {tenant_id}")

    # Run integration tests
    from services.shark_ingestion_service import get_supabase

    async def run_integration_tests():
        db = get_supabase()
        tests = TestIngestionIntegration()

        print("\n--- Integration Test 1: BTP Article ---")
        await tests.test_ingest_btp_article_creates_project_and_news(tenant_id, db)

        print("\n--- Integration Test 2: Same Project Twice ---")
        await tests.test_ingest_same_project_twice_reuses_project(tenant_id, db)

        print("\n--- Integration Test 3: Non-BTP Article ---")
        await tests.test_ingest_non_btp_article(tenant_id, db)

    asyncio.run(run_integration_tests())

    print("\n" + "=" * 60)
    print("All tests passed!")
    print("=" * 60)
