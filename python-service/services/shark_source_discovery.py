"""
Shark Source Discovery Service

Service de decouverte de nouvelles URLs d'articles BTP.

Ce module est un placeholder prepare pour integrer:
- Exa API (recherche semantique)
- Flux RSS de sources BTP
- Autres APIs de decouverte

Pour l'instant, il retourne des URLs statiques de demonstration.

Usage:
    from services.shark_source_discovery import discover_recent_articles, ArticleSource

    sources = await discover_recent_articles(
        lookback_days=3,
        max_urls=30
    )
"""

import os
import asyncio
from datetime import datetime, timedelta
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel
from loguru import logger


# ============================================================
# MODELS
# ============================================================

class ArticleSource(BaseModel):
    """Source d'article decouverte."""
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
# STATIC SOURCES (DEMO / FALLBACK)
# ============================================================

# URLs statiques pour la phase initiale
# Ces URLs representent des articles recents potentiels
STATIC_DEMO_SOURCES = [
    # Ces URLs sont des exemples - en prod, elles seraient decouvertes dynamiquement
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
# EXA DISCOVERY (TODO: A IMPLEMENTER)
# ============================================================

async def discover_via_exa(
    query: str,
    lookback_days: int,
    max_results: int,
    api_key: str,
) -> List[ArticleSource]:
    """
    Decouvre des articles via Exa API.

    TODO: Implementer l'integration Exa.

    Args:
        query: Requete de recherche (ex: "projet construction BTP France")
        lookback_days: Nombre de jours a remonter
        max_results: Nombre max de resultats
        api_key: Cle API Exa

    Returns:
        Liste d'ArticleSource decouvertes
    """
    logger.info(f"[EXA] Discovery not yet implemented. Query: {query}")

    # TODO: Implementer avec httpx
    # Response format attendu:
    # {
    #   "results": [
    #     {
    #       "url": "...",
    #       "title": "...",
    #       "publishedDate": "...",
    #       "text": "..."
    #     }
    #   ]
    # }

    return []


# ============================================================
# RSS DISCOVERY (TODO: A IMPLEMENTER)
# ============================================================

RSS_FEEDS = [
    {
        "name": "Le Moniteur",
        "url": "https://www.lemoniteur.fr/rss/actualites.xml",
        "enabled": False,  # A activer quand on aura le parser
    },
    {
        "name": "Batiactu",
        "url": "https://www.batiactu.com/rss/actualites.xml",
        "enabled": False,
    },
    {
        "name": "Construction Cayola",
        "url": "https://www.constructioncayola.com/rss.xml",
        "enabled": False,
    },
]


async def discover_via_rss(
    lookback_days: int,
    max_per_feed: int = 10,
) -> List[ArticleSource]:
    """
    Decouvre des articles via flux RSS.

    TODO: Implementer le parsing RSS.

    Args:
        lookback_days: Nombre de jours a remonter
        max_per_feed: Nombre max par flux

    Returns:
        Liste d'ArticleSource decouvertes
    """
    logger.info("[RSS] Discovery not yet implemented")

    # TODO: Implementer avec feedparser
    # for feed in RSS_FEEDS:
    #     if not feed["enabled"]:
    #         continue
    #     parsed = feedparser.parse(feed["url"])
    #     for entry in parsed.entries[:max_per_feed]:
    #         ...

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
    Decouvre des articles BTP recents.

    Combine plusieurs methodes de decouverte:
    1. Exa API (si configure)
    2. Flux RSS (si configure)
    3. Sources statiques (fallback)

    Args:
        lookback_days: Nombre de jours a remonter (1-7)
        max_urls: Nombre maximum d'URLs a retourner
        config: Configuration optionnelle

    Returns:
        Liste d'ArticleSource a traiter
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
                query="projet construction BTP batiment France chantier",
                lookback_days=lookback_days,
                max_results=max_urls // 2,
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

    # 3. Static fallback
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

async def add_manual_sources(
    urls: List[str],
    source_name: str = "Manual",
) -> List[ArticleSource]:
    """
    Cree des ArticleSource a partir d'une liste d'URLs manuelles.

    Utile pour:
    - Tests manuels
    - Integration depuis d'autres systemes
    - Ajout ponctuel d'articles specifiques

    Args:
        urls: Liste d'URLs a traiter
        source_name: Nom de la source par defaut

    Returns:
        Liste d'ArticleSource
    """
    sources = []

    for url in urls:
        # Detect source name from domain
        detected_name = source_name
        if "lemoniteur.fr" in url:
            detected_name = "Le Moniteur"
        elif "batiactu.com" in url:
            detected_name = "Batiactu"
        elif "batiweb.com" in url:
            detected_name = "BatiWeb"
        elif "constructioncayola.com" in url:
            detected_name = "Construction Cayola"
        elif "boamp.fr" in url:
            detected_name = "BOAMP"

        sources.append(ArticleSource(
            source_url=url,
            source_name=detected_name,
            published_at=datetime.utcnow(),
            discovery_method="manual",
        ))

    return sources


# ============================================================
# TESTING
# ============================================================

if __name__ == "__main__":
    async def test():
        sources = await discover_recent_articles(lookback_days=3, max_urls=10)
        for s in sources:
            print(f"  - {s.source_name}: {s.source_url}")

    asyncio.run(test())
