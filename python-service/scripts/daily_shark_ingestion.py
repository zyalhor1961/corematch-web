"""
Daily Shark Ingestion - Script de job quotidien pour Shark Hunter.

Ce script est concu pour etre execute quotidiennement via:
- Railway Cron Job
- Crontab externe
- Appel HTTP depuis l'API

Usage:
    python -m scripts.daily_shark_ingestion

Railway Cron:
    Command: python -m scripts.daily_shark_ingestion
    Schedule: 0 5 * * *  (tous les jours a 5h UTC)

Environment Variables:
    SHARK_DAILY_TENANT_ID: UUID du tenant cible
    SHARK_DAILY_MAX_URLS: Nombre max d'URLs a traiter (default: 30)
    SHARK_DAILY_LOOKBACK_DAYS: Jours a remonter (default: 1)
    FIRECRAWL_ENDPOINT: URL de l'API Firecrawl
    FIRECRAWL_API_KEY: Cle API Firecrawl
    EXA_API_KEY: Cle API Exa (optionnel)
    SUPABASE_URL: URL Supabase
    SUPABASE_SERVICE_KEY: Cle service Supabase
"""

import os
import sys
import asyncio
from datetime import datetime, timedelta
from uuid import UUID
from typing import Optional, List, Dict, Any

import httpx
from loguru import logger
from pydantic import BaseModel

# Add parent to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.shark_source_discovery import (
    discover_recent_articles,
    ArticleSource,
    DiscoveryConfig,
)
from services.shark_ingestion_service import (
    ingest_article_as_project,
    ArticleIngestionInput,
    IngestionResult,
    SharkIngestionError,
)


# ============================================================
# CONFIGURATION
# ============================================================

class DailyConfig(BaseModel):
    """Configuration pour le job quotidien."""
    tenant_id: UUID
    max_urls: int = 30
    lookback_days: int = 1
    firecrawl_endpoint: str = "https://api.firecrawl.dev/v1"
    firecrawl_api_key: str
    exa_api_key: Optional[str] = None
    max_concurrent: int = 3


def load_config() -> DailyConfig:
    """Charge la configuration depuis les variables d'environnement."""
    tenant_id_str = os.getenv("SHARK_DAILY_TENANT_ID")
    if not tenant_id_str:
        raise ValueError("SHARK_DAILY_TENANT_ID is required")

    firecrawl_key = os.getenv("FIRECRAWL_API_KEY")
    if not firecrawl_key:
        raise ValueError("FIRECRAWL_API_KEY is required")

    return DailyConfig(
        tenant_id=UUID(tenant_id_str),
        max_urls=int(os.getenv("SHARK_DAILY_MAX_URLS", "30")),
        lookback_days=int(os.getenv("SHARK_DAILY_LOOKBACK_DAYS", "1")),
        firecrawl_endpoint=os.getenv("FIRECRAWL_ENDPOINT", "https://api.firecrawl.dev/v1"),
        firecrawl_api_key=firecrawl_key,
        exa_api_key=os.getenv("EXA_API_KEY"),
        max_concurrent=int(os.getenv("SHARK_DAILY_CONCURRENCY", "3")),
    )


# ============================================================
# FIRECRAWL CLIENT (SAME AS BOOTSTRAP)
# ============================================================

class FirecrawlClient:
    """Client HTTP pour Firecrawl."""

    def __init__(self, endpoint: str, api_key: str):
        self.endpoint = endpoint.rstrip("/")
        self.api_key = api_key
        self._client: Optional[httpx.AsyncClient] = None

    async def __aenter__(self):
        self._client = httpx.AsyncClient(
            timeout=60.0,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._client:
            await self._client.aclose()

    async def scrape(self, url: str) -> Optional[str]:
        """Scrape une URL et retourne le contenu markdown."""
        if not self._client:
            raise RuntimeError("Client not initialized. Use async with.")

        try:
            response = await self._client.post(
                f"{self.endpoint}/scrape",
                json={
                    "url": url,
                    "formats": ["markdown"],
                    "onlyMainContent": True,
                    "waitFor": 2000,
                }
            )

            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    return data.get("data", {}).get("markdown", "")
                return None

            elif response.status_code == 429:
                logger.warning(f"Rate limited for {url}")
                await asyncio.sleep(5)
                return None

            else:
                logger.error(f"Firecrawl error {response.status_code} for {url}")
                return None

        except Exception as e:
            logger.error(f"Firecrawl exception for {url}: {e}")
            return None


# ============================================================
# INGESTION STATS
# ============================================================

class DailyStats:
    """Statistiques du job quotidien."""

    def __init__(self):
        self.start_time = datetime.utcnow()
        self.end_time: Optional[datetime] = None
        self.sources_discovered = 0
        self.scraped_success = 0
        self.scraped_failed = 0
        self.ingested_success = 0
        self.ingested_failed = 0
        self.projects_created = 0
        self.projects_reused = 0
        self.no_btp_project = 0
        self.errors: List[Dict[str, str]] = []

    @property
    def duration_seconds(self) -> float:
        if self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration_seconds": self.duration_seconds,
            "sources_discovered": self.sources_discovered,
            "scraped_success": self.scraped_success,
            "scraped_failed": self.scraped_failed,
            "ingested_success": self.ingested_success,
            "ingested_failed": self.ingested_failed,
            "projects_created": self.projects_created,
            "projects_reused": self.projects_reused,
            "no_btp_project": self.no_btp_project,
            "errors_count": len(self.errors),
        }

    def log_summary(self):
        """Affiche le resume."""
        self.end_time = datetime.utcnow()

        logger.info("=" * 60)
        logger.info("DAILY INGESTION SUMMARY")
        logger.info("=" * 60)
        logger.info(f"Duration:           {self.duration_seconds:.1f}s")
        logger.info(f"Sources discovered: {self.sources_discovered}")
        logger.info(f"Scraped success:    {self.scraped_success}")
        logger.info(f"Scraped failed:     {self.scraped_failed}")
        logger.info(f"Ingested success:   {self.ingested_success}")
        logger.info(f"Ingested failed:    {self.ingested_failed}")
        logger.info(f"No BTP project:     {self.no_btp_project}")
        logger.info("-" * 40)
        logger.info(f"Projects created:   {self.projects_created}")
        logger.info(f"Projects reused:    {self.projects_reused}")
        logger.info("=" * 60)

        # Final one-liner for Railway logs
        logger.info(
            f"[Daily] Sources: {self.sources_discovered}, "
            f"Scraped: {self.scraped_success}, "
            f"Created: {self.projects_created}, "
            f"Updated: {self.projects_reused}"
        )


# ============================================================
# PROCESS SINGLE SOURCE
# ============================================================

async def process_source(
    source: ArticleSource,
    firecrawl: FirecrawlClient,
    config: DailyConfig,
    semaphore: asyncio.Semaphore,
    stats: DailyStats,
) -> Optional[IngestionResult]:
    """Traite une source: scrape + ingestion."""

    async with semaphore:
        url = source.source_url
        source_name = source.source_name

        logger.info(f"[Processing] {url}")

        # 1. Scrape
        content = await firecrawl.scrape(url)

        if not content:
            stats.scraped_failed += 1
            stats.errors.append({"url": url, "error": "Scraping failed"})
            return None

        stats.scraped_success += 1
        logger.debug(f"[Scraped] {len(content)} chars")

        # 2. Prepare input
        published_at = source.published_at or datetime.utcnow()

        input_data = ArticleIngestionInput(
            tenant_id=config.tenant_id,
            source_url=url,
            source_name=source_name,
            published_at=published_at,
            full_text=content,
            raw_payload={
                "discovery_method": source.discovery_method,
                "daily_job": True,
                "job_date": datetime.utcnow().date().isoformat(),
            }
        )

        # 3. Ingest
        try:
            result = await ingest_article_as_project(input_data)

            if result.project_id:
                stats.ingested_success += 1

                if result.created_project:
                    stats.projects_created += 1
                elif result.reused_existing_project:
                    stats.projects_reused += 1

                logger.info(
                    f"[OK] project_id={result.project_id}, "
                    f"created={result.created_project}"
                )
            else:
                stats.no_btp_project += 1
                logger.info(f"[No BTP] {url}")

            return result

        except SharkIngestionError as e:
            stats.ingested_failed += 1
            stats.errors.append({"url": url, "error": str(e)})
            logger.error(f"[Error] {url}: {e}")
            return None

        except Exception as e:
            stats.ingested_failed += 1
            stats.errors.append({"url": url, "error": str(e)})
            logger.exception(f"[Error] {url}: {e}")
            return None


# ============================================================
# MAIN DAILY FUNCTION
# ============================================================

async def run_daily_ingestion() -> DailyStats:
    """
    Execute le job d'ingestion quotidien.

    Returns:
        DailyStats avec les statistiques du job
    """
    stats = DailyStats()

    try:
        # Load config
        config = load_config()
        logger.info(
            f"[Daily] Config: tenant={config.tenant_id}, "
            f"max_urls={config.max_urls}, lookback={config.lookback_days}d"
        )

        # 1. Discover sources
        logger.info("[Daily] Discovering sources...")

        discovery_config = DiscoveryConfig(
            exa_api_key=config.exa_api_key,
            exa_enabled=bool(config.exa_api_key),
            static_enabled=True,
        )

        sources = await discover_recent_articles(
            lookback_days=config.lookback_days,
            max_urls=config.max_urls,
            config=discovery_config,
        )

        stats.sources_discovered = len(sources)
        logger.info(f"[Daily] Discovered {len(sources)} sources")

        if not sources:
            logger.warning("[Daily] No sources found, exiting")
            stats.log_summary()
            return stats

        # 2. Process sources
        semaphore = asyncio.Semaphore(config.max_concurrent)

        async with FirecrawlClient(config.firecrawl_endpoint, config.firecrawl_api_key) as firecrawl:
            tasks = [
                process_source(source, firecrawl, config, semaphore, stats)
                for source in sources
            ]

            await asyncio.gather(*tasks, return_exceptions=True)

        # 3. Log summary
        stats.log_summary()

        return stats

    except Exception as e:
        logger.exception(f"[Daily] Fatal error: {e}")
        stats.errors.append({"url": "global", "error": str(e)})
        stats.log_summary()
        raise


# ============================================================
# CLI ENTRY POINT
# ============================================================

async def main():
    """Point d'entree principal compatible Railway."""
    # Configure loguru for Railway
    logger.remove()
    logger.add(
        sys.stdout,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | {message}",
        level=os.getenv("LOG_LEVEL", "INFO"),
        colorize=True,
    )

    logger.info("[Daily] Starting Shark Hunter daily ingestion job...")

    try:
        stats = await run_daily_ingestion()

        # Exit code based on success
        if stats.ingested_failed > stats.ingested_success:
            logger.error("[Daily] More failures than successes, exiting with error")
            sys.exit(1)

        logger.info("[Daily] Job completed successfully")
        sys.exit(0)

    except Exception as e:
        logger.exception(f"[Daily] Job failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
