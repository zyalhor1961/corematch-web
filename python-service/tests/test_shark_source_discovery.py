"""
Tests for Shark Source Discovery Service

Tests the Exa API integration for BTP article discovery.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta, timezone
from uuid import UUID

from services.shark_source_discovery import (
    DiscoveredArticle,
    DiscoveryContext,
    ArticleSource,
    TenantZoneConfig,
    build_exa_query_for_tenant_zone,
    extract_domain,
    get_source_name_from_url,
    _query_exa_news,
    discover_urls_for_tenant_zone,
    discover_daily_urls_for_tenant,
    convert_to_article_sources,
)


# ============================================================
# TEST DATA
# ============================================================

MOCK_EXA_RESPONSE = {
    "results": [
        {
            "url": "https://www.lemoniteur.fr/article/chantier-toulouse-2024",
            "title": "Nouveau chantier à Toulouse : 200 logements en construction",
            "publishedDate": "2024-11-28T10:00:00Z",
            "text": "Un nouveau programme immobilier voit le jour à Toulouse...",
            "score": 0.95,
        },
        {
            "url": "https://www.batiactu.com/edito/renovation-metro-toulouse",
            "title": "Rénovation de la ligne B du métro de Toulouse",
            "publishedDate": "2024-11-27T14:30:00Z",
            "text": "Les travaux de rénovation de la ligne B débutent...",
            "score": 0.88,
        },
        {
            "url": "https://www.actu.fr/occitanie/toulouse/construction-ecole",
            "title": "Construction d'une nouvelle école dans le quartier Borderouge",
            "publishedDate": "2024-11-26T09:15:00Z",
            "text": "La mairie de Toulouse lance la construction d'une école...",
            "score": 0.82,
        },
    ]
}

TEST_TENANT_ID = UUID("00000000-0000-0000-0000-000000000001")


# ============================================================
# UTILITY FUNCTION TESTS
# ============================================================

class TestExtractDomain:
    """Tests for extract_domain function."""

    def test_simple_url(self):
        assert extract_domain("https://www.lemoniteur.fr/article/test") == "lemoniteur.fr"

    def test_url_without_www(self):
        assert extract_domain("https://batiactu.com/edito/test") == "batiactu.com"

    def test_url_with_subdomain(self):
        assert extract_domain("https://news.batiactu.com/article") == "news.batiactu.com"

    def test_invalid_url(self):
        assert extract_domain("not-a-url") == "unknown"

    def test_empty_string(self):
        assert extract_domain("") == "unknown"


class TestGetSourceNameFromUrl:
    """Tests for get_source_name_from_url function."""

    def test_known_source_lemoniteur(self):
        url = "https://www.lemoniteur.fr/article/test"
        assert get_source_name_from_url(url) == "Le Moniteur"

    def test_known_source_batiactu(self):
        url = "https://batiactu.com/edito/test"
        assert get_source_name_from_url(url) == "Batiactu"

    def test_known_source_ouest_france(self):
        url = "https://www.ouest-france.fr/bretagne/article"
        assert get_source_name_from_url(url) == "Ouest-France"

    def test_unknown_source_fallback(self):
        url = "https://www.unknown-news-site.com/article"
        result = get_source_name_from_url(url)
        assert result == "Unknown News Site"

    def test_url_with_subdomain(self):
        url = "https://news.lemoniteur.fr/article"
        assert get_source_name_from_url(url) == "Le Moniteur"


# ============================================================
# QUERY BUILDER TESTS
# ============================================================

class TestBuildExaQuery:
    """Tests for build_exa_query_for_tenant_zone function."""

    def test_welcome_mode_with_city_and_region(self):
        query = build_exa_query_for_tenant_zone(
            city="Toulouse",
            region="Occitanie",
            country="France",
            lookback_days=30,
            mode="welcome",
        )

        # Check location is interpolated
        assert "Toulouse, Occitanie, France" in query
        # Check welcome-specific keywords
        assert "building sites" in query or "chantier" in query
        assert "real estate development" in query or "programme immobilier" in query
        # Check exclusions
        assert "job offers" in query or "offre d'emploi" in query
        # Should NOT have daily-specific keywords
        assert "Very recent" not in query

    def test_daily_mode_with_city_and_region(self):
        query = build_exa_query_for_tenant_zone(
            city="Lyon",
            region="Auvergne-Rhône-Alpes",
            country="France",
            lookback_days=3,
            mode="daily",
        )

        # Check location is interpolated
        assert "Lyon, Auvergne-Rhône-Alpes, France" in query
        # Check daily-specific keywords
        assert "Very recent" in query
        assert "works starting" in query or "débutent" in query
        assert "contracts awarded" in query or "marché attribué" in query
        # Check exclusions
        assert "job offers" in query or "offre d'emploi" in query

    def test_city_only(self):
        query = build_exa_query_for_tenant_zone(
            city="Paris",
            region=None,
            country="France",
            lookback_days=7,
            mode="welcome",
        )

        assert "Paris, France" in query
        assert "Occitanie" not in query

    def test_region_only(self):
        query = build_exa_query_for_tenant_zone(
            city=None,
            region="Bretagne",
            country="France",
            lookback_days=7,
            mode="welcome",
        )

        assert "Bretagne, France" in query

    def test_country_only_fallback(self):
        query = build_exa_query_for_tenant_zone(
            city=None,
            region=None,
            country="France",
            lookback_days=7,
            mode="welcome",
        )

        # Should use country as fallback
        assert "France" in query

    def test_lookback_days_interpolation(self):
        query = build_exa_query_for_tenant_zone(
            city="Nice",
            region=None,
            country="France",
            lookback_days=14,
            mode="welcome",
        )

        assert "14 days" in query


# ============================================================
# EXA API QUERY TESTS (MOCKED)
# ============================================================

class TestQueryExaNews:
    """Tests for _query_exa_news function with mocked HTTP."""

    @pytest.mark.asyncio
    async def test_successful_query(self):
        """Test successful Exa API query."""
        with patch("services.shark_source_discovery.EXA_API_KEY", "test-key"):
            with patch("httpx.AsyncClient") as mock_client_class:
                # Setup mock response
                mock_response = MagicMock()
                mock_response.status_code = 200
                mock_response.json.return_value = MOCK_EXA_RESPONSE

                mock_client = AsyncMock()
                mock_client.post.return_value = mock_response
                mock_client.__aenter__.return_value = mock_client
                mock_client.__aexit__.return_value = None
                mock_client_class.return_value = mock_client

                articles = await _query_exa_news(
                    query="test query",
                    lookback_days=7,
                    limit=10,
                )

                assert len(articles) == 3
                assert articles[0].source_name == "Le Moniteur"
                assert articles[1].source_name == "Batiactu"
                assert articles[2].source_name == "Actu.fr"
                assert articles[0].score == 0.95

    @pytest.mark.asyncio
    async def test_no_api_key(self):
        """Test behavior when API key is missing."""
        with patch("services.shark_source_discovery.EXA_API_KEY", None):
            articles = await _query_exa_news(
                query="test query",
                lookback_days=7,
                limit=10,
            )

            assert articles == []

    @pytest.mark.asyncio
    async def test_api_error_401(self):
        """Test handling of authentication error."""
        with patch("services.shark_source_discovery.EXA_API_KEY", "bad-key"):
            with patch("httpx.AsyncClient") as mock_client_class:
                mock_response = MagicMock()
                mock_response.status_code = 401
                mock_response.text = "Unauthorized"

                mock_client = AsyncMock()
                mock_client.post.return_value = mock_response
                mock_client.__aenter__.return_value = mock_client
                mock_client.__aexit__.return_value = None
                mock_client_class.return_value = mock_client

                articles = await _query_exa_news(
                    query="test query",
                    lookback_days=7,
                    limit=10,
                )

                assert articles == []

    @pytest.mark.asyncio
    async def test_api_rate_limit_429(self):
        """Test handling of rate limit error."""
        with patch("services.shark_source_discovery.EXA_API_KEY", "test-key"):
            with patch("httpx.AsyncClient") as mock_client_class:
                mock_response = MagicMock()
                mock_response.status_code = 429
                mock_response.text = "Rate limited"

                mock_client = AsyncMock()
                mock_client.post.return_value = mock_response
                mock_client.__aenter__.return_value = mock_client
                mock_client.__aexit__.return_value = None
                mock_client_class.return_value = mock_client

                articles = await _query_exa_news(
                    query="test query",
                    lookback_days=7,
                    limit=10,
                )

                assert articles == []

    @pytest.mark.asyncio
    async def test_network_timeout(self):
        """Test handling of network timeout."""
        import httpx

        with patch("services.shark_source_discovery.EXA_API_KEY", "test-key"):
            with patch("httpx.AsyncClient") as mock_client_class:
                mock_client = AsyncMock()
                mock_client.post.side_effect = httpx.TimeoutException("Timeout")
                mock_client.__aenter__.return_value = mock_client
                mock_client.__aexit__.return_value = None
                mock_client_class.return_value = mock_client

                articles = await _query_exa_news(
                    query="test query",
                    lookback_days=7,
                    limit=10,
                )

                assert articles == []

    @pytest.mark.asyncio
    async def test_empty_results(self):
        """Test handling of empty results."""
        with patch("services.shark_source_discovery.EXA_API_KEY", "test-key"):
            with patch("httpx.AsyncClient") as mock_client_class:
                mock_response = MagicMock()
                mock_response.status_code = 200
                mock_response.json.return_value = {"results": []}

                mock_client = AsyncMock()
                mock_client.post.return_value = mock_response
                mock_client.__aenter__.return_value = mock_client
                mock_client.__aexit__.return_value = None
                mock_client_class.return_value = mock_client

                articles = await _query_exa_news(
                    query="test query",
                    lookback_days=7,
                    limit=10,
                )

                assert articles == []


# ============================================================
# MAIN DISCOVERY FUNCTION TESTS
# ============================================================

class TestDiscoverUrlsForTenantZone:
    """Tests for discover_urls_for_tenant_zone function."""

    @pytest.mark.asyncio
    async def test_with_city_and_region(self):
        """Test discovery with explicit city and region."""
        mock_articles = [
            DiscoveredArticle(
                source_url="https://example.com/article1",
                source_name="Example News",
                published_at=datetime.now(timezone.utc),
                title="Test Article",
            )
        ]

        with patch(
            "services.shark_source_discovery._query_exa_news",
            new_callable=AsyncMock,
            return_value=mock_articles,
        ) as mock_query:
            articles = await discover_urls_for_tenant_zone(
                tenant_id=TEST_TENANT_ID,
                city="Toulouse",
                region="Occitanie",
                limit=10,
                lookback_days=7,
                mode="welcome",
            )

            assert len(articles) == 1
            mock_query.assert_called_once()

    @pytest.mark.asyncio
    async def test_loads_tenant_config_when_no_location(self):
        """Test that tenant config is loaded when city/region not provided."""
        mock_config = TenantZoneConfig(
            tenant_id=TEST_TENANT_ID,
            city="Lyon",
            region="Auvergne-Rhône-Alpes",
            country="France",
        )

        with patch(
            "services.shark_source_discovery.get_tenant_zone_config",
            new_callable=AsyncMock,
            return_value=mock_config,
        ):
            with patch(
                "services.shark_source_discovery._query_exa_news",
                new_callable=AsyncMock,
                return_value=[],
            ) as mock_query:
                await discover_urls_for_tenant_zone(
                    tenant_id=TEST_TENANT_ID,
                    # No city/region provided
                    limit=10,
                    lookback_days=7,
                    mode="welcome",
                )

                # Verify _query_exa_news was called (config was loaded)
                mock_query.assert_called_once()


class TestDiscoverDailyUrlsForTenant:
    """Tests for discover_daily_urls_for_tenant function."""

    @pytest.mark.asyncio
    async def test_calls_discover_with_daily_mode(self):
        """Test that daily discovery uses mode='daily'."""
        with patch(
            "services.shark_source_discovery.get_tenant_zone_config",
            new_callable=AsyncMock,
            return_value=None,
        ):
            with patch(
                "services.shark_source_discovery.discover_urls_for_tenant_zone",
                new_callable=AsyncMock,
                return_value=[],
            ) as mock_discover:
                await discover_daily_urls_for_tenant(
                    tenant_id=TEST_TENANT_ID,
                    city="Paris",
                    region="Île-de-France",
                )

                mock_discover.assert_called_once()
                call_args = mock_discover.call_args
                assert call_args.kwargs["mode"] == "daily"
                assert call_args.kwargs["lookback_days"] == 3

    @pytest.mark.asyncio
    async def test_uses_tenant_daily_limit(self):
        """Test that daily limit from tenant config is used."""
        mock_config = TenantZoneConfig(
            tenant_id=TEST_TENANT_ID,
            city="Nice",
            region="PACA",
            country="France",
            daily_url_limit=8,
        )

        with patch(
            "services.shark_source_discovery.get_tenant_zone_config",
            new_callable=AsyncMock,
            return_value=mock_config,
        ):
            with patch(
                "services.shark_source_discovery.discover_urls_for_tenant_zone",
                new_callable=AsyncMock,
                return_value=[],
            ) as mock_discover:
                await discover_daily_urls_for_tenant(
                    tenant_id=TEST_TENANT_ID,
                    city="Nice",
                    region="PACA",
                )

                call_args = mock_discover.call_args
                assert call_args.kwargs["limit"] == 8

    @pytest.mark.asyncio
    async def test_limit_capping(self):
        """Test that limit is capped between 5-15."""
        mock_config = TenantZoneConfig(
            tenant_id=TEST_TENANT_ID,
            city="Bordeaux",
            region="Nouvelle-Aquitaine",
            country="France",
            daily_url_limit=50,  # Too high, should be capped
        )

        with patch(
            "services.shark_source_discovery.get_tenant_zone_config",
            new_callable=AsyncMock,
            return_value=mock_config,
        ):
            with patch(
                "services.shark_source_discovery.discover_urls_for_tenant_zone",
                new_callable=AsyncMock,
                return_value=[],
            ) as mock_discover:
                await discover_daily_urls_for_tenant(
                    tenant_id=TEST_TENANT_ID,
                    city="Bordeaux",
                    region="Nouvelle-Aquitaine",
                )

                call_args = mock_discover.call_args
                assert call_args.kwargs["limit"] == 15  # Capped at 15


# ============================================================
# CONVERSION FUNCTION TESTS
# ============================================================

class TestConvertToArticleSources:
    """Tests for convert_to_article_sources function."""

    def test_conversion(self):
        """Test conversion from DiscoveredArticle to ArticleSource."""
        articles = [
            DiscoveredArticle(
                source_url="https://example.com/1",
                source_name="Example 1",
                published_at=datetime(2024, 11, 28, 10, 0, 0),
                title="Title 1",
                snippet="Snippet 1",
                score=0.9,
            ),
            DiscoveredArticle(
                source_url="https://example.com/2",
                source_name="Example 2",
                published_at=datetime(2024, 11, 27, 14, 0, 0),
                title="Title 2",
                snippet=None,
                score=None,
            ),
        ]

        sources = convert_to_article_sources(articles)

        assert len(sources) == 2
        assert isinstance(sources[0], ArticleSource)
        assert sources[0].source_url == "https://example.com/1"
        assert sources[0].source_name == "Example 1"
        assert sources[0].discovery_method == "exa"
        assert sources[1].snippet is None


# ============================================================
# PYDANTIC MODEL TESTS
# ============================================================

class TestPydanticModels:
    """Tests for Pydantic model validation."""

    def test_discovered_article_creation(self):
        article = DiscoveredArticle(
            source_url="https://example.com/article",
            source_name="Example News",
            published_at=datetime.now(timezone.utc),
            title="Test Article",
            snippet="This is a test snippet...",
            score=0.85,
        )

        assert article.source_url == "https://example.com/article"
        assert article.score == 0.85

    def test_discovered_article_optional_fields(self):
        article = DiscoveredArticle(
            source_url="https://example.com/article",
            source_name="Example News",
            published_at=datetime.now(timezone.utc),
        )

        assert article.title is None
        assert article.snippet is None
        assert article.score is None

    def test_discovery_context_defaults(self):
        context = DiscoveryContext()

        assert context.tenant_id is None
        assert context.country == "France"
        assert context.radius_km == 50
        assert context.lookback_days == 30
        assert context.limit == 20
        assert context.mode == "welcome"

    def test_tenant_zone_config(self):
        config = TenantZoneConfig(
            tenant_id=TEST_TENANT_ID,
            city="Marseille",
            region="PACA",
        )

        assert config.tenant_id == TEST_TENANT_ID
        assert config.city == "Marseille"
        assert config.shark_enabled is True
        assert config.daily_url_limit == 10


# ============================================================
# INTEGRATION-STYLE TESTS (with mocked external calls)
# ============================================================

class TestIntegration:
    """Integration-style tests with mocked external dependencies."""

    @pytest.mark.asyncio
    async def test_full_welcome_scan_flow(self):
        """Test the full welcome scan discovery flow."""
        mock_exa_response = {
            "results": [
                {
                    "url": "https://www.lemoniteur.fr/article/test",
                    "title": "Projet BTP Toulouse",
                    "publishedDate": "2024-11-28T10:00:00Z",
                    "text": "Nouveau chantier de construction...",
                    "score": 0.92,
                },
            ]
        }

        with patch("services.shark_source_discovery.EXA_API_KEY", "test-key"):
            with patch("httpx.AsyncClient") as mock_client_class:
                mock_response = MagicMock()
                mock_response.status_code = 200
                mock_response.json.return_value = mock_exa_response

                mock_client = AsyncMock()
                mock_client.post.return_value = mock_response
                mock_client.__aenter__.return_value = mock_client
                mock_client.__aexit__.return_value = None
                mock_client_class.return_value = mock_client

                articles = await discover_urls_for_tenant_zone(
                    tenant_id=TEST_TENANT_ID,
                    city="Toulouse",
                    region="Occitanie",
                    limit=20,
                    lookback_days=30,
                    mode="welcome",
                )

                assert len(articles) == 1
                assert articles[0].source_name == "Le Moniteur"
                assert articles[0].title == "Projet BTP Toulouse"
                assert articles[0].score == 0.92

    @pytest.mark.asyncio
    async def test_full_daily_scan_flow(self):
        """Test the full daily scan discovery flow."""
        mock_exa_response = {
            "results": [
                {
                    "url": "https://www.batiactu.com/article/new",
                    "title": "Travaux débutent à Lyon",
                    "publishedDate": "2024-11-29T08:00:00Z",
                    "text": "Les travaux de rénovation débutent...",
                    "score": 0.88,
                },
            ]
        }

        mock_config = TenantZoneConfig(
            tenant_id=TEST_TENANT_ID,
            city="Lyon",
            region="Auvergne-Rhône-Alpes",
            country="France",
            daily_url_limit=10,
        )

        with patch("services.shark_source_discovery.EXA_API_KEY", "test-key"):
            with patch(
                "services.shark_source_discovery.get_tenant_zone_config",
                new_callable=AsyncMock,
                return_value=mock_config,
            ):
                with patch("httpx.AsyncClient") as mock_client_class:
                    mock_response = MagicMock()
                    mock_response.status_code = 200
                    mock_response.json.return_value = mock_exa_response

                    mock_client = AsyncMock()
                    mock_client.post.return_value = mock_response
                    mock_client.__aenter__.return_value = mock_client
                    mock_client.__aexit__.return_value = None
                    mock_client_class.return_value = mock_client

                    articles = await discover_daily_urls_for_tenant(
                        tenant_id=TEST_TENANT_ID,
                        city="Lyon",
                        region="Auvergne-Rhône-Alpes",
                    )

                    assert len(articles) == 1
                    assert articles[0].source_name == "Batiactu"
