"""
Shark Source Discovery Service

Service de decouverte de nouvelles URLs d'articles BTP.

Ce module integre:
- Exa API (recherche semantique) - PRINCIPAL
- Flux RSS de sources BTP (TODO)
- Sources statiques (FALLBACK)

Usage:
    from services.shark_source_discovery import discover_recent_articles, ArticleSource

    sources = await discover_recent_articles(
        lookback_days=3,
        max_urls=30
    )

    # Zone-based discovery for Welcome Scan
    from services.shark_source_discovery import discover_urls_for_tenant_zone

    sources = await discover_urls_for_tenant_zone(
        tenant_id=UUID("..."),
        limit=20
    )
"""

import os
import asyncio
import re
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from uuid import UUID
from urllib.parse import urlparse

from pydantic import BaseModel
from loguru import logger
from supabase import create_client, Client

# Exa API client
try:
    from exa_py import Exa
    EXA_AVAILABLE = True
except ImportError:
    EXA_AVAILABLE = False
    logger.warning("[Discovery] exa_py not installed - Exa discovery disabled")


# ============================================================
# MODELS
# ============================================================

class DiscoveredArticle(BaseModel):
    """Article decouvert via Exa ou autre source."""
    source_url: str
    source_name: str
    published_at: datetime
    title: Optional[str] = None
    snippet: Optional[str] = None


class ArticleSource(BaseModel):
    """Source d'article decouverte (format legacy compatible)."""
    source_url: str
    source_name: str
    published_at: Optional[datetime] = None
    title: Optional[str] = None
    snippet: Optional[str] = None
    discovery_method: str = "static"  # static, exa, rss, scrape


class DiscoveryConfig(BaseModel):
    """Configuration pour la decouverte."""
    exa_api_key: Optional[str] = None
    exa_enabled: bool = False
    rss_enabled: bool = False
    static_enabled: bool = True
    priority_domains: List[str] = [
        "lemoniteur.fr",
        "batiactu.com",
        "batiweb.com",
        "constructioncayola.com",
        "boamp.fr",
    ]


# ============================================================
# STATIC SOURCES (FALLBACK)
# ============================================================

STATIC_DEMO_SOURCES = [
    ArticleSource(
        source_url="https://www.lemoniteur.fr/article/actualites-btp",
        source_name="Le Moniteur",
        discovery_method="static",
    ),
    ArticleSource(
        source_url="https://www.batiactu.com/edito/actualites.php",
        source_name="Batiactu",
        discovery_method="static",
    ),
]


# ============================================================
# DOMAIN / SOURCE NAME UTILITIES
# ============================================================

# Known BTP news sources with friendly names
KNOWN_SOURCES: Dict[str, str] = {
    "lemoniteur.fr": "Le Moniteur",
    "batiactu.com": "Batiactu",
    "batiweb.com": "BatiWeb",
    "constructioncayola.com": "Construction Cayola",
    "boamp.fr": "BOAMP",
    "actu.fr": "Actu.fr",
    "ouest-france.fr": "Ouest-France",
    "ladepeche.fr": "La Depeche",
    "sudouest.fr": "Sud Ouest",
    "laprovence.com": "La Provence",
    "leparisien.fr": "Le Parisien",
    "lefigaro.fr": "Le Figaro",
    "lesechos.fr": "Les Echos",
    "latribune.fr": "La Tribune",
    "bfmtv.com": "BFM TV",
    "francetvinfo.fr": "France Info",
    "20minutes.fr": "20 Minutes",
    "midilibre.fr": "Midi Libre",
    "lavoixdunord.fr": "La Voix du Nord",
    "estrepublicain.fr": "L'Est Republicain",
    "dna.fr": "DNA",
    "leprogres.fr": "Le Progres",
    "lyonmag.com": "Lyon Mag",
    "marseillenews.net": "Marseille News",
    "nicematin.com": "Nice-Matin",
    "lagazettedescommunes.com": "La Gazette des Communes",
    "localtis.info": "Localtis",
}


def extract_domain(url: str) -> str:
    """Extract the domain from a URL."""
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        # Remove www. prefix
        if domain.startswith("www."):
            domain = domain[4:]
        return domain
    except Exception:
        return "unknown"


def get_source_name_from_url(url: str) -> str:
    """
    Get a friendly source name from URL.

    Checks against known sources, otherwise returns cleaned domain.
    """
    domain = extract_domain(url)

    # Check known sources
    for known_domain, friendly_name in KNOWN_SOURCES.items():
        if known_domain in domain:
            return friendly_name

    # Fallback: clean up domain
    # Remove TLD and capitalize
    parts = domain.split(".")
    if len(parts) >= 2:
        name = parts[-2]  # Get the main part
        # Capitalize and clean
        return name.replace("-", " ").title()

    return domain.title()


# ============================================================
# EXA API DISCOVERY (REAL IMPLEMENTATION)
# ============================================================

# Initialize Exa client (module level, lazy)
_exa_client: Optional[Any] = None


def get_exa_client():
    """Get or create Exa client."""
    global _exa_client

    if not EXA_AVAILABLE:
        return None

    if _exa_client is None:
        api_key = os.getenv("EXA_API_KEY")
        if api_key:
            try:
                _exa_client = Exa(api_key=api_key)
                logger.info("[EXA] Client initialized")
            except Exception as e:
                logger.error(f"[EXA] Failed to initialize client: {e}")
                return None

    return _exa_client


def build_btp_search_query(
    city: Optional[str] = None,
    region: Optional[str] = None,
    country: str = "FR",
) -> str:
    """
    Build a search query for BTP/construction news.

    Args:
        city: Target city
        region: Target region
        country: Country code

    Returns:
        Search query string optimized for Exa
    """
    # Base construction/BTP keywords
    base_keywords = [
        "projet construction",
        "chantier",
        "renovation",
        "travaux",
        "appel offres BTP",
        "permis construire",
        "inauguration",
    ]

    # Location parts
    location_parts = []
    if city:
        location_parts.append(city)
    if region:
        location_parts.append(region)
    if not location_parts and country == "FR":
        location_parts.append("France")

    location_str = " ".join(location_parts)

    # Build query
    # Format: "construction OR chantier OR renovation {location}"
    query = f"({' OR '.join(base_keywords[:3])}) {location_str}"

    return query


async def discover_via_exa(
    query: str,
    lookback_days: int,
    max_results: int,
    api_key: Optional[str] = None,
) -> List[ArticleSource]:
    """
    Discover articles via Exa API.

    Uses the exa_py library to search for recent BTP news articles.

    Args:
        query: Search query (e.g., "projet construction Lyon")
        lookback_days: Number of days to look back
        max_results: Maximum number of results
        api_key: Optional API key override

    Returns:
        List of ArticleSource discovered
    """
    exa = get_exa_client()

    if not exa:
        logger.warning("[EXA] Client not available (missing EXA_API_KEY?)")
        return []

    # Calculate date filter
    start_date = (datetime.now() - timedelta(days=lookback_days)).strftime("%Y-%m-%d")

    logger.info(f"[EXA] Searching: '{query[:80]}...' (since {start_date})")

    try:
        # Call Exa API
        # Note: exa_py is synchronous, so we run in executor
        loop = asyncio.get_event_loop()

        def do_search():
            return exa.search_and_contents(
                query,
                num_results=max_results,
                text=True,
                start_published_date=start_date,
            )

        results = await loop.run_in_executor(None, do_search)

        if not results or not results.results:
            logger.info("[EXA] No results found")
            return []

        logger.info(f"[EXA] Found {len(results.results)} results")

        # Convert to ArticleSource
        sources: List[ArticleSource] = []

        for result in results.results:
            try:
                # Extract published date
                published_at = datetime.utcnow()  # Default
                if hasattr(result, 'published_date') and result.published_date:
                    try:
                        # Exa returns ISO format dates
                        published_at = datetime.fromisoformat(
                            result.published_date.replace("Z", "+00:00")
                        )
                    except (ValueError, AttributeError):
                        pass

                # Get source name
                source_name = get_source_name_from_url(result.url)

                # Get snippet (first 500 chars of text)
                snippet = None
                if hasattr(result, 'text') and result.text:
                    snippet = result.text[:500].strip()
                    if len(result.text) > 500:
                        snippet += "..."

                # Get title
                title = None
                if hasattr(result, 'title') and result.title:
                    title = result.title.strip()

                sources.append(ArticleSource(
                    source_url=result.url,
                    source_name=source_name,
                    published_at=published_at,
                    title=title,
                    snippet=snippet,
                    discovery_method="exa",
                ))

            except Exception as e:
                logger.warning(f"[EXA] Failed to parse result: {e}")
                continue

        logger.info(f"[EXA] Returning {len(sources)} valid sources")
        return sources

    except Exception as e:
        logger.error(f"[EXA] Search failed: {e}")
        return []


async def discover_via_exa_for_zone(
    city: Optional[str] = None,
    region: Optional[str] = None,
    country: str = "FR",
    radius_km: int = 50,
    limit: int = 20,
    lookback_days: int = 30,
) -> List[DiscoveredArticle]:
    """
    Discover BTP articles for a specific geographic zone via Exa.

    This is the main function for Welcome Scan discovery.

    Args:
        city: Target city
        region: Target region
        country: Country code (default: FR)
        radius_km: Search radius (for future use)
        limit: Max number of articles
        lookback_days: Days to look back

    Returns:
        List of DiscoveredArticle
    """
    exa = get_exa_client()

    if not exa:
        logger.warning("[EXA] Client not available - returning empty list")
        return []

    # Build location string
    location_parts = []
    if city:
        location_parts.append(city)
    if region:
        location_parts.append(region)

    location_str = ", ".join(location_parts) if location_parts else "France"

    # Build search query
    # Focus on recent news about construction/BTP projects
    query = f"""
    Recent news articles about construction or renovation projects in {location_str}.
    Focus on BTP, public works, real estate development, major building projects,
    infrastructure, urban renovation, and construction permits.
    """.strip().replace("\n", " ")

    # Calculate date filter
    start_date = (datetime.now() - timedelta(days=lookback_days)).strftime("%Y-%m-%d")

    logger.info(f"[EXA Zone] Searching for BTP news in {location_str} (since {start_date})")

    try:
        # Call Exa API
        loop = asyncio.get_event_loop()

        def do_search():
            return exa.search_and_contents(
                query,
                num_results=limit,
                text=True,
                start_published_date=start_date,
            )

        results = await loop.run_in_executor(None, do_search)

        if not results or not results.results:
            logger.info("[EXA Zone] No results found")
            return []

        logger.info(f"[EXA Zone] Found {len(results.results)} results")

        # Convert to DiscoveredArticle
        articles: List[DiscoveredArticle] = []

        for result in results.results:
            try:
                # Extract published date
                published_at = datetime.utcnow()
                if hasattr(result, 'published_date') and result.published_date:
                    try:
                        published_at = datetime.fromisoformat(
                            result.published_date.replace("Z", "+00:00")
                        )
                    except (ValueError, AttributeError):
                        pass

                # Get source name
                source_name = get_source_name_from_url(result.url)

                # Get snippet
                snippet = None
                if hasattr(result, 'text') and result.text:
                    snippet = result.text[:500].strip()
                    if len(result.text) > 500:
                        snippet += "..."

                # Get title
                title = None
                if hasattr(result, 'title') and result.title:
                    title = result.title.strip()

                articles.append(DiscoveredArticle(
                    source_url=result.url,
                    source_name=source_name,
                    published_at=published_at,
                    title=title,
                    snippet=snippet,
                ))

            except Exception as e:
                logger.warning(f"[EXA Zone] Failed to parse result: {e}")
                continue

        logger.info(f"[EXA Zone] Returning {len(articles)} articles for {location_str}")
        return articles

    except Exception as e:
        logger.error(f"[EXA Zone] Search failed: {e}")
        return []


# ============================================================
# RSS DISCOVERY (TODO)
# ============================================================

RSS_FEEDS = [
    {"name": "Le Moniteur", "url": "https://www.lemoniteur.fr/rss/actualites.xml", "enabled": False},
    {"name": "Batiactu", "url": "https://www.batiactu.com/rss/actualites.xml", "enabled": False},
    {"name": "Construction Cayola", "url": "https://www.constructioncayola.com/rss.xml", "enabled": False},
]


async def discover_via_rss(lookback_days: int, max_per_feed: int = 10) -> List[ArticleSource]:
    """Discover articles via RSS feeds. TODO: Implement."""
    logger.info("[RSS] Discovery not yet implemented")
    return []


# ============================================================
# MAIN DISCOVERY FUNCTION
# ============================================================

async def discover_recent_articles(
    lookback_days: int = 3,
    max_urls: int = 30,
    config: Optional[DiscoveryConfig] = None,
) -> List[ArticleSource]:
    """
    Discover recent BTP articles.

    Combines multiple discovery methods:
    1. Exa API (if configured) - PRIMARY
    2. RSS feeds (if configured)
    3. Static sources (fallback)
    """
    if config is None:
        config = DiscoveryConfig(
            exa_api_key=os.getenv("EXA_API_KEY"),
            exa_enabled=bool(os.getenv("EXA_API_KEY")),
        )

    sources: List[ArticleSource] = []

    logger.info(f"[Discovery] Looking for articles from last {lookback_days} days, max {max_urls}")

    # 1. Try Exa if enabled
    if config.exa_enabled and config.exa_api_key:
        try:
            exa_sources = await discover_via_exa(
                query="projet construction BTP batiment France chantier renovation",
                lookback_days=lookback_days,
                max_results=max_urls,
                api_key=config.exa_api_key,
            )
            sources.extend(exa_sources)
            logger.info(f"[Discovery] Found {len(exa_sources)} via Exa")
        except Exception as e:
            logger.error(f"[Discovery] Exa error: {e}")

    # 2. Try RSS if enabled
    if config.rss_enabled:
        try:
            rss_sources = await discover_via_rss(
                lookback_days=lookback_days,
                max_per_feed=max_urls // len(RSS_FEEDS) if RSS_FEEDS else 10,
            )
            sources.extend(rss_sources)
            logger.info(f"[Discovery] Found {len(rss_sources)} via RSS")
        except Exception as e:
            logger.error(f"[Discovery] RSS error: {e}")

    # 3. Static fallback if not enough sources
    if config.static_enabled and len(sources) < max_urls:
        remaining = max_urls - len(sources)
        static_sources = STATIC_DEMO_SOURCES[:remaining]
        sources.extend(static_sources)
        logger.info(f"[Discovery] Added {len(static_sources)} static sources")

    # Dedupe by URL
    seen_urls = set()
    unique_sources = []
    for source in sources:
        if source.source_url not in seen_urls:
            seen_urls.add(source.source_url)
            unique_sources.append(source)

    logger.info(f"[Discovery] Total unique sources: {len(unique_sources)}")
    return unique_sources[:max_urls]


# ============================================================
# MANUAL SOURCE ADDITION
# ============================================================

async def add_manual_sources(urls: List[str], source_name: str = "Manual") -> List[ArticleSource]:
    """Create ArticleSource from manual URL list."""
    sources = []
    for url in urls:
        detected_name = get_source_name_from_url(url)
        if detected_name.lower() == "unknown":
            detected_name = source_name

        sources.append(ArticleSource(
            source_url=url,
            source_name=detected_name,
            published_at=datetime.utcnow(),
            discovery_method="manual",
        ))
    return sources


# ============================================================
# SUPABASE CLIENT
# ============================================================

_supabase: Optional[Client] = None


def get_supabase() -> Client:
    """Get or create Supabase client."""
    global _supabase
    if _supabase is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_KEY")
        if not url or not key:
            raise RuntimeError("Supabase not configured")
        _supabase = create_client(url, key)
    return _supabase


# ============================================================
# TENANT ZONE CONFIG
# ============================================================

class TenantZoneConfig(BaseModel):
    """Configuration de zone geographique d'un tenant."""
    tenant_id: UUID
    city: Optional[str] = None
    region: Optional[str] = None
    country: str = "FR"
    lat: Optional[float] = None
    lon: Optional[float] = None
    search_radius_km: int = 50
    shark_enabled: bool = True
    daily_url_limit: int = 10


async def get_tenant_zone_config(tenant_id: UUID) -> Optional[TenantZoneConfig]:
    """Retrieve zone configuration for a tenant."""
    try:
        supabase = get_supabase()
        result = supabase.table("shark_tenant_settings") \
            .select("*") \
            .eq("tenant_id", str(tenant_id)) \
            .execute()

        if result.data and len(result.data) > 0:
            row = result.data[0]
            return TenantZoneConfig(
                tenant_id=UUID(row["tenant_id"]),
                city=row.get("city"),
                region=row.get("region"),
                country=row.get("country", "FR"),
                lat=float(row["lat"]) if row.get("lat") else None,
                lon=float(row["lon"]) if row.get("lon") else None,
                search_radius_km=row.get("search_radius_km", 50),
                shark_enabled=row.get("shark_enabled", True),
                daily_url_limit=row.get("daily_url_limit", 10),
            )
        return None
    except Exception as e:
        logger.error(f"[Discovery] Failed to get tenant zone config: {e}")
        return None


async def get_all_enabled_tenants() -> List[TenantZoneConfig]:
    """Retrieve all tenants with Shark enabled."""
    try:
        supabase = get_supabase()
        result = supabase.table("shark_tenant_settings") \
            .select("*") \
            .eq("shark_enabled", True) \
            .execute()

        configs = []
        for row in result.data or []:
            configs.append(TenantZoneConfig(
                tenant_id=UUID(row["tenant_id"]),
                city=row.get("city"),
                region=row.get("region"),
                country=row.get("country", "FR"),
                lat=float(row["lat"]) if row.get("lat") else None,
                lon=float(row["lon"]) if row.get("lon") else None,
                search_radius_km=row.get("search_radius_km", 50),
                shark_enabled=True,
                daily_url_limit=row.get("daily_url_limit", 10),
            ))
        logger.info(f"[Discovery] Found {len(configs)} enabled tenants")
        return configs
    except Exception as e:
        logger.error(f"[Discovery] Failed to get enabled tenants: {e}")
        return []


# ============================================================
# ZONE-BASED DISCOVERY (MAIN FUNCTION)
# ============================================================

async def discover_urls_for_tenant_zone(
    tenant_id: UUID,
    city: Optional[str] = None,
    region: Optional[str] = None,
    country: str = "FR",
    radius_km: int = 50,
    limit: int = 20,
    lookback_days: int = 30,
) -> List[ArticleSource]:
    """
    Discover BTP article URLs for a tenant's geographic zone.

    This is the main discovery function for Welcome Scan and Daily Ingestion.
    It uses Exa API as the primary source, with static fallback.

    Args:
        tenant_id: UUID of the tenant
        city: Target city (override, otherwise from tenant config)
        region: Target region (override, otherwise from tenant config)
        country: Country code (default: FR)
        radius_km: Search radius in km
        limit: Maximum URLs to return
        lookback_days: Days to look back (default: 30 for Welcome Scan)

    Returns:
        List of ArticleSource for ingestion
    """
    logger.info(f"[Discovery] Discovering URLs for tenant {tenant_id}, limit={limit}")

    # Get tenant zone config if city/region not provided
    if not city and not region:
        zone_config = await get_tenant_zone_config(tenant_id)
        if zone_config:
            city = zone_config.city
            region = zone_config.region
            country = zone_config.country
            radius_km = zone_config.search_radius_km

    if not city and not region:
        logger.warning(f"[Discovery] No geographic zone for tenant {tenant_id}")
        return []

    logger.info(f"[Discovery] Zone: city={city}, region={region}, country={country}")

    sources: List[ArticleSource] = []

    # 1. Try Exa API (PRIMARY)
    exa_key = os.getenv("EXA_API_KEY")
    if exa_key:
        try:
            # Use the zone-specific Exa discovery
            discovered = await discover_via_exa_for_zone(
                city=city,
                region=region,
                country=country,
                radius_km=radius_km,
                limit=limit,
                lookback_days=lookback_days,
            )

            # Convert DiscoveredArticle to ArticleSource
            for article in discovered:
                sources.append(ArticleSource(
                    source_url=article.source_url,
                    source_name=article.source_name,
                    published_at=article.published_at,
                    title=article.title,
                    snippet=article.snippet,
                    discovery_method="exa",
                ))

            logger.info(f"[Discovery] Found {len(sources)} via Exa for zone")

        except Exception as e:
            logger.error(f"[Discovery] Exa zone search failed: {e}")
    else:
        logger.warning("[Discovery] EXA_API_KEY not set - Exa discovery disabled")

    # 2. If no Exa results, return empty (no more static fallback for zone search)
    # This ensures we only ingest REAL articles, not mock URLs
    if not sources:
        logger.warning(f"[Discovery] No articles found for zone {city}, {region}")
        return []

    # Dedupe by URL
    seen_urls = set()
    unique_sources = []
    for s in sources:
        if s.source_url not in seen_urls:
            seen_urls.add(s.source_url)
            unique_sources.append(s)

    logger.info(f"[Discovery] Returning {len(unique_sources)} unique sources for tenant {tenant_id}")
    return unique_sources[:limit]


async def discover_daily_urls_for_tenant(
    tenant_id: UUID,
    limit: Optional[int] = None,
    lookback_days: int = 3,
) -> List[ArticleSource]:
    """
    Discover URLs for a tenant's daily ingestion run.

    Reuses discover_urls_for_tenant_zone with Exa API discovery.
    Default parameters optimized for daily runs:
    - lookback_days: 3 (catches weekend articles)
    - limit: from tenant config (daily_url_limit, default 10)

    Args:
        tenant_id: UUID of the tenant
        limit: Override URL limit (default: from tenant config)
        lookback_days: Days to look back (default: 3)

    Returns:
        List of ArticleSource for ingestion
    """
    zone_config = await get_tenant_zone_config(tenant_id)

    # Use tenant's daily_url_limit or default to 10
    if limit is None:
        limit = zone_config.daily_url_limit if zone_config else 10

    # Cap limit to reasonable range (5-15)
    limit = max(5, min(limit, 15))

    logger.info(
        f"[DailyDiscovery] tenant={tenant_id}, limit={limit}, lookback={lookback_days}d"
    )

    # Reuse zone-based Exa discovery
    sources = await discover_urls_for_tenant_zone(
        tenant_id=tenant_id,
        limit=limit,
        lookback_days=lookback_days,
    )

    logger.info(f"[DailyDiscovery] Found {len(sources)} sources for tenant {tenant_id}")
    return sources


# ============================================================
# TESTING
# ============================================================

if __name__ == "__main__":
    async def test():
        print("Testing Exa discovery...")

        # Test zone discovery
        articles = await discover_via_exa_for_zone(
            city="Lyon",
            region="Auvergne-Rhone-Alpes",
            limit=5,
            lookback_days=30,
        )

        print(f"\nFound {len(articles)} articles for Lyon:")
        for a in articles:
            print(f"  - [{a.source_name}] {a.title or 'No title'}")
            print(f"    URL: {a.source_url}")
            print(f"    Date: {a.published_at}")
            if a.snippet:
                print(f"    Snippet: {a.snippet[:100]}...")
            print()

    asyncio.run(test())
