"""
Shark Source Discovery Service

Service de découverte d'articles BTP via l'API Exa.

Ce module permet de:
1. Découvrir de vrais articles de presse BTP pour une zone géographique (Welcome Scan)
2. Découvrir des articles très récents pour la routine quotidienne (Daily)
3. Fournir une abstraction propre réutilisable par tout le pipeline Shark

Usage:
    from services.shark_source_discovery import (
        discover_urls_for_tenant_zone,
        discover_daily_urls_for_tenant,
        DiscoveredArticle,
    )

    # Welcome Scan
    articles = await discover_urls_for_tenant_zone(
        tenant_id=UUID("..."),
        city="Toulouse",
        region="Occitanie",
        limit=20,
        lookback_days=30,
        mode="welcome",
    )

    # Daily Ingestion
    articles = await discover_daily_urls_for_tenant(
        tenant_id=UUID("..."),
        city="Lyon",
        region="Auvergne-Rhône-Alpes",
    )
"""

import os
import httpx
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
from uuid import UUID
from urllib.parse import urlparse

from pydantic import BaseModel, Field, ConfigDict
from loguru import logger
from supabase import create_client, Client


# ============================================================
# CONFIGURATION
# ============================================================

EXA_API_KEY = os.getenv("EXA_API_KEY")
EXA_BASE_URL = os.getenv("EXA_BASE_URL", "https://api.exa.ai")

# HTTP client timeout (seconds)
EXA_TIMEOUT = 30.0


# ============================================================
# PYDANTIC MODELS
# ============================================================

class DiscoveredArticle(BaseModel):
    """Article découvert via Exa."""
    model_config = ConfigDict(ser_json_timedelta="iso8601")

    source_url: str
    source_name: str
    published_at: datetime
    title: Optional[str] = None
    snippet: Optional[str] = None
    score: Optional[float] = None  # Pertinence Exa si disponible


class DiscoveryContext(BaseModel):
    """Contexte de découverte pour un tenant."""
    tenant_id: Optional[UUID] = None
    city: Optional[str] = None
    region: Optional[str] = None
    country: str = "France"
    radius_km: int = 50
    lookback_days: int = 30
    limit: int = 20
    mode: str = "welcome"  # "welcome" | "daily"


class ArticleSource(BaseModel):
    """Source d'article (format legacy compatible)."""
    source_url: str
    source_name: str
    published_at: Optional[datetime] = None
    title: Optional[str] = None
    snippet: Optional[str] = None
    discovery_method: str = "exa"  # exa, rss, manual


class TenantZoneConfig(BaseModel):
    """Configuration de zone géographique d'un tenant."""
    tenant_id: UUID
    city: Optional[str] = None
    region: Optional[str] = None
    country: str = "France"
    lat: Optional[float] = None
    lon: Optional[float] = None
    search_radius_km: int = 50
    shark_enabled: bool = True
    daily_url_limit: int = 10


# ============================================================
# KNOWN SOURCES (for friendly names)
# ============================================================

KNOWN_SOURCES: Dict[str, str] = {
    "lemoniteur.fr": "Le Moniteur",
    "batiactu.com": "Batiactu",
    "batiweb.com": "BatiWeb",
    "constructioncayola.com": "Construction Cayola",
    "boamp.fr": "BOAMP",
    "actu.fr": "Actu.fr",
    "ouest-france.fr": "Ouest-France",
    "ladepeche.fr": "La Dépêche",
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
    "estrepublicain.fr": "L'Est Républicain",
    "dna.fr": "DNA",
    "leprogres.fr": "Le Progrès",
    "lyonmag.com": "Lyon Mag",
    "nicematin.com": "Nice-Matin",
    "lagazettedescommunes.com": "La Gazette des Communes",
    "localtis.info": "Localtis",
    "lalsace.fr": "L'Alsace",
    "lanouvellerepublique.fr": "La Nouvelle République",
    "paris-normandie.fr": "Paris Normandie",
    "letelegramme.fr": "Le Télégramme",
}


# ============================================================
# UTILITY FUNCTIONS
# ============================================================

def extract_domain(url: str) -> str:
    """Extract the domain from a URL."""
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        if domain.startswith("www."):
            domain = domain[4:]
        return domain if domain else "unknown"
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
    parts = domain.split(".")
    if len(parts) >= 2:
        name = parts[-2]
        return name.replace("-", " ").title()

    return domain.title()


# ============================================================
# EXA QUERY BUILDER
# ============================================================

def build_exa_query_for_tenant_zone(
    city: Optional[str],
    region: Optional[str],
    country: str,
    lookback_days: int,
    mode: str = "welcome",
) -> str:
    """
    Construit une requête Exa optimisée pour la découverte BTP.

    Args:
        city: Ville cible
        region: Région cible
        country: Pays (default: France)
        lookback_days: Jours de lookback
        mode: "welcome" (large) ou "daily" (ciblé mouvements récents)

    Returns:
        Requête string pour Exa
    """
    # Build location string
    location_parts = [p for p in [city, region, country] if p]
    location_str = ", ".join(location_parts) if location_parts else country

    if mode == "daily":
        # Requête orientée "mouvements récents"
        query = f"""
Very recent French news (last {lookback_days} days) about
construction, renovation or public works projects in {location_str}.

Give priority to articles that mention:
- works starting ("débutent", "lancement du chantier", "travaux démarrent")
- contracts awarded ("marché attribué", "appel d'offres remporté")
- important milestones ("inauguration", "pose de la première pierre", "livraison prévue").

Exclude:
- job offers ("offre d'emploi", "recrute", "CDI", "stage")
- sports, culture, politics, opinion pieces
- generic corporate news not tied to a specific construction site.

Language: French.
Location focus: {location_str}.
Return only articles that describe a specific project, site or building operation.
        """
    else:
        # Requête plus large pour Welcome Scan
        query = f"""
Recent French news articles (last {lookback_days} days) about
construction or renovation projects in and around {location_str}.

Focus on:
- building sites ("chantier", "travaux", "réhabilitation", "rénovation")
- real estate development ("programme immobilier", "logements", "résidence")
- public buildings ("école", "collège", "lycée", "hôpital", "mairie")
- infrastructure ("pont", "route", "tram", "métro", "ligne de bus", "gare").

Exclude:
- job offers ("offre d'emploi", "recrute", "CDI", "stage")
- sports, culture, politics, opinion pieces
- pure financial results not tied to a specific project.

Articles must describe at least one concrete project or building operation.
Language: French.
Location: {location_str}.
        """

    return query.strip()


# ============================================================
# EXA API CLIENT (HTTPX ASYNC)
# ============================================================

async def _query_exa_news(
    query: str,
    lookback_days: int,
    limit: int,
) -> List[DiscoveredArticle]:
    """
    Query Exa API for news articles.

    Args:
        query: Search query string
        lookback_days: Number of days to look back
        limit: Maximum number of results

    Returns:
        List of DiscoveredArticle
    """
    if not EXA_API_KEY:
        logger.warning("[ExaAPI] EXA_API_KEY not configured - returning empty list")
        return []

    # Calculate date range
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=lookback_days)

    # Format dates for Exa API (ISO format)
    start_date_str = start_date.strftime("%Y-%m-%dT%H:%M:%SZ")
    end_date_str = end_date.strftime("%Y-%m-%dT%H:%M:%SZ")

    # Build request payload
    # Exa API: https://docs.exa.ai/reference/search
    payload = {
        "query": query,
        "type": "auto",  # or "neural" for semantic search
        "numResults": limit,
        "startPublishedDate": start_date_str,
        "endPublishedDate": end_date_str,
        "contents": {
            "text": {"maxCharacters": 1000},
            "highlights": True,
        },
        "useAutoprompt": True,
    }

    headers = {
        "Authorization": f"Bearer {EXA_API_KEY}",
        "Content-Type": "application/json",
    }

    logger.info(
        f"[ExaAPI] Querying: limit={limit}, lookback={lookback_days}d, "
        f"query={query[:80]}..."
    )

    try:
        async with httpx.AsyncClient(timeout=EXA_TIMEOUT) as client:
            response = await client.post(
                f"{EXA_BASE_URL}/search",
                json=payload,
                headers=headers,
            )

            if response.status_code == 401:
                logger.error("[ExaAPI] Authentication failed - check EXA_API_KEY")
                return []

            if response.status_code == 429:
                logger.warning("[ExaAPI] Rate limited - try again later")
                return []

            if response.status_code != 200:
                logger.error(
                    f"[ExaAPI] Error {response.status_code}: {response.text[:200]}"
                )
                return []

            data = response.json()

    except httpx.TimeoutException:
        logger.warning("[ExaAPI] Request timed out")
        return []

    except httpx.RequestError as e:
        logger.warning(f"[ExaAPI] Request error: {e}")
        return []

    except Exception as e:
        logger.error(f"[ExaAPI] Unexpected error: {e}")
        return []

    # Parse results
    results = data.get("results", [])
    logger.info(f"[ExaAPI] Received {len(results)} results")

    articles: List[DiscoveredArticle] = []

    for result in results:
        try:
            url = result.get("url", "")
            if not url:
                continue

            # Extract published date
            published_at = datetime.now(timezone.utc)
            if result.get("publishedDate"):
                try:
                    pub_str = result["publishedDate"]
                    # Handle various ISO formats
                    if pub_str.endswith("Z"):
                        pub_str = pub_str[:-1] + "+00:00"
                    published_at = datetime.fromisoformat(pub_str)
                except (ValueError, TypeError):
                    pass

            # Get source name
            source_name = get_source_name_from_url(url)

            # Get title
            title = result.get("title", "").strip() or None

            # Get snippet (text or highlights)
            snippet = None
            if result.get("text"):
                snippet = result["text"][:500].strip()
                if len(result["text"]) > 500:
                    snippet += "..."
            elif result.get("highlights"):
                highlights = result["highlights"]
                if isinstance(highlights, list) and highlights:
                    snippet = " ... ".join(highlights[:3])

            # Get score if available
            score = result.get("score")

            articles.append(DiscoveredArticle(
                source_url=url,
                source_name=source_name,
                published_at=published_at,
                title=title,
                snippet=snippet,
                score=score,
            ))

        except Exception as e:
            logger.warning(f"[ExaAPI] Failed to parse result: {e}")
            continue

    logger.info(f"[ExaAPI] Parsed {len(articles)} valid articles")
    return articles


# ============================================================
# SUPABASE CLIENT (for tenant config)
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
                country=row.get("country", "France"),
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
                country=row.get("country", "France"),
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
# MAIN DISCOVERY FUNCTIONS
# ============================================================

async def discover_urls_for_tenant_zone(
    tenant_id: UUID,
    city: Optional[str] = None,
    region: Optional[str] = None,
    country: str = "France",
    radius_km: int = 50,
    limit: int = 20,
    lookback_days: int = 30,
    mode: str = "welcome",
) -> List[DiscoveredArticle]:
    """
    Découvre de vrais articles BTP pour un tenant donné, en utilisant Exa.

    Utilisé par le Welcome Scan et éventuellement le bootstrap.

    Args:
        tenant_id: UUID du tenant
        city: Ville cible (si None, lu depuis tenant config)
        region: Région cible (si None, lu depuis tenant config)
        country: Pays (default: France)
        radius_km: Rayon de recherche en km
        limit: Nombre max d'articles
        lookback_days: Jours de lookback (30 pour welcome, 3 pour daily)
        mode: "welcome" (large) ou "daily" (ciblé)

    Returns:
        Liste de DiscoveredArticle
    """
    logger.info(
        f"[SharkDiscovery] tenant={tenant_id} mode={mode} "
        f"city={city} region={region} limit={limit} lookback={lookback_days}"
    )

    # If city/region not provided, try to get from tenant config
    if not city and not region:
        zone_config = await get_tenant_zone_config(tenant_id)
        if zone_config:
            city = zone_config.city
            region = zone_config.region
            country = zone_config.country

    # Validate we have at least some location info
    if not city and not region:
        logger.warning(
            f"[SharkDiscovery] No location info for tenant {tenant_id} - "
            "using country-wide search"
        )

    # Build Exa query
    query = build_exa_query_for_tenant_zone(
        city=city,
        region=region,
        country=country,
        lookback_days=lookback_days,
        mode=mode,
    )

    # Query Exa API
    articles = await _query_exa_news(
        query=query,
        lookback_days=lookback_days,
        limit=limit,
    )

    logger.info(
        f"[SharkDiscovery] Found {len(articles)} articles for tenant {tenant_id}"
    )

    return articles


async def discover_daily_urls_for_tenant(
    tenant_id: UUID,
    city: Optional[str] = None,
    region: Optional[str] = None,
    country: str = "France",
    radius_km: int = 50,
    limit: int = 10,
    lookback_days: int = 3,
) -> List[DiscoveredArticle]:
    """
    Variante dédiée au job quotidien (Daily Shark).

    Paramètres optimisés pour le daily:
    - lookback_days: 3 (rattrape le weekend)
    - limit: 10 (quota raisonnable par tenant)
    - mode: "daily" (requête ciblée sur les mouvements récents)

    Args:
        tenant_id: UUID du tenant
        city: Ville cible
        region: Région cible
        country: Pays
        radius_km: Rayon de recherche
        limit: Nombre max d'articles (default: 10)
        lookback_days: Jours de lookback (default: 3)

    Returns:
        Liste de DiscoveredArticle
    """
    # Get tenant config for daily_url_limit if limit not specified
    if limit == 10:  # Default value, check tenant config
        zone_config = await get_tenant_zone_config(tenant_id)
        if zone_config and zone_config.daily_url_limit:
            limit = zone_config.daily_url_limit

    # Cap limit to reasonable range (5-15)
    limit = max(5, min(limit, 15))

    return await discover_urls_for_tenant_zone(
        tenant_id=tenant_id,
        city=city,
        region=region,
        country=country,
        radius_km=radius_km,
        limit=limit,
        lookback_days=lookback_days,
        mode="daily",
    )


# ============================================================
# LEGACY COMPATIBILITY (ArticleSource format)
# ============================================================

def convert_to_article_sources(
    articles: List[DiscoveredArticle]
) -> List[ArticleSource]:
    """
    Convert DiscoveredArticle list to ArticleSource list.

    For backwards compatibility with existing ingestion code.
    """
    sources = []
    for article in articles:
        sources.append(ArticleSource(
            source_url=article.source_url,
            source_name=article.source_name,
            published_at=article.published_at,
            title=article.title,
            snippet=article.snippet,
            discovery_method="exa",
        ))
    return sources


# ============================================================
# TESTING
# ============================================================

if __name__ == "__main__":
    import asyncio

    async def test():
        print("=" * 60)
        print("Testing Shark Source Discovery (Exa API)")
        print("=" * 60)

        # Test 1: Query builder
        print("\n1. Testing query builder...")
        query_welcome = build_exa_query_for_tenant_zone(
            city="Toulouse",
            region="Occitanie",
            country="France",
            lookback_days=30,
            mode="welcome",
        )
        print(f"Welcome query (first 200 chars):\n{query_welcome[:200]}...")

        query_daily = build_exa_query_for_tenant_zone(
            city="Lyon",
            region="Auvergne-Rhône-Alpes",
            country="France",
            lookback_days=3,
            mode="daily",
        )
        print(f"\nDaily query (first 200 chars):\n{query_daily[:200]}...")

        # Test 2: Full discovery (requires EXA_API_KEY)
        print("\n2. Testing full discovery...")
        if not EXA_API_KEY:
            print("   EXA_API_KEY not set - skipping API test")
        else:
            # Use a fake tenant ID for testing
            test_tenant_id = UUID("00000000-0000-0000-0000-000000000001")

            articles = await discover_urls_for_tenant_zone(
                tenant_id=test_tenant_id,
                city="Toulouse",
                region="Occitanie",
                limit=5,
                lookback_days=7,
                mode="welcome",
            )

            print(f"\nFound {len(articles)} articles for Toulouse:")
            for i, a in enumerate(articles, 1):
                print(f"\n  {i}. [{a.source_name}] {a.title or 'No title'}")
                print(f"     URL: {a.source_url}")
                print(f"     Date: {a.published_at}")
                if a.score:
                    print(f"     Score: {a.score:.2f}")
                if a.snippet:
                    print(f"     Snippet: {a.snippet[:100]}...")

        print("\n" + "=" * 60)
        print("Tests completed!")

    asyncio.run(test())
