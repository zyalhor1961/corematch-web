"""
Unit tests for Shark BOAMP Service.

Tests the public tender functionality including:
- BOAMP API client
- Tender parsing
- Tender ingestion pipeline
- Project matching
- Score updates

Run with: pytest tests/test_shark_boamp_service.py -v
"""

import pytest
from datetime import datetime, timezone, timedelta
from uuid import UUID, uuid4
from unittest.mock import AsyncMock, MagicMock, patch

# Import test subjects
from services.shark_boamp_service import (
    BoampTender,
    TenderIngestionResult,
    TenderFetchSummary,
    TenderIngestionSummary,
    _is_btp_relevant,
    _parse_tender_record,
    _text_similarity,
    _cpv_overlap,
    _estimate_scale_from_cpv,
)


# ============================================================
# FIXTURES
# ============================================================

@pytest.fixture
def sample_tender():
    """Sample BoampTender for testing."""
    return BoampTender(
        external_id="24-123456",
        title="Travaux de renovation du groupe scolaire Jean Moulin",
        description="Marche de travaux pour la renovation complete du groupe scolaire",
        published_at=datetime.now(timezone.utc),
        deadline_at=datetime.now(timezone.utc) + timedelta(days=14),
        procedure_type="Appel d'offres ouvert",
        cpv_codes=["45210000", "45310000"],
        status="published",
        location_city="Lyon",
        location_region="Auvergne-Rhone-Alpes",
        buyer_name="Ville de Lyon",
        buyer_siret="21690123456789",
        raw_data={"source": "test"},
    )


@pytest.fixture
def sample_boamp_record():
    """Sample raw BOAMP API record."""
    return {
        "fields": {
            "idannonce": "24-789012",
            "objet": "Construction d'un batiment administratif",
            "descriptif": "Travaux de construction neuve",
            "dateparution": "2024-11-15",
            "datelimite": "2024-12-15",
            "typeprocedure": "Procedure adaptee",
            "cpv": "45210000,45310000",
            "region": "Ile-de-France",
            "ville": "Paris",
            "organisme": "Mairie de Paris",
            "siret": "21750012345678",
            "etat": "publie",
        }
    }


@pytest.fixture
def mock_db():
    """Mock Supabase client."""
    mock = MagicMock()
    return mock


# ============================================================
# TEST: BTP Relevance Detection
# ============================================================

class TestBtpRelevance:
    """Tests for _is_btp_relevant function."""

    def test_btp_relevant_by_cpv_code(self):
        """Should detect BTP from CPV codes."""
        data = {"cpv": ["45210000", "45310000"]}
        assert _is_btp_relevant(data) is True

    def test_btp_relevant_by_cpv_string(self):
        """Should handle CPV as comma-separated string."""
        data = {"cpv": "45210000,45310000"}
        assert _is_btp_relevant(data) is True

    def test_btp_relevant_by_keyword_travaux(self):
        """Should detect BTP from 'travaux' keyword."""
        data = {"objet": "Travaux de renovation"}
        assert _is_btp_relevant(data) is True

    def test_btp_relevant_by_keyword_construction(self):
        """Should detect BTP from 'construction' keyword."""
        data = {"objet": "Construction d'un batiment"}
        assert _is_btp_relevant(data) is True

    def test_btp_relevant_by_keyword_batiment(self):
        """Should detect BTP from 'batiment' keyword."""
        data = {"objet": "Entretien du batiment municipal"}
        assert _is_btp_relevant(data) is True

    def test_not_btp_relevant(self):
        """Should not detect BTP for non-construction tenders."""
        data = {
            "objet": "Fourniture de materiel informatique",
            "cpv": ["30200000"],  # IT equipment
        }
        assert _is_btp_relevant(data) is False

    def test_btp_relevant_multiple_keywords(self):
        """Should detect BTP with multiple keywords."""
        data = {"description": "Travaux de plomberie et electricite"}
        assert _is_btp_relevant(data) is True


# ============================================================
# TEST: Tender Parsing
# ============================================================

class TestTenderParsing:
    """Tests for _parse_tender_record function."""

    def test_parse_valid_record(self, sample_boamp_record):
        """Should correctly parse a valid BOAMP record."""
        tender = _parse_tender_record(sample_boamp_record)

        assert tender is not None
        assert tender.external_id == "24-789012"
        assert tender.title == "Construction d'un batiment administratif"
        assert tender.location_city == "Paris"
        assert tender.location_region == "Ile-de-France"
        assert tender.buyer_name == "Mairie de Paris"
        assert "45210000" in tender.cpv_codes

    def test_parse_record_with_missing_fields(self):
        """Should handle records with missing optional fields."""
        record = {
            "fields": {
                "idannonce": "24-000001",
                "objet": "Test tender",
            }
        }

        tender = _parse_tender_record(record)

        assert tender is not None
        assert tender.external_id == "24-000001"
        assert tender.title == "Test tender"
        assert tender.deadline_at is None
        assert tender.buyer_name is None

    def test_parse_record_with_date_formats(self):
        """Should handle various date formats."""
        # ISO format
        record1 = {
            "fields": {
                "idannonce": "1",
                "dateparution": "2024-11-15T10:00:00Z",
            }
        }
        tender1 = _parse_tender_record(record1)
        assert tender1.published_at is not None

        # Simple date format
        record2 = {
            "fields": {
                "idannonce": "2",
                "dateparution": "2024-11-15",
            }
        }
        tender2 = _parse_tender_record(record2)
        assert tender2.published_at is not None

    def test_parse_cpv_codes(self):
        """Should correctly parse CPV codes in various formats."""
        # As list
        record1 = {"fields": {"idannonce": "1", "cpv": ["45210000", "45310000"]}}
        tender1 = _parse_tender_record(record1)
        assert len(tender1.cpv_codes) == 2

        # As comma-separated string
        record2 = {"fields": {"idannonce": "2", "cpv": "45210000,45310000"}}
        tender2 = _parse_tender_record(record2)
        assert len(tender2.cpv_codes) == 2

    def test_parse_status_awarded(self):
        """Should detect awarded status."""
        record = {"fields": {"idannonce": "1", "etat": "attribue"}}
        tender = _parse_tender_record(record)
        assert tender.status == "awarded"

    def test_parse_status_cancelled(self):
        """Should detect cancelled status."""
        record = {"fields": {"idannonce": "1", "etat": "annule"}}
        tender = _parse_tender_record(record)
        assert tender.status == "cancelled"


# ============================================================
# TEST: Text Similarity
# ============================================================

class TestTextSimilarity:
    """Tests for _text_similarity function."""

    def test_identical_texts(self):
        """Identical texts should have similarity 1.0."""
        similarity = _text_similarity("test", "test")
        assert similarity == 1.0

    def test_similar_texts(self):
        """Similar texts should have high similarity."""
        similarity = _text_similarity(
            "Travaux renovation ecole",
            "Travaux de renovation de l'ecole"
        )
        assert similarity > 0.6

    def test_different_texts(self):
        """Different texts should have low similarity."""
        similarity = _text_similarity(
            "Construction batiment",
            "Fourniture informatique"
        )
        assert similarity < 0.5  # Some overlap due to shared letters

    def test_none_texts(self):
        """Should handle None values."""
        assert _text_similarity(None, "test") == 0.0
        assert _text_similarity("test", None) == 0.0
        assert _text_similarity(None, None) == 0.0


# ============================================================
# TEST: CPV Overlap
# ============================================================

class TestCpvOverlap:
    """Tests for _cpv_overlap function."""

    def test_identical_cpv(self):
        """Identical CPV lists should have overlap 1.0."""
        overlap = _cpv_overlap(["45210000"], ["45210000"])
        assert overlap == 1.0

    def test_overlapping_cpv(self):
        """Overlapping CPV should have partial overlap."""
        overlap = _cpv_overlap(
            ["45210000", "45310000"],
            ["45210000", "71000000"]
        )
        # Both have prefix "45", one has "71"
        assert overlap > 0.3

    def test_non_overlapping_cpv(self):
        """Non-overlapping CPV should have overlap 0."""
        overlap = _cpv_overlap(["45210000"], ["30200000"])
        assert overlap == 0.0

    def test_empty_cpv(self):
        """Empty CPV lists should have overlap 0."""
        assert _cpv_overlap([], ["45210000"]) == 0.0
        assert _cpv_overlap(["45210000"], []) == 0.0
        assert _cpv_overlap([], []) == 0.0


# ============================================================
# TEST: Scale Estimation
# ============================================================

class TestScaleEstimation:
    """Tests for _estimate_scale_from_cpv function."""

    def test_large_construction(self):
        """Complete construction should be Large."""
        scale = _estimate_scale_from_cpv(["45210000"])  # Building construction
        assert scale == "Large"

    def test_mega_preparation(self):
        """Site preparation should be Mega."""
        scale = _estimate_scale_from_cpv(["45110000"])  # Site prep
        assert scale == "Mega"

    def test_default_medium(self):
        """Other codes should default to Medium."""
        scale = _estimate_scale_from_cpv(["45310000"])  # Electrical work
        assert scale == "Medium"

    def test_empty_cpv(self):
        """Empty CPV should default to Medium."""
        scale = _estimate_scale_from_cpv([])
        assert scale == "Medium"


# ============================================================
# TEST: BoampTender Model
# ============================================================

class TestBoampTenderModel:
    """Tests for the BoampTender Pydantic model."""

    def test_create_valid_tender(self, sample_tender):
        """Should create a valid tender."""
        assert sample_tender.external_id == "24-123456"
        assert sample_tender.status == "published"
        assert len(sample_tender.cpv_codes) == 2

    def test_default_values(self):
        """Should use default values."""
        tender = BoampTender(external_id="test")

        assert tender.status == "published"
        assert tender.cpv_codes == []
        assert tender.raw_data == {}

    def test_tender_with_dates(self, sample_tender):
        """Should handle datetime fields correctly."""
        assert sample_tender.published_at is not None
        assert sample_tender.deadline_at is not None
        assert sample_tender.deadline_at > sample_tender.published_at


# ============================================================
# TEST: TenderIngestionResult Model
# ============================================================

class TestTenderIngestionResultModel:
    """Tests for the TenderIngestionResult Pydantic model."""

    def test_create_result(self):
        """Should create a valid result."""
        result = TenderIngestionResult(
            tender_id=uuid4(),
            project_id=uuid4(),
            created_project=True,
            created_tender=True,
        )

        assert result.created_project is True
        assert result.reused_project is False
        assert result.created_tender is True

    def test_default_values(self):
        """Should use default values."""
        result = TenderIngestionResult(tender_id=uuid4())

        assert result.project_id is None
        assert result.created_project is False
        assert result.reused_project is False
        assert result.created_tender is False


# ============================================================
# TEST: Integration Scenarios
# ============================================================

class TestIntegrationScenarios:
    """Integration tests for common scenarios."""

    def test_full_tender_parse_and_validate(self, sample_boamp_record):
        """Test complete parsing and validation flow."""
        # Parse the record
        tender = _parse_tender_record(sample_boamp_record)
        assert tender is not None

        # Validate it's BTP relevant
        is_btp = _is_btp_relevant(sample_boamp_record["fields"])
        assert is_btp is True

        # Check scale estimation
        scale = _estimate_scale_from_cpv(tender.cpv_codes)
        assert scale in ["Small", "Medium", "Large", "Mega"]

    def test_tender_matching_simulation(self, sample_tender):
        """Simulate project matching logic."""
        # Simulate an existing project
        existing_project = {
            "name": "Renovation ecole Jean Moulin",
            "sector_tags": ["45210000"],
            "location_city": "Lyon",
        }

        # Calculate similarity
        title_sim = _text_similarity(sample_tender.title, existing_project["name"])
        cpv_sim = _cpv_overlap(sample_tender.cpv_codes, existing_project["sector_tags"])
        city_sim = _text_similarity(sample_tender.location_city, existing_project["location_city"])

        # Combined score (simplified)
        score = title_sim * 0.5 + cpv_sim * 0.3 + city_sim * 0.2

        # Should be a decent match
        assert score > 0.3


# ============================================================
# TEST: Edge Cases
# ============================================================

class TestEdgeCases:
    """Tests for edge cases and error handling."""

    def test_parse_malformed_record(self):
        """Should handle malformed records gracefully."""
        # Empty record
        result = _parse_tender_record({})
        # Should return None or a minimal tender
        # The function should not raise an exception

    def test_parse_record_with_unicode(self):
        """Should handle Unicode in tender data."""
        record = {
            "fields": {
                "idannonce": "24-000001",
                "objet": "Rénovation du bâtiment François-Mitterrand",
                "ville": "Saint-Étienne",
            }
        }

        tender = _parse_tender_record(record)
        assert tender is not None
        assert "François-Mitterrand" in tender.title

    def test_cpv_with_invalid_format(self):
        """Should handle invalid CPV formats."""
        # Short CPV code
        overlap = _cpv_overlap(["45"], ["45210000"])
        # Should not crash, may return 0 or partial overlap

        # Empty string CPV
        overlap = _cpv_overlap([""], ["45210000"])
        assert overlap == 0.0

    def test_similarity_with_special_chars(self):
        """Should handle special characters in text."""
        similarity = _text_similarity(
            "Travaux d'aménagement & rénovation",
            "Travaux d'amenagement et renovation"
        )
        # Should still find similarity despite accent differences
        assert similarity > 0.5


# ============================================================
# TEST: Summary Models
# ============================================================

class TestSummaryModels:
    """Tests for summary Pydantic models."""

    def test_tender_fetch_summary(self):
        """Should create valid fetch summary."""
        summary = TenderFetchSummary(
            region="Ile-de-France",
            lookback_days=7,
            total_fetched=50,
            btp_relevant=25,
        )

        assert summary.region == "Ile-de-France"
        assert summary.total_fetched == 50
        assert summary.btp_relevant == 25

    def test_tender_ingestion_summary(self):
        """Should create valid ingestion summary."""
        summary = TenderIngestionSummary(
            tenant_id=uuid4(),
            total_tenders=10,
            new_projects=5,
            reused_projects=3,
            new_tenders=8,
            new_organizations=4,
            failed=2,
        )

        assert summary.total_tenders == 10
        assert summary.new_projects == 5
        assert summary.failed == 2


# ============================================================
# TEST: Mock API Responses
# ============================================================

class TestMockApiResponses:
    """Tests with mocked API responses."""

    @pytest.mark.asyncio
    async def test_fetch_handles_empty_response(self):
        """Should handle empty API response."""
        with patch("services.shark_boamp_service.httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"records": []}

            mock_client_instance = AsyncMock()
            mock_client_instance.get.return_value = mock_response
            mock_client_instance.__aenter__.return_value = mock_client_instance
            mock_client_instance.__aexit__.return_value = None
            mock_client.return_value = mock_client_instance

            from services.shark_boamp_service import fetch_recent_tenders_for_region

            tenders, summary = await fetch_recent_tenders_for_region("Test", 7)

            assert len(tenders) == 0
            assert summary.total_fetched == 0

    @pytest.mark.asyncio
    async def test_fetch_handles_api_error(self):
        """Should handle API errors gracefully."""
        with patch("services.shark_boamp_service.httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 500

            mock_client_instance = AsyncMock()
            mock_client_instance.get.return_value = mock_response
            mock_client_instance.__aenter__.return_value = mock_client_instance
            mock_client_instance.__aexit__.return_value = None
            mock_client.return_value = mock_client_instance

            from services.shark_boamp_service import fetch_recent_tenders_for_region

            tenders, summary = await fetch_recent_tenders_for_region("Test", 7)

            # Should return empty list, not raise exception
            assert len(tenders) == 0
            assert len(summary.errors) > 0


# ============================================================
# RUN TESTS
# ============================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
