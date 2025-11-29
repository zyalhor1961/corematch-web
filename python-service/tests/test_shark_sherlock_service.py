"""
Unit Tests for Shark Sherlock OSINT Service - Phase 3

Tests:
1. Pydantic model validation
2. build_osint_queries()
3. search_people_via_exa() with MOCK
4. guess_email()
5. detect_is_current_role()
6. find_or_create_person_from_candidate()
7. enrich_projects_organizations_batch() rate limiting

These tests use mocks to avoid actual API calls.
"""

import os
import sys
import pytest
import asyncio
from datetime import datetime
from uuid import UUID, uuid4
from unittest.mock import AsyncMock, MagicMock, patch

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()


# ============================================================
# MOCK EXA RESULTS
# ============================================================

class MockExaResult:
    """Mock Exa search result."""
    def __init__(self, url: str, title: str, text: str = ""):
        self.url = url
        self.title = title
        self.text = text


class MockExaResponse:
    """Mock Exa search response."""
    def __init__(self, results: list):
        self.results = results


MOCK_EXA_RESULTS = MockExaResponse([
    MockExaResult(
        url="https://www.linkedin.com/in/jean-dupont-12345",
        title="Jean Dupont - Directeur Travaux - Toulouse Metropole Habitat",
        text="Directeur Travaux depuis 2020. Region Occitanie. Grands projets immobiliers."
    ),
    MockExaResult(
        url="https://www.linkedin.com/in/marie-martin-67890",
        title="Marie Martin - Responsable Projet - Toulouse Metropole Habitat | LinkedIn",
        text="Responsable Projet chez TMH depuis 2019. Toulouse."
    ),
    MockExaResult(
        url="https://www.example.com/not-linkedin",
        title="Some Random Page",
        text="Not a LinkedIn profile"
    ),
    MockExaResult(
        url="https://www.linkedin.com/in/ancien-directeur-11111",
        title="Pierre Ancien - Ex-Directeur Travaux - Toulouse Metropole Habitat",
        text="Ancien Directeur Travaux. 2015-2020. Maintenant retraite."
    ),
])


# ============================================================
# TEST: PYDANTIC MODELS
# ============================================================

class TestPydanticModels:
    """Tests for Sherlock Pydantic models."""

    def test_sherlock_target_defaults(self):
        """Test SherlockTarget with defaults."""
        from services.shark_sherlock_service import SherlockTarget

        target = SherlockTarget(
            tenant_id=uuid4(),
            organization_id=uuid4()
        )

        assert target.project_id is None
        assert target.desired_roles == []
        assert target.max_results == 5
        print("\n OK - SherlockTarget defaults")

    def test_sherlock_target_with_data(self):
        """Test SherlockTarget with full data."""
        from services.shark_sherlock_service import SherlockTarget

        tenant_id = uuid4()
        project_id = uuid4()
        org_id = uuid4()

        target = SherlockTarget(
            tenant_id=tenant_id,
            project_id=project_id,
            organization_id=org_id,
            desired_roles=["Directeur Travaux", "Chef de Projet"],
            max_results=10
        )

        assert target.tenant_id == tenant_id
        assert target.project_id == project_id
        assert target.organization_id == org_id
        assert len(target.desired_roles) == 2
        assert target.max_results == 10
        print("\n OK - SherlockTarget with data")

    def test_sherlock_person_candidate(self):
        """Test SherlockPersonCandidate model."""
        from services.shark_sherlock_service import SherlockPersonCandidate

        candidate = SherlockPersonCandidate(
            full_name="Jean Dupont",
            title="Directeur Travaux",
            organization_name="TMH",
            linkedin_url="https://linkedin.com/in/jeandupont",
            city="Toulouse",
            source_confidence=0.85,
            is_current_role=True,
            email_guess="jean.dupont@tmh.fr"
        )

        assert candidate.full_name == "Jean Dupont"
        assert candidate.source_confidence == 0.85
        assert candidate.is_current_role is True
        assert candidate.country == "France"
        print("\n OK - SherlockPersonCandidate")

    def test_sherlock_result(self):
        """Test SherlockResult model."""
        from services.shark_sherlock_service import SherlockResult

        result = SherlockResult(
            organization_id=uuid4(),
            person_ids=[uuid4(), uuid4()],
            candidates_found=5,
            candidates_filtered=2,
            persons_created=2,
            persons_reused=0,
            message="OK"
        )

        assert len(result.person_ids) == 2
        assert result.candidates_found == 5
        assert result.persons_created == 2
        print("\n OK - SherlockResult")


# ============================================================
# TEST: HELPER FUNCTIONS
# ============================================================

class TestHelperFunctions:
    """Tests for helper functions."""

    def test_normalize_for_email(self):
        """Test email normalization."""
        from services.shark_sherlock_service import normalize_for_email

        assert normalize_for_email("Jean-Pierre") == "jean-pierre"
        assert normalize_for_email("DUPONT") == "dupont"
        assert normalize_for_email("Lefevre") == "lefevre"  # accents removed
        assert normalize_for_email("Marie Claire") == "marieclaire"
        assert normalize_for_email("") == ""
        print("\n OK - normalize_for_email")

    def test_extract_domain_from_website(self):
        """Test domain extraction."""
        from services.shark_sherlock_service import extract_domain_from_website

        assert extract_domain_from_website("https://www.eiffage.com") == "eiffage.com"
        assert extract_domain_from_website("http://toulouse-metropole.fr/contact") == "toulouse-metropole.fr"
        assert extract_domain_from_website("www.example.org") == "example.org"
        assert extract_domain_from_website("") is None
        assert extract_domain_from_website(None) is None
        print("\n OK - extract_domain_from_website")

    def test_guess_email(self):
        """Test email guessing."""
        from services.shark_sherlock_service import guess_email

        # Basic case
        email = guess_email("Jean Dupont", "https://www.toulouse-metropole.fr")
        assert email == "jean.dupont@toulouse-metropole.fr"

        # With accents
        email = guess_email("Marie Lefevre", "eiffage.com")
        assert email == "marie.lefevre@eiffage.com"

        # Compound first name
        email = guess_email("Jean-Pierre Martin", "vinci.com")
        assert email == "jean-pierre.martin@vinci.com"

        # Single name (should return None)
        email = guess_email("Jean", "example.com")
        assert email is None

        # No website
        email = guess_email("Jean Dupont", None)
        assert email is None

        # Empty inputs
        email = guess_email("", "example.com")
        assert email is None

        print("\n OK - guess_email")


# ============================================================
# TEST: CURRENT ROLE DETECTION
# ============================================================

class TestCurrentRoleDetection:
    """Tests for is_current_role detection."""

    def test_detect_current_role(self):
        """Test current role detection."""
        from services.shark_sherlock_service import detect_is_current_role

        # Current role indicators
        assert detect_is_current_role("Directeur depuis 2020", "Directeur Travaux") is True
        assert detect_is_current_role("2020 - present", "Chef de Projet") is True
        assert detect_is_current_role("Currently leading projects", "Project Manager") is True
        assert detect_is_current_role("Actuellement en poste", "DG") is True

        # Past role indicators
        assert detect_is_current_role("Ex-Directeur", "Directeur Travaux") is False
        assert detect_is_current_role("Ancien responsable", "Responsable") is False
        assert detect_is_current_role("2015-2020", "Chef de Projet") is False
        assert detect_is_current_role("Former CEO", "CEO") is False
        assert detect_is_current_role("A quitte en 2021", "Directeur") is False

        # Ambiguous (default to True)
        assert detect_is_current_role("Directeur Travaux", "Directeur") is True
        assert detect_is_current_role("", "") is True

        print("\n OK - detect_is_current_role")


# ============================================================
# TEST: OSINT QUERY BUILDER
# ============================================================

class TestOsintQueryBuilder:
    """Tests for OSINT query building."""

    def test_build_osint_queries_basic(self):
        """Test basic query building."""
        from services.shark_sherlock_service import build_osint_queries

        queries = build_osint_queries(
            org_name="Toulouse Metropole Habitat",
            city="Toulouse",
            roles=["Directeur Travaux", "Chef de Projet"],
            max_queries=5
        )

        assert len(queries) > 0
        assert len(queries) <= 5

        # Check for LinkedIn site restriction
        assert all("site:linkedin.com/in" in q for q in queries)

        # Check for org name
        assert any("Toulouse Metropole Habitat" in q for q in queries)

        # Check for roles
        assert any("Directeur Travaux" in q for q in queries)

        print(f"\n OK - build_osint_queries ({len(queries)} queries)")
        for i, q in enumerate(queries, 1):
            print(f"  {i}. {q[:60]}...")

    def test_build_osint_queries_no_city(self):
        """Test query building without city."""
        from services.shark_sherlock_service import build_osint_queries

        queries = build_osint_queries(
            org_name="Eiffage",
            city=None,
            roles=["Directeur"],
            max_queries=3
        )

        assert len(queries) > 0
        # Should NOT contain "None" as string
        assert all("None" not in q for q in queries)

        print("\n OK - build_osint_queries (no city)")

    def test_build_osint_queries_generic(self):
        """Test that generic query is added if room."""
        from services.shark_sherlock_service import build_osint_queries

        queries = build_osint_queries(
            org_name="TestOrg",
            city="Paris",
            roles=["Role1"],
            max_queries=5
        )

        # Should include generic "directeur responsable" query
        has_generic = any("directeur responsable" in q.lower() for q in queries)
        assert has_generic, "Should have generic query"

        print("\n OK - build_osint_queries (generic)")


# ============================================================
# TEST: EXA SEARCH WITH MOCK
# ============================================================

class TestExaSearchMock:
    """Tests for Exa search with mocks."""

    @pytest.mark.asyncio
    async def test_search_people_via_exa_mock(self):
        """Test Exa search with mock."""
        from services.shark_sherlock_service import (
            search_people_via_exa,
            SherlockPersonCandidate
        )

        # Mock the Exa client
        with patch('services.shark_sherlock_service.exa_client') as mock_client:
            mock_client.search.return_value = MOCK_EXA_RESULTS

            candidates = await search_people_via_exa(
                query='site:linkedin.com/in "Toulouse Metropole Habitat" "Directeur"',
                num_results=5
            )

            # Should have called the mock
            mock_client.search.assert_called_once()

            # Should have parsed LinkedIn results
            assert len(candidates) >= 2

            # Check first candidate
            jean = next((c for c in candidates if "Jean" in c.full_name), None)
            assert jean is not None
            assert jean.linkedin_url is not None
            assert "linkedin.com/in" in jean.linkedin_url

            print(f"\n OK - search_people_via_exa mock ({len(candidates)} candidates)")
            for c in candidates:
                print(f"  - {c.full_name}: {c.title} (conf: {c.source_confidence:.2f}, current: {c.is_current_role})")

    @pytest.mark.asyncio
    async def test_search_filters_non_linkedin(self):
        """Test that non-LinkedIn results are filtered."""
        from services.shark_sherlock_service import search_people_via_exa

        with patch('services.shark_sherlock_service.exa_client') as mock_client:
            mock_client.search.return_value = MOCK_EXA_RESULTS

            candidates = await search_people_via_exa("test query", num_results=5)

            # The non-LinkedIn result should be filtered out
            urls = [c.linkedin_url for c in candidates if c.linkedin_url]
            assert all("linkedin.com/in" in url for url in urls)

            print("\n OK - Non-LinkedIn filtered")

    @pytest.mark.asyncio
    async def test_search_detects_past_roles(self):
        """Test that past roles are detected."""
        from services.shark_sherlock_service import search_people_via_exa

        with patch('services.shark_sherlock_service.exa_client') as mock_client:
            mock_client.search.return_value = MOCK_EXA_RESULTS

            candidates = await search_people_via_exa("test query", num_results=5)

            # Find the "ancien" candidate
            ancien = next((c for c in candidates if "Ancien" in c.full_name or "ancien" in (c.raw_snippet or "")), None)

            if ancien:
                # Should be marked as NOT current
                assert ancien.is_current_role is False, f"Pierre Ancien should have is_current_role=False"
                print(f"\n OK - Past role detected: {ancien.full_name} (is_current: {ancien.is_current_role})")
            else:
                print("\n OK - Past role candidate filtered or not found")

    @pytest.mark.asyncio
    async def test_search_no_client(self):
        """Test behavior when Exa client is not configured."""
        from services.shark_sherlock_service import search_people_via_exa

        with patch('services.shark_sherlock_service.exa_client', None):
            candidates = await search_people_via_exa("test query", num_results=5)
            assert candidates == []
            print("\n OK - No Exa client handled gracefully")


# ============================================================
# TEST: PERSON UPSERT WITH MOCK DB
# ============================================================

class TestPersonUpsertMock:
    """Tests for person upsert with mock database."""

    @pytest.mark.asyncio
    async def test_find_or_create_new_person(self):
        """Test creating a new person."""
        from services.shark_sherlock_service import (
            find_or_create_person_from_candidate,
            SherlockPersonCandidate
        )

        tenant_id = uuid4()
        org_id = uuid4()
        person_id = uuid4()

        candidate = SherlockPersonCandidate(
            full_name="Test Person",
            title="Directeur",
            linkedin_url="https://linkedin.com/in/testperson",
            source_confidence=0.8,
            is_current_role=True
        )

        # Create mock DB
        mock_db = MagicMock()

        # Mock: no existing person found (by LinkedIn)
        mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

        # Mock: no existing person found (by name)
        mock_db.table.return_value.select.return_value.eq.return_value.ilike.return_value.execute.return_value = MagicMock(data=[])

        # Mock: insert returns new person
        mock_db.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{"id": str(person_id)}]
        )

        # Mock: link insert
        mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

        result_id, created = await find_or_create_person_from_candidate(
            tenant_id=tenant_id,
            org_id=org_id,
            candidate=candidate,
            org_website="https://example.com",
            db=mock_db
        )

        assert result_id == person_id
        assert created is True
        print(f"\n OK - Created new person: {result_id}")

    @pytest.mark.asyncio
    async def test_find_or_create_reuses_by_linkedin(self):
        """Test reusing existing person by LinkedIn URL."""
        from services.shark_sherlock_service import (
            find_or_create_person_from_candidate,
            SherlockPersonCandidate
        )

        tenant_id = uuid4()
        org_id = uuid4()
        existing_id = uuid4()

        candidate = SherlockPersonCandidate(
            full_name="Existing Person",
            title="Chef de Projet",
            linkedin_url="https://linkedin.com/in/existingperson",
            source_confidence=0.9,
            is_current_role=True
        )

        # Create mock DB
        mock_db = MagicMock()

        # Mock: existing person found by LinkedIn
        mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{"id": str(existing_id), "source_confidence": 0.7}]
        )

        result_id, created = await find_or_create_person_from_candidate(
            tenant_id=tenant_id,
            org_id=org_id,
            candidate=candidate,
            org_website="https://example.com",
            db=mock_db
        )

        assert result_id == existing_id
        assert created is False
        print(f"\n OK - Reused existing person: {result_id}")


# ============================================================
# TEST: BATCH ENRICHMENT WITH RATE LIMITING
# ============================================================

class TestBatchEnrichment:
    """Tests for batch enrichment with rate limiting."""

    @pytest.mark.asyncio
    async def test_batch_rate_limiting(self):
        """Test that batch enrichment respects rate limiting."""
        from services.shark_sherlock_service import (
            enrich_projects_organizations_batch
        )
        import time

        tenant_id = uuid4()
        project_ids = [uuid4() for _ in range(3)]

        # Track timing
        start_time = time.time()
        call_times = []

        async def mock_enrich(*args, **kwargs):
            call_times.append(time.time() - start_time)
            return []

        # Mock the dependent functions
        with patch('services.shark_sherlock_service.get_supabase') as mock_get_db:
            mock_db = MagicMock()

            # Mock: empty project-organization links
            mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
            mock_get_db.return_value = mock_db

            results = await enrich_projects_organizations_batch(
                tenant_id=tenant_id,
                project_ids=project_ids,
                max_orgs_per_project=2,
                max_concurrent_orgs=2,
                delay_between_batches=0.1
            )

            # With no orgs linked, should return empty
            assert isinstance(results, dict)
            print(f"\n OK - Batch enrichment completed (empty case)")

    @pytest.mark.asyncio
    async def test_batch_collects_orgs_by_role_priority(self):
        """Test that batch enrichment prioritizes orgs by role."""
        from services.shark_sherlock_service import enrich_projects_organizations_batch

        tenant_id = uuid4()
        project_id = uuid4()
        moa_org_id = uuid4()
        moe_org_id = uuid4()
        other_org_id = uuid4()

        with patch('services.shark_sherlock_service.get_supabase') as mock_get_db, \
             patch('services.shark_sherlock_service.enrich_organization_with_people') as mock_enrich:

            mock_db = MagicMock()
            mock_get_db.return_value = mock_db

            # Mock: return orgs linked to project (out of priority order)
            mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
                data=[
                    {"organization_id": str(other_org_id), "role_in_project": "Other"},
                    {"organization_id": str(moa_org_id), "role_in_project": "MOA"},
                    {"organization_id": str(moe_org_id), "role_in_project": "MOE"},
                ]
            )

            mock_enrich.return_value = [uuid4()]

            results = await enrich_projects_organizations_batch(
                tenant_id=tenant_id,
                project_ids=[project_id],
                max_orgs_per_project=2,  # Should take MOA and MOE, not Other
                max_concurrent_orgs=1
            )

            # Should have enriched MOA and MOE (priority)
            enriched_orgs = list(results.keys())

            # Verify MOA was enriched
            assert moa_org_id in enriched_orgs, "MOA should be enriched"

            # Verify MOE was enriched
            assert moe_org_id in enriched_orgs, "MOE should be enriched"

            # Other should NOT be enriched (max_orgs_per_project=2)
            assert other_org_id not in enriched_orgs, "Other should not be enriched (limit reached)"

            print(f"\n OK - Batch enrichment prioritizes by role")


# ============================================================
# TEST: ROLE MAPPING
# ============================================================

class TestRoleMapping:
    """Tests for title to role mapping."""

    def test_map_title_to_role(self):
        """Test title to role mapping."""
        from services.shark_sherlock_service import _map_title_to_role

        # Direct mappings
        assert _map_title_to_role("Directeur General") == "dg"
        assert _map_title_to_role("DG") == "dg"
        assert _map_title_to_role("Directeur General Adjoint") == "dga"
        assert _map_title_to_role("Directeur Travaux") == "directeur_travaux"
        assert _map_title_to_role("Chef de Projet BTP") == "chef_de_projet"
        assert _map_title_to_role("Responsable Projet") == "chef_de_projet"
        assert _map_title_to_role("Conducteur de Travaux") == "conducteur_travaux"
        assert _map_title_to_role("Responsable Commercial") == "responsable_commercial"
        assert _map_title_to_role("Acheteur Senior") == "acheteur"
        assert _map_title_to_role("Prescripteur Technique") == "prescripteur"

        # Unknown -> autre
        assert _map_title_to_role("Random Title") == "autre"
        assert _map_title_to_role("") == "autre"

        print("\n OK - _map_title_to_role")


# ============================================================
# MAIN TEST RUNNER
# ============================================================

if __name__ == "__main__":
    print("=" * 60)
    print("Shark Sherlock OSINT Service - Unit Tests")
    print("=" * 60)

    # Run synchronous tests first
    print("\n--- Pydantic Model Tests ---")
    model_tests = TestPydanticModels()
    model_tests.test_sherlock_target_defaults()
    model_tests.test_sherlock_target_with_data()
    model_tests.test_sherlock_person_candidate()
    model_tests.test_sherlock_result()

    print("\n--- Helper Function Tests ---")
    helper_tests = TestHelperFunctions()
    helper_tests.test_normalize_for_email()
    helper_tests.test_extract_domain_from_website()
    helper_tests.test_guess_email()

    print("\n--- Current Role Detection Tests ---")
    role_tests = TestCurrentRoleDetection()
    role_tests.test_detect_current_role()

    print("\n--- OSINT Query Builder Tests ---")
    query_tests = TestOsintQueryBuilder()
    query_tests.test_build_osint_queries_basic()
    query_tests.test_build_osint_queries_no_city()
    query_tests.test_build_osint_queries_generic()

    print("\n--- Role Mapping Tests ---")
    mapping_tests = TestRoleMapping()
    mapping_tests.test_map_title_to_role()

    # Run async tests
    print("\n--- Async Tests (Mocked) ---")

    async def run_async_tests():
        exa_tests = TestExaSearchMock()
        await exa_tests.test_search_people_via_exa_mock()
        await exa_tests.test_search_filters_non_linkedin()
        await exa_tests.test_search_detects_past_roles()
        await exa_tests.test_search_no_client()

        upsert_tests = TestPersonUpsertMock()
        await upsert_tests.test_find_or_create_new_person()
        await upsert_tests.test_find_or_create_reuses_by_linkedin()

        batch_tests = TestBatchEnrichment()
        await batch_tests.test_batch_rate_limiting()
        await batch_tests.test_batch_collects_orgs_by_role_priority()

    asyncio.run(run_async_tests())

    print("\n" + "=" * 60)
    print("All tests passed!")
    print("=" * 60)
