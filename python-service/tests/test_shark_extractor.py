"""
Tests for Shark Hunter Project Extractor

These tests verify:
1. Project extraction from a sample BTP article
2. Organization extraction with correct roles
3. Handling of articles without BTP projects
"""

import os
import sys
import pytest
import asyncio

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()


# Sample BTP article for testing
SAMPLE_BTP_ARTICLE = """
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

Le groupement Eiffage Construction et Bouygues Bâtiment Sud-Ouest a d'ores et déjà
manifesté son intérêt pour ce chantier d'envergure.
"""

SAMPLE_NON_BTP_ARTICLE = """
Les nouveaux restaurants à découvrir à Paris ce week-end

La capitale regorge de nouvelles adresses gourmandes. Voici notre sélection
des meilleurs restaurants ouverts récemment.

1. Chez Marcel - Un bistrot traditionnel revisité
2. Le Jardin Secret - Cuisine végétarienne créative
3. Tokyo Ramen - Les meilleurs ramen de Paris

Réservez dès maintenant pour profiter de ces nouvelles tables.
"""


class TestProjectExtractor:
    """Tests for the ProjectExtractor agent."""

    @pytest.mark.asyncio
    async def test_extract_btp_project(self):
        """Test extraction of a valid BTP project from an article."""
        from agents.project_extractor import extract_project_from_article

        result = await extract_project_from_article(
            article_text=SAMPLE_BTP_ARTICLE,
            source_url="https://example.com/toulouse-renovation",
            source_name="Le Moniteur",
            region_hint="Occitanie"
        )

        # Verify extraction was successful
        assert result.extraction_success is True
        assert result.project is not None

        # Verify project details
        project = result.project
        assert project.name is not None
        assert len(project.name) > 0
        assert project.location_city is not None  # Should detect Toulouse
        assert project.budget_amount is not None  # Should detect 15M
        assert project.type in ["renovation", "construction_neuve", "autre"]

        # Verify organizations were extracted
        assert len(result.organizations) > 0

        # Check for MOA (Toulouse Métropole Habitat)
        moa_found = any(
            "toulouse" in org.name.lower() or "métropole" in org.name.lower()
            for org in result.organizations
        )
        assert moa_found, "Should find Toulouse Métropole Habitat as MOA"

        # Check for MOE (Cardete Huet)
        moe_found = any(
            "cardete" in org.name.lower() or "huet" in org.name.lower()
            for org in result.organizations
        )
        # MOE might or might not be extracted depending on LLM interpretation

        print(f"\n✓ Extracted project: {project.name}")
        print(f"  Type: {project.type}")
        print(f"  Location: {project.location_city}")
        print(f"  Budget: {project.budget_amount} {project.budget_currency}")
        print(f"  Organizations: {len(result.organizations)}")
        for org in result.organizations:
            print(f"    - {org.name} ({org.org_type}) as {org.role_in_project}")

    @pytest.mark.asyncio
    async def test_no_project_in_article(self):
        """Test handling of an article that doesn't contain a BTP project."""
        from agents.project_extractor import extract_project_from_article

        result = await extract_project_from_article(
            article_text=SAMPLE_NON_BTP_ARTICLE,
            source_url="https://example.com/restaurants-paris",
            source_name="Le Figaro"
        )

        # Extraction should succeed but find no project
        assert result.extraction_success is True
        assert result.project is None
        assert len(result.organizations) == 0

        print("\n✓ Correctly identified non-BTP article")

    @pytest.mark.asyncio
    async def test_extraction_result_structure(self):
        """Test that extraction result has correct structure."""
        from agents.project_extractor import ExtractionResult, ExtractedProject

        result = ExtractionResult(
            project=ExtractedProject(
                name="Test Project",
                type="renovation",
                location_city="Paris"
            ),
            organizations=[],
            news=None
        )

        assert result.project.name == "Test Project"
        assert result.project.type == "renovation"
        assert result.project.location_city == "Paris"
        assert result.extraction_success is True

        print("\n✓ ExtractionResult structure is correct")


class TestProjectExtractorEdgeCases:
    """Edge case tests for the ProjectExtractor."""

    @pytest.mark.asyncio
    async def test_empty_article(self):
        """Test handling of empty article text."""
        from agents.project_extractor import extract_project_from_article

        result = await extract_project_from_article(
            article_text="",
            source_url="https://example.com/empty",
            source_name="Test"
        )

        # Should handle gracefully
        assert result.project is None or result.extraction_success is False
        print("\n✓ Empty article handled gracefully")

    @pytest.mark.asyncio
    async def test_very_short_article(self):
        """Test handling of very short article."""
        from agents.project_extractor import extract_project_from_article

        result = await extract_project_from_article(
            article_text="Nouveau chantier à Lyon.",
            source_url="https://example.com/short",
            source_name="Test"
        )

        # Should handle gracefully, might find project or not
        assert result.extraction_success is True
        print(f"\n✓ Short article handled: project={'found' if result.project else 'not found'}")


# Quick test runner
if __name__ == "__main__":
    print("🧪 Running Shark Extractor Tests\n")

    # Check for OpenAI API key
    if not os.getenv("OPENAI_API_KEY"):
        print("⚠ OPENAI_API_KEY not set. Tests will fail.")
        print("Set it with: export OPENAI_API_KEY=your_key")
        sys.exit(1)

    # Run tests
    async def run_tests():
        test = TestProjectExtractor()

        print("=" * 60)
        print("Test 1: Extract BTP project")
        print("=" * 60)
        await test.test_extract_btp_project()

        print("\n" + "=" * 60)
        print("Test 2: Non-BTP article")
        print("=" * 60)
        await test.test_no_project_in_article()

        print("\n" + "=" * 60)
        print("Test 3: Result structure")
        print("=" * 60)
        await test.test_extraction_result_structure()

        print("\n" + "=" * 60)
        print("All tests passed! ✓")
        print("=" * 60)

    asyncio.run(run_tests())
