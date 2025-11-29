"""
Unit Tests for Shark Project Extractor - Phase 2.1

Tests:
1. Pydantic model validation
2. BTP article extraction (synthetic)
3. Non-BTP article filtering
4. Date Anchor conversion
5. Taxonomy validation
6. Error handling
"""

import os
import sys
import pytest
import asyncio
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()


# ============================================================
# SYNTHETIC TEST ARTICLES
# ============================================================

ARTICLE_BTP_RENOVATION = """
Toulouse : La mairie lance un vaste projet de rénovation de 200 logements sociaux

La ville de Toulouse a annoncé ce mardi le lancement d'un ambitieux programme de réhabilitation
énergétique portant sur 200 logements sociaux dans le quartier des Izards.

Le projet, estimé à 15 millions d'euros, prévoit l'isolation thermique par l'extérieur,
le remplacement des menuiseries et la modernisation des systèmes de chauffage.
Les travaux devraient démarrer au premier trimestre 2025 pour une livraison prévue fin 2026.

Toulouse Métropole Habitat, maître d'ouvrage du projet, a confié la maîtrise d'œuvre
au cabinet d'architecture Cardete Huet. L'appel d'offres pour les entreprises de
travaux sera lancé en janvier prochain.

"Ce projet s'inscrit dans notre plan climat et permettra de réduire de 40%
les consommations énergétiques de ces bâtiments", a déclaré le maire de Toulouse.
"""

ARTICLE_BTP_METRO = """
Extension de la ligne 3 du métro de Toulouse : 2,4 milliards d'euros

Tisséo Collectivités a officiellement lancé le projet d'extension de la ligne 3 du métro
vers le nord de l'agglomération toulousaine. Ce projet d'infrastructure majeur représente
un investissement de 2,4 milliards d'euros.

La nouvelle ligne desservira 15 stations sur 27 kilomètres, reliant Colomiers à Labège.
Les travaux de génie civil débuteront au printemps prochain, avec une mise en service
prévue pour 2030.

Tisséo Collectivités assure la maîtrise d'ouvrage. Le groupement Egis Rail / Systra
a été désigné comme maître d'œuvre. Plusieurs lots de génie civil seront attribués
dans les prochains mois, avec Eiffage et Vinci comme principaux candidats.

Ce métro automatique sera le plus long de France en dehors de Paris.
"""

ARTICLE_NON_BTP = """
Les nouveaux restaurants à découvrir à Paris ce week-end

La capitale regorge de nouvelles adresses gourmandes. Voici notre sélection
des meilleurs restaurants ouverts récemment.

1. Chez Marcel - Un bistrot traditionnel revisité
2. Le Jardin Secret - Cuisine végétarienne créative
3. Tokyo Ramen - Les meilleurs ramen de Paris

Réservez dès maintenant pour profiter de ces nouvelles tables.
Les prix varient de 25 à 80 euros par personne.
"""

ARTICLE_SMALL_PROJECT = """
Rénovation de la façade de l'école élémentaire Jean Jaurès à Lyon

La mairie du 3ème arrondissement de Lyon a voté un budget de 450 000 euros
pour la rénovation de la façade de l'école Jean Jaurès.

Les travaux, qui débuteront en juillet prochain pendant les vacances scolaires,
comprennent le ravalement complet et la mise aux normes thermiques.

L'entreprise locale Façades du Rhône a remporté le marché.
La livraison est prévue pour la rentrée de septembre.
"""


# ============================================================
# TEST: PYDANTIC MODELS
# ============================================================

class TestPydanticModels:
    """Tests for Pydantic model validation."""

    def test_project_payload_defaults(self):
        """Test ProjectPayload with default values."""
        from services.shark_project_extractor import ProjectPayload

        project = ProjectPayload()
        assert project.name == ""
        assert project.country == "France"
        assert project.budget_currency == "EUR"
        assert project.sector_tags == []
        print("\n✓ ProjectPayload defaults OK")

    def test_project_payload_with_data(self):
        """Test ProjectPayload with actual data."""
        from services.shark_project_extractor import ProjectPayload

        project = ProjectPayload(
            name="Rénovation école",
            type="renovation",
            location_city="Lyon",
            budget_amount=450000,
            estimated_scale="Small"
        )
        assert project.name == "Rénovation école"
        assert project.estimated_scale == "Small"
        print("\n✓ ProjectPayload with data OK")

    def test_organization_payload_taxonomy(self):
        """Test OrganizationPayload taxonomy validation."""
        from services.shark_project_extractor import OrganizationPayload

        # Valid org_type
        org = OrganizationPayload(
            name="Tisséo",
            org_type="Operator",
            role_in_project="MOA"
        )
        assert org.org_type == "Operator"
        assert org.role_in_project == "MOA"

        # Invalid org_type should default to Other
        org2 = OrganizationPayload(
            name="Unknown Corp",
            org_type="invalid_type",
            role_in_project="unknown"
        )
        assert org2.org_type == "Other"
        assert org2.role_in_project == "Other"

        print("\n✓ OrganizationPayload taxonomy OK")

    def test_news_payload_role_validation(self):
        """Test NewsPayload role validation."""
        from services.shark_project_extractor import NewsPayload

        news = NewsPayload(
            title="Article test",
            role_of_news="annonce_projet"
        )
        assert news.role_of_news == "annonce_projet"

        # Invalid role should default to "autre"
        news2 = NewsPayload(
            title="Article test",
            role_of_news="invalid_role"
        )
        assert news2.role_of_news == "autre"

        print("\n✓ NewsPayload role validation OK")

    def test_extraction_result_structure(self):
        """Test ProjectExtractionResult structure."""
        from services.shark_project_extractor import (
            ProjectExtractionResult,
            ProjectPayload,
            OrganizationPayload,
            NewsPayload
        )

        result = ProjectExtractionResult(
            project=ProjectPayload(name="Test Project"),
            organizations=[
                OrganizationPayload(name="Org 1", org_type="MOA", role_in_project="MOA")
            ],
            news=NewsPayload(title="Test Article")
        )

        assert result.project.name == "Test Project"
        assert len(result.organizations) == 1
        assert result.news.title == "Test Article"

        print("\n✓ ProjectExtractionResult structure OK")


# ============================================================
# TEST: HELPER FUNCTIONS
# ============================================================

class TestHelperFunctions:
    """Tests for helper functions."""

    def test_is_valid_btp_project_true(self):
        """Test is_valid_btp_project with valid project."""
        from services.shark_project_extractor import (
            is_valid_btp_project,
            ProjectExtractionResult,
            ProjectPayload,
            NewsPayload
        )

        result = ProjectExtractionResult(
            project=ProjectPayload(name="Metro Toulouse", phase="detection"),
            organizations=[],
            news=NewsPayload()
        )

        assert is_valid_btp_project(result) is True
        print("\n✓ is_valid_btp_project (true case) OK")

    def test_is_valid_btp_project_false(self):
        """Test is_valid_btp_project with empty project (non-BTP)."""
        from services.shark_project_extractor import (
            is_valid_btp_project,
            ProjectExtractionResult,
            ProjectPayload,
            NewsPayload
        )

        result = ProjectExtractionResult(
            project=ProjectPayload(name="", phase=""),
            organizations=[],
            news=NewsPayload()
        )

        assert is_valid_btp_project(result) is False
        print("\n✓ is_valid_btp_project (false case) OK")


# ============================================================
# TEST: ERROR HANDLING
# ============================================================

class TestErrorHandling:
    """Tests for error handling."""

    @pytest.mark.asyncio
    async def test_empty_article_raises_error(self):
        """Test that empty article raises ProjectExtractionError."""
        from services.shark_project_extractor import (
            extract_project_from_article,
            ProjectExtractionError
        )

        with pytest.raises(ProjectExtractionError) as exc_info:
            await extract_project_from_article(
                article_text="",
                source_name="Test",
                source_url="https://test.com",
                published_at_input=datetime.now()
            )

        assert "empty" in str(exc_info.value).lower()
        print("\n✓ Empty article error handling OK")


# ============================================================
# TEST: LLM EXTRACTION (requires OpenAI API key)
# ============================================================

class TestLLMExtraction:
    """Tests for LLM-based extraction (require OPENAI_API_KEY)."""

    @pytest.mark.asyncio
    async def test_extract_renovation_project(self):
        """Test extraction from a renovation article."""
        from services.shark_project_extractor import (
            extract_project_from_article,
            is_valid_btp_project
        )

        result = await extract_project_from_article(
            article_text=ARTICLE_BTP_RENOVATION,
            source_name="Le Moniteur",
            source_url="https://lemoniteur.fr/test/renovation",
            published_at_input=datetime(2024, 11, 29)
        )

        # Should be a valid BTP project
        assert is_valid_btp_project(result), "Should detect a valid BTP project"

        # Check project fields
        project = result.project
        assert project.name, "Project name should not be empty"
        assert project.location_city, "Should detect Toulouse"
        assert project.budget_amount, "Should detect budget (15M)"
        assert project.estimated_scale in ["Medium", "Large"], f"Scale should be Medium or Large, got {project.estimated_scale}"

        # Check organizations
        assert len(result.organizations) > 0, "Should extract organizations"

        # Check for MOA (Toulouse Métropole Habitat)
        moa_found = any(
            org.role_in_project == "MOA" or "toulouse" in org.name.lower()
            for org in result.organizations
        )
        assert moa_found, "Should find MOA organization"

        print(f"\n✓ Extracted project: {project.name}")
        print(f"  Type: {project.type}")
        print(f"  Location: {project.location_city}")
        print(f"  Budget: {project.budget_amount} EUR")
        print(f"  Scale: {project.estimated_scale}")
        print(f"  Organizations: {len(result.organizations)}")
        for org in result.organizations:
            print(f"    - {org.name} ({org.role_in_project})")

    @pytest.mark.asyncio
    async def test_extract_mega_project(self):
        """Test extraction from a mega infrastructure project."""
        from services.shark_project_extractor import (
            extract_project_from_article,
            is_valid_btp_project
        )

        result = await extract_project_from_article(
            article_text=ARTICLE_BTP_METRO,
            source_name="Le Moniteur",
            source_url="https://lemoniteur.fr/test/metro",
            published_at_input=datetime(2024, 11, 29)
        )

        assert is_valid_btp_project(result)

        project = result.project
        assert project.estimated_scale == "Mega", f"Metro should be Mega scale, got {project.estimated_scale}"
        assert project.budget_amount and project.budget_amount > 1_000_000_000, "Budget should be > 1B"

        print(f"\n✓ Mega project: {project.name}")
        print(f"  Budget: {project.budget_amount:,.0f} EUR")
        print(f"  Scale: {project.estimated_scale}")

    @pytest.mark.asyncio
    async def test_non_btp_article_filtered(self):
        """Test that non-BTP articles return empty project."""
        from services.shark_project_extractor import (
            extract_project_from_article,
            is_valid_btp_project
        )

        result = await extract_project_from_article(
            article_text=ARTICLE_NON_BTP,
            source_name="Le Figaro",
            source_url="https://lefigaro.fr/test/restaurants",
            published_at_input=datetime(2024, 11, 29)
        )

        # Should NOT be a valid BTP project
        assert not is_valid_btp_project(result), "Restaurant article should not be BTP"
        assert result.project.name == "", "Project name should be empty"
        assert len(result.organizations) == 0, "Should have no organizations"

        print("\n✓ Non-BTP article correctly filtered")

    @pytest.mark.asyncio
    async def test_small_project_scale(self):
        """Test that small projects get correct scale."""
        from services.shark_project_extractor import (
            extract_project_from_article,
            is_valid_btp_project
        )

        result = await extract_project_from_article(
            article_text=ARTICLE_SMALL_PROJECT,
            source_name="Lyon Mag",
            source_url="https://lyonmag.fr/test/ecole",
            published_at_input=datetime(2024, 11, 29)
        )

        assert is_valid_btp_project(result)

        project = result.project
        assert project.estimated_scale == "Small", f"450k€ school renovation should be Small, got {project.estimated_scale}"

        print(f"\n✓ Small project: {project.name}")
        print(f"  Budget: {project.budget_amount:,.0f} EUR")
        print(f"  Scale: {project.estimated_scale}")

    @pytest.mark.asyncio
    async def test_date_anchor_conversion(self):
        """Test that relative dates are converted using Date Anchor."""
        from services.shark_project_extractor import extract_project_from_article

        # Article mentions "au printemps prochain" with pub date 2024-11-29
        result = await extract_project_from_article(
            article_text=ARTICLE_BTP_METRO,  # mentions "printemps prochain"
            source_name="Test",
            source_url="https://test.com",
            published_at_input=datetime(2024, 11, 29)
        )

        project = result.project

        # start_date_est should be in 2025 (spring next year)
        if project.start_date_est:
            assert "2025" in project.start_date_est, f"Start date should be 2025, got {project.start_date_est}"
            print(f"\n✓ Date Anchor: start_date_est = {project.start_date_est}")

        # end_date_est should be 2030 (mentioned in article)
        if project.end_date_est:
            assert "2030" in project.end_date_est, f"End date should be 2030, got {project.end_date_est}"
            print(f"✓ Date Anchor: end_date_est = {project.end_date_est}")


# ============================================================
# MAIN TEST RUNNER
# ============================================================

if __name__ == "__main__":
    print("=" * 60)
    print("Shark Project Extractor - Unit Tests")
    print("=" * 60)

    # Run synchronous tests first (no API needed)
    print("\n--- Pydantic Model Tests ---")
    model_tests = TestPydanticModels()
    model_tests.test_project_payload_defaults()
    model_tests.test_project_payload_with_data()
    model_tests.test_organization_payload_taxonomy()
    model_tests.test_news_payload_role_validation()
    model_tests.test_extraction_result_structure()

    print("\n--- Helper Function Tests ---")
    helper_tests = TestHelperFunctions()
    helper_tests.test_is_valid_btp_project_true()
    helper_tests.test_is_valid_btp_project_false()

    # Check for OpenAI API key
    if not os.getenv("OPENAI_API_KEY"):
        print("\n" + "=" * 60)
        print("OPENAI_API_KEY not set - LLM tests skipped")
        print("Set it with: export OPENAI_API_KEY=your_key")
        print("=" * 60)
        sys.exit(0)

    # Run async LLM tests
    print("\n--- LLM Extraction Tests ---")

    async def run_llm_tests():
        llm_tests = TestLLMExtraction()

        print("\nTest 1: Renovation project extraction")
        await llm_tests.test_extract_renovation_project()

        print("\nTest 2: Mega project extraction")
        await llm_tests.test_extract_mega_project()

        print("\nTest 3: Non-BTP filtering")
        await llm_tests.test_non_btp_article_filtered()

        print("\nTest 4: Small project scale")
        await llm_tests.test_small_project_scale()

        print("\nTest 5: Date Anchor conversion")
        await llm_tests.test_date_anchor_conversion()

    asyncio.run(run_llm_tests())

    print("\n" + "=" * 60)
    print("All tests passed!")
    print("=" * 60)
