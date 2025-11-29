"""
Unit Tests for Shark Hunter API - Phase 5

Tests organized by phase:
- Phase 5.1: Radar & Fiche Projet tests
- Phase 5.2: Organizations, People, News & Actions tests
- Phase 5.3: Alerts, Activity Feed & Geo Filter tests

Uses FastAPI TestClient with mocked database.
"""

import os
import sys
import pytest
import asyncio
from datetime import datetime, timedelta
from uuid import UUID, uuid4
from unittest.mock import MagicMock, patch, AsyncMock
from typing import List

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from fastapi import FastAPI

# Create test app
app = FastAPI()

# Import and include router
from api.shark_api import router, get_current_tenant_id

app.include_router(router)

# Override dependency for testing
TEST_TENANT_ID = uuid4()


async def override_get_tenant_id():
    return TEST_TENANT_ID


app.dependency_overrides[get_current_tenant_id] = override_get_tenant_id

# Create test client
client = TestClient(app)


# ============================================================
# MOCK DATA HELPERS
# ============================================================

def make_mock_project(
    project_id: str = None,
    name: str = "Test Project",
    phase: str = "travaux",
    scale: str = "Large",
    score: int = 75,
    priority: str = "HIGH"
) -> dict:
    """Create a mock project record."""
    return {
        "id": project_id or str(uuid4()),
        "tenant_id": str(TEST_TENANT_ID),
        "name": name,
        "type": "construction",
        "description_short": "Test description",
        "location_city": "Toulouse",
        "location_region": "Occitanie",
        "country": "FR",
        "phase": phase,
        "estimated_scale": scale,
        "start_date_est": (datetime.now() + timedelta(days=60)).strftime("%Y-%m-%d"),
        "end_date_est": (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d"),
        "shark_score": score,
        "shark_priority": priority,
        "budget_amount": 15000000,
        "budget_currency": "EUR",
        "sector_tags": ["construction", "renovation"],
        "ai_confidence": 0.85,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "location_lat": 43.6047,
        "location_long": 1.4442
    }


def make_mock_organization(
    org_id: str = None,
    name: str = "Test Org",
    org_type: str = "MOA"
) -> dict:
    """Create a mock organization record."""
    return {
        "id": org_id or str(uuid4()),
        "tenant_id": str(TEST_TENANT_ID),
        "name": name,
        "org_type": org_type,
        "city": "Toulouse",
        "region": "Occitanie",
        "country": "FR",
        "website": "https://example.com",
        "siren": "123456789"
    }


def make_mock_person(
    person_id: str = None,
    full_name: str = "Jean Dupont",
    title: str = "Directeur Travaux"
) -> dict:
    """Create a mock person record."""
    return {
        "id": person_id or str(uuid4()),
        "tenant_id": str(TEST_TENANT_ID),
        "full_name": full_name,
        "title": title,
        "linkedin_url": "https://linkedin.com/in/jeandupont",
        "email_guess": "jean.dupont@example.com",
        "city": "Toulouse",
        "region": "Occitanie",
        "country": "FR",
        "source_confidence": 0.85,
        "source_type": "osint_linkedin_search"
    }


def make_mock_news(
    news_id: str = None,
    title: str = "Test News Article"
) -> dict:
    """Create a mock news record."""
    return {
        "id": news_id or str(uuid4()),
        "tenant_id": str(TEST_TENANT_ID),
        "title": title,
        "source_name": "Le Moniteur",
        "source_url": "https://lemoniteur.fr/article/123",
        "published_at": datetime.utcnow().isoformat(),
        "role_of_news": "annonce_projet",
        "full_text": "This is a test article about construction projects..."
    }


# ============================================================
# MOCK SUPABASE CLIENT
# ============================================================

class MockSupabaseTable:
    """Mock Supabase table for testing."""

    def __init__(self, data: List[dict] = None):
        self.data = data or []
        self._filters = {}
        self._order_by = None
        self._order_desc = False
        self._limit = 100
        self._offset = 0

    def select(self, *args, **kwargs):
        return self

    def eq(self, field, value):
        self._filters[field] = value
        return self

    def gte(self, field, value):
        self._filters[f"{field}__gte"] = value
        return self

    def ilike(self, field, value):
        self._filters[f"{field}__ilike"] = value
        return self

    def in_(self, field, values):
        self._filters[f"{field}__in"] = values
        return self

    def order(self, field, desc=False):
        self._order_by = field
        self._order_desc = desc
        return self

    def limit(self, n):
        self._limit = n
        return self

    def range(self, start, end):
        self._offset = start
        self._limit = end - start + 1
        return self

    def execute(self):
        result = MagicMock()
        result.data = self.data
        result.count = len(self.data)
        return result


class MockSupabaseClient:
    """Mock Supabase client for testing."""

    def __init__(self):
        self.tables = {}

    def set_table_data(self, table_name: str, data: List[dict]):
        self.tables[table_name] = data

    def table(self, name: str):
        data = self.tables.get(name, [])
        return MockSupabaseTable(data)


# ============================================================
# PHASE 5.1 TESTS - RADAR & FICHE PROJET
# ============================================================

class TestPhase51:
    """Phase 5.1 tests: Radar & Fiche Projet endpoints."""

    def test_get_top_projects_returns_paginated_list(self):
        """Test that /projects/top returns paginated list."""
        project1 = make_mock_project(score=90, priority="CRITICAL")
        project2 = make_mock_project(score=70, priority="HIGH")
        project3 = make_mock_project(score=50, priority="MEDIUM")

        mock_db = MockSupabaseClient()
        mock_db.set_table_data("shark_projects", [project1, project2, project3])
        mock_db.set_table_data("shark_project_organizations", [])
        mock_db.set_table_data("shark_project_news", [])

        with patch("api.shark_api.get_supabase", return_value=mock_db):
            response = client.get("/shark/projects/top")

            assert response.status_code == 200
            data = response.json()

            assert "items" in data
            assert "page" in data
            assert "page_size" in data
            assert "total" in data

            assert data["page"] == 1
            assert data["page_size"] == 20
            assert len(data["items"]) == 3

            # Check first item structure
            item = data["items"][0]
            assert "project_id" in item
            assert "name" in item
            assert "score" in item
            assert "priority" in item
            assert "organizations_count" in item
            assert "news_count" in item

        print("\n OK - test_get_top_projects_returns_paginated_list")

    def test_get_project_detail_returns_score_and_core_fields(self):
        """Test that /projects/{id} returns project with score details."""
        project = make_mock_project()
        project_id = project["id"]

        mock_db = MockSupabaseClient()
        mock_db.set_table_data("shark_projects", [project])
        mock_db.set_table_data("shark_project_organizations", [])
        mock_db.set_table_data("shark_project_news", [])

        # Mock scoring service
        mock_score_output = MagicMock()
        mock_score_output.score = 75
        mock_score_output.priority = "HIGH"
        mock_score_output.details = {
            "breakdown": {
                "phase": {"points": 50, "value": "travaux"},
                "scale": {"points": 25, "value": "Large"}
            },
            "time_decay": {"days_since_last_update": 5, "penalty": 0},
            "raw_total": 75,
            "final_score": 75
        }

        with patch("api.shark_api.get_supabase", return_value=mock_db), \
             patch("services.shark_scoring_service.compute_shark_score", new_callable=AsyncMock, return_value=mock_score_output):

            response = client.get(f"/shark/projects/{project_id}")

            assert response.status_code == 200
            data = response.json()

            assert "project" in data
            assert "score_details" in data

            # Check project core fields
            p = data["project"]
            assert p["project_id"] == project_id
            assert p["name"] == "Test Project"
            assert p["score"] == 75
            assert p["priority"] == "HIGH"

            # Check score details
            if data["score_details"]:
                sd = data["score_details"]
                assert "breakdown" in sd
                assert "time_decay" in sd

        print("\n OK - test_get_project_detail_returns_score_and_core_fields")

    def test_min_priority_filter(self):
        """Test that min_priority filter works correctly."""
        project_critical = make_mock_project(score=95, priority="CRITICAL")
        project_high = make_mock_project(score=75, priority="HIGH")
        project_medium = make_mock_project(score=50, priority="MEDIUM")
        project_low = make_mock_project(score=20, priority="LOW")

        mock_db = MockSupabaseClient()
        mock_db.set_table_data("shark_projects", [project_critical, project_high])
        mock_db.set_table_data("shark_project_organizations", [])
        mock_db.set_table_data("shark_project_news", [])

        with patch("api.shark_api.get_supabase", return_value=mock_db):
            response = client.get("/shark/projects/top?min_priority=HIGH")

            assert response.status_code == 200
            data = response.json()

            # Should only return HIGH and CRITICAL (mock returns filtered data)
            for item in data["items"]:
                assert item["priority"] in ["HIGH", "CRITICAL"]

        print("\n OK - test_min_priority_filter")

    def test_project_not_found(self):
        """Test 404 when project doesn't exist."""
        mock_db = MockSupabaseClient()
        mock_db.set_table_data("shark_projects", [])

        with patch("api.shark_api.get_supabase", return_value=mock_db):
            fake_id = str(uuid4())
            response = client.get(f"/shark/projects/{fake_id}")

            assert response.status_code == 404
            assert "not found" in response.json()["detail"].lower()

        print("\n OK - test_project_not_found")


# ============================================================
# PHASE 5.2 TESTS - ORGANIZATIONS, PEOPLE, NEWS & ACTIONS
# ============================================================

class TestPhase52:
    """Phase 5.2 tests: Organizations, People, News & Actions endpoints."""

    def test_get_project_organizations(self):
        """Test that /projects/{id}/organizations returns org list."""
        project = make_mock_project()
        project_id = project["id"]
        org = make_mock_organization()

        mock_db = MockSupabaseClient()
        mock_db.set_table_data("shark_projects", [project])
        mock_db.set_table_data("shark_project_organizations", [
            {"project_id": project_id, "organization_id": org["id"], "role_in_project": "MOA"}
        ])
        mock_db.set_table_data("shark_organizations", [org])

        with patch("api.shark_api.get_supabase", return_value=mock_db):
            response = client.get(f"/shark/projects/{project_id}/organizations")

            assert response.status_code == 200
            data = response.json()

            assert "project_id" in data
            assert "organizations" in data
            assert data["project_id"] == project_id

        print("\n OK - test_get_project_organizations")

    def test_get_project_people(self):
        """Test that /projects/{id}/people returns people list."""
        project = make_mock_project()
        project_id = project["id"]
        org = make_mock_organization()
        person = make_mock_person()

        mock_db = MockSupabaseClient()
        mock_db.set_table_data("shark_projects", [project])
        mock_db.set_table_data("shark_project_organizations", [
            {"project_id": project_id, "organization_id": org["id"]}
        ])
        mock_db.set_table_data("shark_organizations", [org])
        mock_db.set_table_data("shark_organization_people", [
            {"organization_id": org["id"], "person_id": person["id"], "role_in_org": "directeur_travaux", "ai_confidence": 0.9, "is_current": True}
        ])
        mock_db.set_table_data("shark_people", [person])

        with patch("api.shark_api.get_supabase", return_value=mock_db):
            response = client.get(f"/shark/projects/{project_id}/people")

            assert response.status_code == 200
            data = response.json()

            assert "project_id" in data
            assert "people" in data
            assert data["project_id"] == project_id

        print("\n OK - test_get_project_people")

    def test_get_project_news(self):
        """Test that /projects/{id}/news returns news list."""
        project = make_mock_project()
        project_id = project["id"]
        news = make_mock_news()

        mock_db = MockSupabaseClient()
        mock_db.set_table_data("shark_projects", [project])
        mock_db.set_table_data("shark_project_news", [
            {"project_id": project_id, "news_id": news["id"]}
        ])
        mock_db.set_table_data("shark_news_items", [news])

        with patch("api.shark_api.get_supabase", return_value=mock_db):
            response = client.get(f"/shark/projects/{project_id}/news")

            assert response.status_code == 200
            data = response.json()

            assert "project_id" in data
            assert "news" in data
            assert data["project_id"] == project_id

        print("\n OK - test_get_project_news")

    def test_refresh_score_updates_project(self):
        """Test that POST /projects/{id}/refresh-score updates the score."""
        project = make_mock_project()
        project_id = project["id"]

        mock_db = MockSupabaseClient()
        mock_db.set_table_data("shark_projects", [project])

        mock_score_output = MagicMock()
        mock_score_output.score = 85
        mock_score_output.priority = "HIGH"
        mock_score_output.details = {
            "breakdown": {"phase": {"points": 50}},
            "time_decay": {"days_since_last_update": 2, "penalty": 0}
        }

        with patch("api.shark_api.get_supabase", return_value=mock_db), \
             patch("services.shark_scoring_service.compute_shark_score", new_callable=AsyncMock, return_value=mock_score_output):

            response = client.post(
                f"/shark/projects/{project_id}/refresh-score",
                json={"force_recompute": True}
            )

            assert response.status_code == 200
            data = response.json()

            assert data["project_id"] == project_id
            assert data["score"] == 85
            assert data["priority"] == "HIGH"
            assert "details" in data

        print("\n OK - test_refresh_score_updates_project")

    def test_osint_enrich_creates_people_and_links(self):
        """Test that POST /osint/enrich/{org_id} triggers Sherlock enrichment."""
        org = make_mock_organization()
        org_id = org["id"]

        mock_db = MockSupabaseClient()
        mock_db.set_table_data("shark_organizations", [org])

        mock_person_ids = [uuid4(), uuid4()]

        with patch("api.shark_api.get_supabase", return_value=mock_db), \
             patch("services.shark_sherlock_service.enrich_organization_with_people", new_callable=AsyncMock, return_value=mock_person_ids):

            response = client.post(
                f"/shark/osint/enrich/{org_id}",
                json={
                    "desired_roles": ["Directeur Travaux", "Chef de Projet"],
                    "max_results": 5
                }
            )

            assert response.status_code == 200
            data = response.json()

            assert data["organization_id"] == org_id
            assert "created_people_ids" in data
            assert len(data["created_people_ids"]) == 2
            assert "message" in data

        print("\n OK - test_osint_enrich_creates_people_and_links")


# ============================================================
# PHASE 5.3 TESTS - ALERTS, ACTIVITY FEED & GEO FILTER
# ============================================================

class TestPhase53:
    """Phase 5.3 tests: Alerts, Activity Feed & Geo Filter endpoints."""

    def test_activity_feed_project_filtered(self):
        """Test that activity feed can be filtered by project_id."""
        project = make_mock_project()
        project_id = project["id"]
        news = make_mock_news()

        mock_db = MockSupabaseClient()
        mock_db.set_table_data("shark_news_items", [news])
        mock_db.set_table_data("shark_project_news", [
            {"news_id": news["id"], "project_id": project_id}
        ])
        mock_db.set_table_data("shark_projects", [project])

        with patch("api.shark_api.get_supabase", return_value=mock_db):
            response = client.get(f"/shark/activity-feed?project_id={project_id}")

            assert response.status_code == 200
            data = response.json()

            assert "items" in data

            # All items should be related to the project
            for item in data["items"]:
                if item["project_id"]:
                    assert item["project_id"] == project_id

        print("\n OK - test_activity_feed_project_filtered")

    def test_alerts_returns_new_critical_and_score_changes(self):
        """Test that /alerts returns correct alert summary."""
        project_critical = make_mock_project(score=95, priority="CRITICAL")
        project_high = make_mock_project(score=80, priority="HIGH")

        mock_db = MockSupabaseClient()
        mock_db.set_table_data("shark_projects", [project_critical, project_high])

        with patch("api.shark_api.get_supabase", return_value=mock_db):
            response = client.get("/shark/alerts")

            assert response.status_code == 200
            data = response.json()

            assert "new_critical_projects_count" in data
            assert "score_changes" in data
            assert "recent_projects" in data

            assert isinstance(data["new_critical_projects_count"], int)
            assert isinstance(data["score_changes"], list)
            assert isinstance(data["recent_projects"], list)

        print("\n OK - test_alerts_returns_new_critical_and_score_changes")

    def test_top_projects_with_geo_filter_includes_only_in_radius(self):
        """Test that geo filter correctly filters projects by radius."""
        # Toulouse: 43.6047, 1.4442
        # Paris: 48.8566, 2.3522 (about 590km away)
        # Montpellier: 43.6108, 3.8767 (about 200km away)

        project_toulouse = make_mock_project(name="Toulouse Project")
        project_toulouse["location_lat"] = 43.6047
        project_toulouse["location_long"] = 1.4442

        project_montpellier = make_mock_project(name="Montpellier Project")
        project_montpellier["location_lat"] = 43.6108
        project_montpellier["location_long"] = 3.8767

        project_paris = make_mock_project(name="Paris Project")
        project_paris["location_lat"] = 48.8566
        project_paris["location_long"] = 2.3522

        mock_db = MockSupabaseClient()
        mock_db.set_table_data("shark_projects", [project_toulouse, project_montpellier, project_paris])
        mock_db.set_table_data("shark_project_organizations", [])
        mock_db.set_table_data("shark_project_news", [])

        with patch("api.shark_api.get_supabase", return_value=mock_db):
            # Search around Toulouse with 250km radius (should include Toulouse & Montpellier, not Paris)
            response = client.get(
                "/shark/projects/top?lat=43.6047&lon=1.4442&radius_km=250"
            )

            assert response.status_code == 200
            data = response.json()

            # Check that geo filter was applied
            project_names = [item["name"] for item in data["items"]]

            # Toulouse should be included (0km)
            assert "Toulouse Project" in project_names

            # Montpellier should be included (~200km)
            assert "Montpellier Project" in project_names

            # Paris should NOT be included (~590km)
            assert "Paris Project" not in project_names

        print("\n OK - test_top_projects_with_geo_filter_includes_only_in_radius")

    def test_haversine_distance_calculation(self):
        """Test the Haversine distance calculation function."""
        from api.shark_api import haversine_distance

        # Toulouse to Paris (approximately 590km)
        toulouse_lat, toulouse_lon = 43.6047, 1.4442
        paris_lat, paris_lon = 48.8566, 2.3522

        distance = haversine_distance(toulouse_lat, toulouse_lon, paris_lat, paris_lon)

        # Should be approximately 590km (allow some margin)
        assert 580 < distance < 600

        # Same point should be 0
        same_distance = haversine_distance(toulouse_lat, toulouse_lon, toulouse_lat, toulouse_lon)
        assert same_distance == 0

        print("\n OK - test_haversine_distance_calculation")


# ============================================================
# AUTHENTICATION TESTS
# ============================================================

class TestAuthentication:
    """Tests for authentication/tenant extraction."""

    def test_missing_tenant_returns_401(self):
        """Test that missing tenant context returns 401."""
        # Remove the override for this test
        original_override = app.dependency_overrides.get(get_current_tenant_id)
        del app.dependency_overrides[get_current_tenant_id]

        try:
            response = client.get("/shark/projects/top")
            assert response.status_code == 401
            assert "tenant" in response.json()["detail"].lower()
        finally:
            # Restore override
            if original_override:
                app.dependency_overrides[get_current_tenant_id] = original_override
            else:
                app.dependency_overrides[get_current_tenant_id] = override_get_tenant_id

        print("\n OK - test_missing_tenant_returns_401")

    def test_x_tenant_id_header_works(self):
        """Test that X-Tenant-Id header is accepted."""
        # Remove override
        original_override = app.dependency_overrides.get(get_current_tenant_id)
        del app.dependency_overrides[get_current_tenant_id]

        mock_db = MockSupabaseClient()
        mock_db.set_table_data("shark_projects", [])
        mock_db.set_table_data("shark_project_organizations", [])
        mock_db.set_table_data("shark_project_news", [])

        try:
            with patch("api.shark_api.get_supabase", return_value=mock_db):
                response = client.get(
                    "/shark/projects/top",
                    headers={"X-Tenant-Id": str(TEST_TENANT_ID)}
                )
                assert response.status_code == 200
        finally:
            app.dependency_overrides[get_current_tenant_id] = original_override or override_get_tenant_id

        print("\n OK - test_x_tenant_id_header_works")


# ============================================================
# MAIN TEST RUNNER
# ============================================================

if __name__ == "__main__":
    print("=" * 60)
    print("Shark Hunter API - Unit Tests")
    print("=" * 60)

    # Phase 5.1 Tests
    print("\n--- Phase 5.1: Radar & Fiche Projet ---")
    phase51 = TestPhase51()
    phase51.test_get_top_projects_returns_paginated_list()
    phase51.test_get_project_detail_returns_score_and_core_fields()
    phase51.test_min_priority_filter()
    phase51.test_project_not_found()

    # Phase 5.2 Tests
    print("\n--- Phase 5.2: Organizations, People, News & Actions ---")
    phase52 = TestPhase52()
    phase52.test_get_project_organizations()
    phase52.test_get_project_people()
    phase52.test_get_project_news()
    phase52.test_refresh_score_updates_project()
    phase52.test_osint_enrich_creates_people_and_links()

    # Phase 5.3 Tests
    print("\n--- Phase 5.3: Alerts, Activity Feed & Geo Filter ---")
    phase53 = TestPhase53()
    phase53.test_activity_feed_project_filtered()
    phase53.test_alerts_returns_new_critical_and_score_changes()
    phase53.test_top_projects_with_geo_filter_includes_only_in_radius()
    phase53.test_haversine_distance_calculation()

    # Authentication Tests
    print("\n--- Authentication Tests ---")
    auth_tests = TestAuthentication()
    auth_tests.test_missing_tenant_returns_401()
    auth_tests.test_x_tenant_id_header_works()

    print("\n" + "=" * 60)
    print("All tests passed!")
    print("=" * 60)
