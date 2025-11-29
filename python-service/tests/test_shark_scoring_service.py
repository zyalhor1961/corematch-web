"""
Unit Tests for Shark Scoring Service - Phase 4

Tests:
1. test_scoring_simple - Basic score calculation
2. test_priority_levels - Priority threshold tests
3. test_batch_scoring - Batch scoring with multiple projects
4. test_malus_no_orgs - Malus when no organizations
5. test_bonus_sherlock - Bonus from Sherlock people
6. test_time_decay - Time decay penalty
7. test_date_urgency - Date urgency scoring
8. test_scale_scoring - Scale-based scoring
9. test_phase_scoring - Phase-based scoring

Uses mocks to avoid actual database calls.
"""

import os
import sys
import pytest
import asyncio
from datetime import datetime, date, timedelta
from uuid import UUID, uuid4
from unittest.mock import AsyncMock, MagicMock, patch

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()


# ============================================================
# TEST DATA
# ============================================================

def make_project(
    phase: str = "travaux",
    scale: str = "Large",
    start_date: str = None,
    updated_at: str = None
) -> dict:
    """Create a mock project record."""
    if start_date is None:
        start_date = (date.today() + timedelta(days=60)).isoformat()
    if updated_at is None:
        updated_at = datetime.utcnow().isoformat()

    return {
        "id": str(uuid4()),
        "tenant_id": str(uuid4()),
        "name": "Test Project",
        "phase": phase,
        "estimated_scale": scale,
        "start_date_est": start_date,
        "updated_at": updated_at,
        "location_city": "Toulouse",
    }


def make_org(role: str = "MOA", confidence: float = 0.8) -> dict:
    """Create a mock organization record."""
    return {
        "id": str(uuid4()),
        "name": f"Test Org ({role})",
        "org_type": role,
        "role_in_project": role,
        "ai_confidence": confidence,
    }


def make_person(role: str = "directeur_travaux", confidence: float = 0.85) -> dict:
    """Create a mock person record."""
    return {
        "person_id": str(uuid4()),
        "role_in_org": role,
        "ai_confidence": confidence,
        "is_current": True,
        "created_at": datetime.utcnow().isoformat(),
    }


# ============================================================
# TEST: PYDANTIC MODELS
# ============================================================

class TestPydanticModels:
    """Tests for Pydantic models."""

    def test_shark_score_output(self):
        """Test SharkScoreOutput model."""
        from services.shark_scoring_service import SharkScoreOutput

        output = SharkScoreOutput(
            project_id=uuid4(),
            score=75,
            priority="HIGH",
            details={"phase": 50, "scale": 25}
        )

        assert output.score == 75
        assert output.priority == "HIGH"
        assert output.details["phase"] == 50
        assert output.updated_at is not None
        print("\n OK - SharkScoreOutput model")

    def test_score_breakdown(self):
        """Test ScoreBreakdown model."""
        from services.shark_scoring_service import ScoreBreakdown

        breakdown = ScoreBreakdown(
            phase_points=50,
            scale_points=25,
            date_urgency_points=40,
            news_points=20,
            org_points=35,
            people_points=25,
            malus_points=-10,
            time_decay_penalty=-10
        )

        assert breakdown.phase_points == 50
        assert breakdown.malus_points == -10
        print("\n OK - ScoreBreakdown model")


# ============================================================
# TEST: INDIVIDUAL SCORING FUNCTIONS
# ============================================================

class TestScoringFunctions:
    """Tests for individual scoring functions."""

    def test_score_phase(self):
        """Test phase scoring."""
        from services.shark_scoring_service import score_phase

        assert score_phase("appel_offres") == 30
        assert score_phase("travaux") == 50
        assert score_phase("livraison") == 10
        assert score_phase("detection") == 0
        assert score_phase("abandonne") == -50
        assert score_phase(None) == 0
        assert score_phase("") == 0
        print("\n OK - score_phase")

    def test_score_scale(self):
        """Test scale scoring."""
        from services.shark_scoring_service import score_scale

        assert score_scale("Mega") == 40
        assert score_scale("Large") == 25
        assert score_scale("Medium") == 10
        assert score_scale("Small") == 5
        assert score_scale(None) == 0
        assert score_scale("Unknown") == 0
        print("\n OK - score_scale")

    def test_score_date_urgency(self):
        """Test date urgency scoring."""
        from services.shark_scoring_service import score_date_urgency

        # Start in 30 days (< 90) -> 40 points
        soon = (date.today() + timedelta(days=30)).isoformat()
        points, days = score_date_urgency(soon)
        assert points == 40
        assert days == 30

        # Start in 120 days (< 180) -> 20 points
        medium = (date.today() + timedelta(days=120)).isoformat()
        points, days = score_date_urgency(medium)
        assert points == 20
        assert days == 120

        # Start in 365 days (> 180) -> 5 points
        far = (date.today() + timedelta(days=365)).isoformat()
        points, days = score_date_urgency(far)
        assert points == 5
        assert days == 365

        # No date -> default 5 points
        points, days = score_date_urgency(None)
        assert points == 5
        assert days == -1

        # Already started (negative days) -> 20 points
        past = (date.today() - timedelta(days=30)).isoformat()
        points, days = score_date_urgency(past)
        assert points == 20
        assert days == -30

        print("\n OK - score_date_urgency")

    def test_score_news(self):
        """Test news scoring."""
        from services.shark_scoring_service import score_news

        assert score_news(0) == 0
        assert score_news(1) == 10
        assert score_news(2) == 20
        assert score_news(3) == 30
        assert score_news(5) == 30  # Capped at 30
        assert score_news(10) == 30  # Still capped
        print("\n OK - score_news")

    def test_score_organizations(self):
        """Test organization scoring."""
        from services.shark_scoring_service import score_organizations

        # Single MOA
        orgs = [make_org("MOA")]
        points, breakdown = score_organizations(orgs)
        assert points == 15
        assert "MOA" in breakdown

        # MOA + MOE + GC
        orgs = [make_org("MOA"), make_org("MOE"), make_org("General_Contractor")]
        points, breakdown = score_organizations(orgs)
        assert points == 35  # 15 + 10 + 10

        # Duplicate roles only counted once
        orgs = [make_org("MOA"), make_org("MOA")]
        points, breakdown = score_organizations(orgs)
        assert points == 15  # Only one MOA counted

        # Empty list
        points, breakdown = score_organizations([])
        assert points == 0

        print("\n OK - score_organizations")

    def test_score_people(self):
        """Test people scoring."""
        from services.shark_scoring_service import score_people

        # Directeur Travaux with high confidence
        people = [make_person("directeur_travaux", 0.9)]
        points, details = score_people(people)
        assert points == 25 + 10  # 25 for role + 10 for high confidence
        assert details["high_confidence_count"] == 1

        # Multiple roles
        people = [
            make_person("directeur_travaux", 0.8),
            make_person("chef_de_projet", 0.7),
        ]
        points, details = score_people(people)
        assert points >= 35  # 25 + 10 for roles, + 10 high confidence

        # Low confidence (no bonus)
        people = [make_person("directeur_travaux", 0.5)]
        points, details = score_people(people)
        assert points == 25  # No high confidence bonus
        assert details["high_confidence_count"] == 0

        # Empty list
        points, details = score_people([])
        assert points == 0

        print("\n OK - score_people")


# ============================================================
# TEST: TIME DECAY
# ============================================================

class TestTimeDecay:
    """Tests for time decay calculation."""

    def test_time_decay_recent(self):
        """Test no penalty for recent updates."""
        from services.shark_scoring_service import calculate_time_decay

        recent = datetime.utcnow() - timedelta(days=10)
        penalty, details = calculate_time_decay(recent, None, None)

        assert penalty == 0
        assert details["days_since_last_update"] <= 10
        assert details["penalty"] == 0
        print("\n OK - time_decay (recent)")

    def test_time_decay_60_days(self):
        """Test -10 penalty for > 60 days."""
        from services.shark_scoring_service import calculate_time_decay

        old = datetime.utcnow() - timedelta(days=75)
        penalty, details = calculate_time_decay(old, None, None)

        assert penalty == -10
        assert details["days_since_last_update"] >= 60
        assert details["penalty"] == -10
        print("\n OK - time_decay (60+ days)")

    def test_time_decay_120_days(self):
        """Test -30 penalty for > 120 days."""
        from services.shark_scoring_service import calculate_time_decay

        very_old = datetime.utcnow() - timedelta(days=150)
        penalty, details = calculate_time_decay(very_old, None, None)

        assert penalty == -30
        assert details["days_since_last_update"] >= 120
        assert details["penalty"] == -30
        print("\n OK - time_decay (120+ days)")

    def test_time_decay_uses_latest(self):
        """Test that the latest date is used."""
        from services.shark_scoring_service import calculate_time_decay

        old_project = datetime.utcnow() - timedelta(days=200)
        recent_news = datetime.utcnow() - timedelta(days=5)

        penalty, details = calculate_time_decay(old_project, recent_news, None)

        # Should use recent_news date, so no penalty
        assert penalty == 0
        assert details["days_since_last_update"] <= 10
        print("\n OK - time_decay (uses latest)")


# ============================================================
# TEST: PRIORITY LEVELS
# ============================================================

class TestPriorityLevels:
    """Tests for priority calculation."""

    def test_priority_critical(self):
        """Test CRITICAL priority threshold."""
        from services.shark_scoring_service import calculate_priority

        assert calculate_priority(100) == "CRITICAL"
        assert calculate_priority(95) == "CRITICAL"
        assert calculate_priority(90) == "CRITICAL"
        print("\n OK - priority CRITICAL")

    def test_priority_high(self):
        """Test HIGH priority threshold."""
        from services.shark_scoring_service import calculate_priority

        assert calculate_priority(89) == "HIGH"
        assert calculate_priority(80) == "HIGH"
        assert calculate_priority(70) == "HIGH"
        print("\n OK - priority HIGH")

    def test_priority_medium(self):
        """Test MEDIUM priority threshold."""
        from services.shark_scoring_service import calculate_priority

        assert calculate_priority(69) == "MEDIUM"
        assert calculate_priority(50) == "MEDIUM"
        assert calculate_priority(40) == "MEDIUM"
        print("\n OK - priority MEDIUM")

    def test_priority_low(self):
        """Test LOW priority threshold."""
        from services.shark_scoring_service import calculate_priority

        assert calculate_priority(39) == "LOW"
        assert calculate_priority(20) == "LOW"
        assert calculate_priority(0) == "LOW"
        print("\n OK - priority LOW")


# ============================================================
# TEST: BONUS/MALUS
# ============================================================

class TestBonusMalus:
    """Tests for bonus/malus calculation."""

    def test_malus_no_orgs(self):
        """Test malus when no organizations."""
        from services.shark_scoring_service import calculate_bonus_malus

        bonus, malus, details = calculate_bonus_malus([], 0)

        assert malus == -20
        assert "no_orgs_malus" in details
        assert details["no_orgs_malus"] == -20
        print("\n OK - malus_no_orgs")

    def test_malus_low_confidence(self):
        """Test malus for low AI confidence."""
        from services.shark_scoring_service import calculate_bonus_malus

        orgs = [make_org("MOA", confidence=0.3)]
        bonus, malus, details = calculate_bonus_malus(orgs, 0.3)

        assert malus == -10
        assert "low_confidence_malus" in details
        print("\n OK - malus_low_confidence")

    def test_no_malus_good_data(self):
        """Test no malus with good data."""
        from services.shark_scoring_service import calculate_bonus_malus

        orgs = [make_org("MOA", confidence=0.8)]
        bonus, malus, details = calculate_bonus_malus(orgs, 0.8)

        assert malus == 0
        assert "no_orgs_malus" not in details
        assert "low_confidence_malus" not in details
        print("\n OK - no_malus_good_data")


# ============================================================
# TEST: FULL SCORING WITH MOCKS
# ============================================================

class TestFullScoring:
    """Integration tests with mocked database."""

    @pytest.mark.asyncio
    async def test_scoring_simple(self):
        """Test simple scoring scenario."""
        from services.shark_scoring_service import compute_shark_score

        project_id = uuid4()
        tenant_id = uuid4()

        # Mock database
        mock_db = MagicMock()

        # Mock project data
        project = make_project(phase="travaux", scale="Large")
        project["id"] = str(project_id)
        project["tenant_id"] = str(tenant_id)

        # Setup mock responses
        mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[project])

        # Mock empty orgs/news/people
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

        # Mock update
        mock_db.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()

        result = await compute_shark_score(project_id, tenant_id, mock_db)

        # Check result structure
        assert result.project_id == project_id
        assert 0 <= result.score <= 100
        assert result.priority in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        assert "breakdown" in result.details

        # Phase=travaux (50) + Scale=Large (25) + Date urgency (~40) - malus_no_orgs (-20) = ~95
        # But capped at 100
        print(f"\n OK - scoring_simple: score={result.score}, priority={result.priority}")

    @pytest.mark.asyncio
    async def test_scoring_with_orgs_and_people(self):
        """Test scoring with full data."""
        from services.shark_scoring_service import compute_shark_score

        project_id = uuid4()
        tenant_id = uuid4()

        mock_db = MagicMock()

        # Project data
        project = make_project(phase="appel_offres", scale="Mega")
        project["id"] = str(project_id)
        project["tenant_id"] = str(tenant_id)

        # Complex mock setup
        def mock_table(table_name):
            mock = MagicMock()
            if table_name == "shark_projects":
                mock.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[project])
                mock.update.return_value.eq.return_value.execute.return_value = MagicMock()
            elif table_name == "shark_project_organizations":
                mock.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[
                    {"organization_id": str(uuid4()), "role_in_project": "MOA", "ai_confidence": 0.9},
                    {"organization_id": str(uuid4()), "role_in_project": "MOE", "ai_confidence": 0.85},
                ])
            elif table_name == "shark_organizations":
                mock.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[
                    {"id": str(uuid4()), "name": "Test Org", "org_type": "MOA"}
                ])
            elif table_name == "shark_project_news":
                mock.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
            elif table_name == "shark_news_items":
                mock.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
            elif table_name == "shark_organization_people":
                mock.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[
                    {"person_id": str(uuid4()), "role_in_org": "directeur_travaux", "ai_confidence": 0.9, "is_current": True, "created_at": datetime.utcnow().isoformat()}
                ])
            return mock

        mock_db.table = mock_table

        result = await compute_shark_score(project_id, tenant_id, mock_db)

        assert result.score > 50  # Should be high with good data
        print(f"\n OK - scoring_with_orgs_and_people: score={result.score}, priority={result.priority}")

    @pytest.mark.asyncio
    async def test_batch_scoring(self):
        """Test batch scoring for multiple projects."""
        from services.shark_scoring_service import compute_shark_scores_for_tenant

        tenant_id = uuid4()
        project_ids = [uuid4() for _ in range(3)]

        mock_db = MagicMock()

        # Mock project list
        projects = [
            {"id": str(pid), "tenant_id": str(tenant_id)}
            for pid in project_ids
        ]

        def mock_table(table_name):
            mock = MagicMock()
            if table_name == "shark_projects":
                # For list query
                mock.select.return_value.eq.return_value.execute.return_value = MagicMock(data=projects)
                # For individual project queries
                mock.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
                    data=[make_project()]
                )
                mock.update.return_value.eq.return_value.execute.return_value = MagicMock()
            else:
                mock.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
            return mock

        mock_db.table = mock_table

        results = await compute_shark_scores_for_tenant(tenant_id, db=mock_db)

        assert len(results) == 3
        for r in results:
            assert 0 <= r.score <= 100
            assert r.priority in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

        print(f"\n OK - batch_scoring: {len(results)} projects scored")

    @pytest.mark.asyncio
    async def test_malus_no_orgs_integration(self):
        """Test that no-orgs malus is applied correctly."""
        from services.shark_scoring_service import compute_shark_score

        project_id = uuid4()
        tenant_id = uuid4()

        mock_db = MagicMock()

        # Small project, detection phase, no orgs
        project = make_project(phase="detection", scale="Small")
        project["id"] = str(project_id)
        project["tenant_id"] = str(tenant_id)

        def mock_table(table_name):
            mock = MagicMock()
            if table_name == "shark_projects":
                mock.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[project])
                mock.update.return_value.eq.return_value.execute.return_value = MagicMock()
            else:
                # No orgs, news, or people
                mock.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
            return mock

        mock_db.table = mock_table

        result = await compute_shark_score(project_id, tenant_id, mock_db)

        # Should have low score due to:
        # phase=detection (0) + scale=Small (5) + date urgency (~20-40) - no_orgs_malus (-20)
        assert result.details["breakdown"]["malus"]["points"] == -20
        assert "no_orgs_malus" in result.details["breakdown"]["malus"]

        print(f"\n OK - malus_no_orgs_integration: score={result.score}")

    @pytest.mark.asyncio
    async def test_bonus_sherlock_integration(self):
        """Test that Sherlock people bonus is applied."""
        from services.shark_scoring_service import compute_shark_score

        project_id = uuid4()
        tenant_id = uuid4()

        mock_db = MagicMock()

        project = make_project(phase="travaux", scale="Large")
        project["id"] = str(project_id)
        project["tenant_id"] = str(tenant_id)

        org_id = str(uuid4())

        def mock_table(table_name):
            mock = MagicMock()
            if table_name == "shark_projects":
                mock.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[project])
                mock.update.return_value.eq.return_value.execute.return_value = MagicMock()
            elif table_name == "shark_project_organizations":
                mock.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[
                    {"organization_id": org_id, "role_in_project": "MOA", "ai_confidence": 0.9}
                ])
            elif table_name == "shark_organizations":
                mock.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[
                    {"id": org_id, "name": "Test MOA", "org_type": "MOA"}
                ])
            elif table_name == "shark_organization_people":
                mock.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[
                    {"person_id": str(uuid4()), "role_in_org": "directeur_travaux", "ai_confidence": 0.95, "is_current": True, "created_at": datetime.utcnow().isoformat()}
                ])
            else:
                mock.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
            return mock

        mock_db.table = mock_table

        result = await compute_shark_score(project_id, tenant_id, mock_db)

        # Check people points include directeur_travaux (25) + high confidence (10)
        assert result.details["breakdown"]["people"]["points"] >= 25
        assert result.details["breakdown"]["people"]["high_confidence_bonus"] == 10

        print(f"\n OK - bonus_sherlock_integration: score={result.score}, people_points={result.details['breakdown']['people']['points']}")

    @pytest.mark.asyncio
    async def test_time_decay_integration(self):
        """Test time decay penalty in full scoring."""
        from services.shark_scoring_service import compute_shark_score

        project_id = uuid4()
        tenant_id = uuid4()

        mock_db = MagicMock()

        # Very old project
        old_date = (datetime.utcnow() - timedelta(days=150)).isoformat()
        project = make_project(phase="travaux", scale="Large", updated_at=old_date)
        project["id"] = str(project_id)
        project["tenant_id"] = str(tenant_id)

        def mock_table(table_name):
            mock = MagicMock()
            if table_name == "shark_projects":
                mock.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[project])
                mock.update.return_value.eq.return_value.execute.return_value = MagicMock()
            else:
                mock.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
            return mock

        mock_db.table = mock_table

        result = await compute_shark_score(project_id, tenant_id, mock_db)

        # Should have time decay penalty
        assert result.details["time_decay"]["penalty"] == -30
        assert result.details["time_decay"]["days_since_last_update"] >= 120

        print(f"\n OK - time_decay_integration: penalty={result.details['time_decay']['penalty']}, days={result.details['time_decay']['days_since_last_update']}")

    @pytest.mark.asyncio
    async def test_score_clamping(self):
        """Test that score is clamped to 0-100."""
        from services.shark_scoring_service import compute_shark_score

        project_id = uuid4()
        tenant_id = uuid4()

        mock_db = MagicMock()

        # Abandoned project with lots of malus
        old_date = (datetime.utcnow() - timedelta(days=200)).isoformat()
        project = make_project(phase="abandonne", scale="Small", updated_at=old_date)
        project["id"] = str(project_id)
        project["tenant_id"] = str(tenant_id)

        def mock_table(table_name):
            mock = MagicMock()
            if table_name == "shark_projects":
                mock.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[project])
                mock.update.return_value.eq.return_value.execute.return_value = MagicMock()
            else:
                mock.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
            return mock

        mock_db.table = mock_table

        result = await compute_shark_score(project_id, tenant_id, mock_db)

        # Score should be clamped to 0 minimum
        assert result.score >= 0
        assert result.score <= 100

        # Raw total might be negative but final is clamped
        print(f"\n OK - score_clamping: raw={result.details['raw_total']}, final={result.score}")


# ============================================================
# MAIN TEST RUNNER
# ============================================================

if __name__ == "__main__":
    print("=" * 60)
    print("Shark Scoring Service - Unit Tests")
    print("=" * 60)

    # Run synchronous tests
    print("\n--- Pydantic Model Tests ---")
    model_tests = TestPydanticModels()
    model_tests.test_shark_score_output()
    model_tests.test_score_breakdown()

    print("\n--- Scoring Function Tests ---")
    func_tests = TestScoringFunctions()
    func_tests.test_score_phase()
    func_tests.test_score_scale()
    func_tests.test_score_date_urgency()
    func_tests.test_score_news()
    func_tests.test_score_organizations()
    func_tests.test_score_people()

    print("\n--- Time Decay Tests ---")
    decay_tests = TestTimeDecay()
    decay_tests.test_time_decay_recent()
    decay_tests.test_time_decay_60_days()
    decay_tests.test_time_decay_120_days()
    decay_tests.test_time_decay_uses_latest()

    print("\n--- Priority Tests ---")
    priority_tests = TestPriorityLevels()
    priority_tests.test_priority_critical()
    priority_tests.test_priority_high()
    priority_tests.test_priority_medium()
    priority_tests.test_priority_low()

    print("\n--- Bonus/Malus Tests ---")
    malus_tests = TestBonusMalus()
    malus_tests.test_malus_no_orgs()
    malus_tests.test_malus_low_confidence()
    malus_tests.test_no_malus_good_data()

    # Run async tests
    print("\n--- Integration Tests (Mocked) ---")

    async def run_async_tests():
        full_tests = TestFullScoring()
        await full_tests.test_scoring_simple()
        await full_tests.test_scoring_with_orgs_and_people()
        await full_tests.test_batch_scoring()
        await full_tests.test_malus_no_orgs_integration()
        await full_tests.test_bonus_sherlock_integration()
        await full_tests.test_time_decay_integration()
        await full_tests.test_score_clamping()

    asyncio.run(run_async_tests())

    print("\n" + "=" * 60)
    print("All tests passed!")
    print("=" * 60)
