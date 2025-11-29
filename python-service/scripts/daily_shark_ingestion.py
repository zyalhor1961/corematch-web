"""
Daily Shark Ingestion - Script de job quotidien multi-tenant pour Shark Hunter.

Ce script est concu pour etre execute quotidiennement via:
- Railway Cron Job
- Crontab externe
- Appel HTTP depuis l'API

Modes:
- Multi-tenant: Lit tous les tenants depuis shark_tenant_settings (shark_enabled=true)
- Single-tenant: Si SHARK_DAILY_TENANT_ID est defini (legacy mode)

Usage:
    python -m scripts.daily_shark_ingestion

Railway Cron:
    Command: python -m scripts.daily_shark_ingestion
    Schedule: 0 5 * * *  (tous les jours a 5h UTC)

Environment Variables:
    SHARK_DAILY_TENANT_ID: (Optional) UUID du tenant unique (legacy mode)
    SHARK_DAILY_MAX_URLS: Nombre max d'URLs par tenant (default: 10)
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
    discover_daily_urls_for_tenant,
    get_all_enabled_tenants,
    get_tenant_zone_config,
    ArticleSource,
    DiscoveryConfig,
    TenantZoneConfig,
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
    multi_tenant: bool = True
    single_tenant_id: Optional[UUID] = None
    default_max_urls: int = 10
    lookback_days: int = 1
    firecrawl_endpoint: str = "https://api.firecrawl.dev/v1"
    firecrawl_api_key: str
    exa_api_key: Optional[str] = None
    max_concurrent: int = 3


def load_config() -> DailyConfig:
    """Charge la configuration depuis les variables d'environnement."""
    firecrawl_key = os.getenv("FIRECRAWL_API_KEY")
    if not firecrawl_key:
        raise ValueError("FIRECRAWL_API_KEY is required")

    # Check for single-tenant mode (legacy)
    single_tenant_id_str = os.getenv("SHARK_DAILY_TENANT_ID")
    single_tenant_id = UUID(single_tenant_id_str) if single_tenant_id_str else None

    return DailyConfig(
        multi_tenant=single_tenant_id is None,  # Multi-tenant if no specific tenant
        single_tenant_id=single_tenant_id,
        default_max_urls=int(os.getenv("SHARK_DAILY_MAX_URLS", "10")),
        lookback_days=int(os.getenv("SHARK_DAILY_LOOKBACK_DAYS", "1")),
        firecrawl_endpoint=os.getenv("FIRECRAWL_ENDPOINT", "https://api.firecrawl.dev/v1"),
        firecrawl_api_key=firecrawl_key,
        exa_api_key=os.getenv("EXA_API_KEY"),
        max_concurrent=int(os.getenv("SHARK_DAILY_CONCURRENCY", "3")),
    )


# ============================================================
# FIRECRAWL CLIENT
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
# STATISTICS
# ============================================================

class TenantStats:
    """Statistics for a single tenant."""

    def __init__(self, tenant_id: UUID):
        self.tenant_id = tenant_id
        self.sources_discovered = 0
        self.scraped_success = 0
        self.scraped_failed = 0
        self.ingested_success = 0
        self.ingested_failed = 0
        self.projects_created = 0
        self.projects_reused = 0
        self.no_btp_project = 0
        self.errors: List[Dict[str, str]] = []


class DailyStats:
    """Statistiques globales du job quotidien."""

    def __init__(self):
        self.start_time = datetime.utcnow()
        self.end_time: Optional[datetime] = None
        self.tenants_processed = 0
        self.tenants_skipped = 0
        self.total_sources_discovered = 0
        self.total_scraped_success = 0
        self.total_scraped_failed = 0
        self.total_ingested_success = 0
        self.total_ingested_failed = 0
        self.total_projects_created = 0
        self.total_projects_reused = 0
        self.total_no_btp_project = 0
        self.tenant_stats: Dict[str, TenantStats] = {}
        self.errors: List[Dict[str, str]] = []

    @property
    def duration_seconds(self) -> float:
        if self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return 0

    def add_tenant_stats(self, ts: TenantStats):
        """Add a tenant's stats to the global stats."""
        self.tenant_stats[str(ts.tenant_id)] = ts
        self.tenants_processed += 1
        self.total_sources_discovered += ts.sources_discovered
        self.total_scraped_success += ts.scraped_success
        self.total_scraped_failed += ts.scraped_failed
        self.total_ingested_success += ts.ingested_success
        self.total_ingested_failed += ts.ingested_failed
        self.total_projects_created += ts.projects_created
        self.total_projects_reused += ts.projects_reused
        self.total_no_btp_project += ts.no_btp_project
        self.errors.extend(ts.errors)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration_seconds": self.duration_seconds,
            "tenants_processed": self.tenants_processed,
            "tenants_skipped": self.tenants_skipped,
            "total_sources_discovered": self.total_sources_discovered,
            "total_scraped_success": self.total_scraped_success,
            "total_scraped_failed": self.total_scraped_failed,
            "total_ingested_success": self.total_ingested_success,
            "total_ingested_failed": self.total_ingested_failed,
            "total_projects_created": self.total_projects_created,
            "total_projects_reused": self.total_projects_reused,
            "total_no_btp_project": self.total_no_btp_project,
            "errors_count": len(self.errors),
        }

    def log_summary(self):
        """Affiche le resume."""
        self.end_time = datetime.utcnow()

        logger.info("=" * 60)
        logger.info("DAILY INGESTION SUMMARY (MULTI-TENANT)")
        logger.info("=" * 60)
        logger.info(f"Duration:           {self.duration_seconds:.1f}s")
        logger.info(f"Tenants processed:  {self.tenants_processed}")
        logger.info(f"Tenants skipped:    {self.tenants_skipped}")
        logger.info("-" * 40)
        logger.info(f"Sources discovered: {self.total_sources_discovered}")
        logger.info(f"Scraped success:    {self.total_scraped_success}")
        logger.info(f"Scraped failed:     {self.total_scraped_failed}")
        logger.info(f"Ingested success:   {self.total_ingested_success}")
        logger.info(f"Ingested failed:    {self.total_ingested_failed}")
        logger.info(f"No BTP project:     {self.total_no_btp_project}")
        logger.info("-" * 40)
        logger.info(f"Projects created:   {self.total_projects_created}")
        logger.info(f"Projects reused:    {self.total_projects_reused}")
        logger.info("=" * 60)

        # Per-tenant summary
        for tenant_id, ts in self.tenant_stats.items():
            logger.info(
                f"[Tenant {tenant_id[:8]}...] "
                f"Sources: {ts.sources_discovered}, "
                f"Created: {ts.projects_created}, "
                f"Reused: {ts.projects_reused}"
            )

        # Final one-liner for Railway logs
        logger.info(
            f"[Daily] Tenants: {self.tenants_processed}, "
            f"Sources: {self.total_sources_discovered}, "
            f"Created: {self.total_projects_created}, "
            f"Reused: {self.total_projects_reused}"
        )


# ============================================================
# PROCESS SINGLE SOURCE
# ============================================================

async def process_source(
    source: ArticleSource,
    tenant_id: UUID,
    firecrawl: FirecrawlClient,
    semaphore: asyncio.Semaphore,
    stats: TenantStats,
) -> Optional[IngestionResult]:
    """Traite une source: scrape + ingestion."""

    async with semaphore:
        url = source.source_url
        source_name = source.source_name

        logger.info(f"[{str(tenant_id)[:8]}] Processing {url}")

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
            tenant_id=tenant_id,
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
                    f"[{str(tenant_id)[:8]}] OK project_id={result.project_id}, "
                    f"created={result.created_project}"
                )
            else:
                stats.no_btp_project += 1
                logger.info(f"[{str(tenant_id)[:8]}] No BTP project for {url}")

            return result

        except SharkIngestionError as e:
            stats.ingested_failed += 1
            stats.errors.append({"url": url, "error": str(e)})
            logger.error(f"[{str(tenant_id)[:8]}] Error: {e}")
            return None

        except Exception as e:
            stats.ingested_failed += 1
            stats.errors.append({"url": url, "error": str(e)})
            logger.exception(f"[{str(tenant_id)[:8]}] Unexpected error: {e}")
            return None


# ============================================================
# PROCESS SINGLE TENANT
# ============================================================

async def process_tenant(
    tenant_config: TenantZoneConfig,
    firecrawl: FirecrawlClient,
    config: DailyConfig,
) -> TenantStats:
    """
    Process a single tenant's daily ingestion.

    Args:
        tenant_config: Tenant zone configuration
        firecrawl: Firecrawl client
        config: Daily config

    Returns:
        TenantStats for this tenant
    """
    tenant_id = tenant_config.tenant_id
    stats = TenantStats(tenant_id)

    logger.info(f"[{str(tenant_id)[:8]}] Starting daily ingestion...")
    logger.info(
        f"[{str(tenant_id)[:8]}] Zone: city={tenant_config.city}, "
        f"region={tenant_config.region}, limit={tenant_config.daily_url_limit}"
    )

    # 1. Discover sources for this tenant's zone
    try:
        sources = await discover_daily_urls_for_tenant(
            tenant_id=tenant_id,
            limit=tenant_config.daily_url_limit,
        )
    except Exception as e:
        logger.error(f"[{str(tenant_id)[:8]}] Discovery failed: {e}")
        stats.errors.append({"url": "discovery", "error": str(e)})
        return stats

    stats.sources_discovered = len(sources)
    logger.info(f"[{str(tenant_id)[:8]}] Discovered {len(sources)} sources")

    if not sources:
        logger.warning(f"[{str(tenant_id)[:8]}] No sources found")
        return stats

    # 2. Process sources
    semaphore = asyncio.Semaphore(config.max_concurrent)

    tasks = [
        process_source(source, tenant_id, firecrawl, semaphore, stats)
        for source in sources
    ]

    await asyncio.gather(*tasks, return_exceptions=True)

    logger.info(
        f"[{str(tenant_id)[:8]}] Completed: "
        f"created={stats.projects_created}, reused={stats.projects_reused}"
    )

    return stats


# ============================================================
# MAIN DAILY FUNCTION (MULTI-TENANT)
# ============================================================

async def run_daily_ingestion_multi_tenant(config: DailyConfig) -> DailyStats:
    """
    Execute le job d'ingestion quotidien pour tous les tenants actifs.

    Returns:
        DailyStats avec les statistiques globales
    """
    global_stats = DailyStats()

    # 1. Get all enabled tenants
    logger.info("[Daily] Fetching enabled tenants...")

    try:
        tenants = await get_all_enabled_tenants()
    except Exception as e:
        logger.error(f"[Daily] Failed to get tenants: {e}")
        global_stats.errors.append({"url": "get_tenants", "error": str(e)})
        global_stats.log_summary()
        return global_stats

    if not tenants:
        logger.warning("[Daily] No enabled tenants found")
        global_stats.log_summary()
        return global_stats

    logger.info(f"[Daily] Found {len(tenants)} enabled tenants")

    # 2. Process each tenant
    async with FirecrawlClient(config.firecrawl_endpoint, config.firecrawl_api_key) as firecrawl:
        for tenant_config in tenants:
            try:
                # Skip tenants without geographic zone
                if not tenant_config.city and not tenant_config.region:
                    logger.warning(
                        f"[{str(tenant_config.tenant_id)[:8]}] "
                        "No geographic zone configured, skipping"
                    )
                    global_stats.tenants_skipped += 1
                    continue

                tenant_stats = await process_tenant(tenant_config, firecrawl, config)
                global_stats.add_tenant_stats(tenant_stats)

            except Exception as e:
                logger.error(
                    f"[{str(tenant_config.tenant_id)[:8]}] "
                    f"Tenant processing failed: {e}"
                )
                global_stats.errors.append({
                    "url": f"tenant_{tenant_config.tenant_id}",
                    "error": str(e)
                })

    # 3. Log summary
    global_stats.log_summary()

    return global_stats


# ============================================================
# MAIN DAILY FUNCTION (SINGLE TENANT - LEGACY)
# ============================================================

async def run_daily_ingestion_single_tenant(config: DailyConfig) -> DailyStats:
    """
    Execute le job d'ingestion quotidien pour un seul tenant (mode legacy).

    Returns:
        DailyStats avec les statistiques
    """
    if not config.single_tenant_id:
        raise ValueError("single_tenant_id required for single-tenant mode")

    global_stats = DailyStats()
    tenant_id = config.single_tenant_id

    logger.info(f"[Daily] Single-tenant mode: {tenant_id}")

    # Get tenant config (or use defaults)
    tenant_config = await get_tenant_zone_config(tenant_id)

    if not tenant_config:
        # Create a minimal config with defaults
        tenant_config = TenantZoneConfig(
            tenant_id=tenant_id,
            daily_url_limit=config.default_max_urls,
        )
        logger.warning(f"[Daily] No zone config for tenant, using defaults")

    async with FirecrawlClient(config.firecrawl_endpoint, config.firecrawl_api_key) as firecrawl:
        tenant_stats = await process_tenant(tenant_config, firecrawl, config)
        global_stats.add_tenant_stats(tenant_stats)

    global_stats.log_summary()

    return global_stats


# ============================================================
# MAIN DAILY FUNCTION (AUTO-SELECT MODE)
# ============================================================

async def run_daily_ingestion() -> DailyStats:
    """
    Execute le job d'ingestion quotidien.

    Auto-selects mode based on environment:
    - If SHARK_DAILY_TENANT_ID is set: single-tenant mode
    - Otherwise: multi-tenant mode

    Returns:
        DailyStats avec les statistiques du job
    """
    try:
        config = load_config()

        if config.multi_tenant:
            logger.info("[Daily] Running in MULTI-TENANT mode")
            return await run_daily_ingestion_multi_tenant(config)
        else:
            logger.info("[Daily] Running in SINGLE-TENANT mode (legacy)")
            return await run_daily_ingestion_single_tenant(config)

    except Exception as e:
        logger.exception(f"[Daily] Fatal error: {e}")
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
        if stats.total_ingested_failed > stats.total_ingested_success:
            logger.error("[Daily] More failures than successes, exiting with error")
            sys.exit(1)

        logger.info("[Daily] Job completed successfully")
        sys.exit(0)

    except Exception as e:
        logger.exception(f"[Daily] Job failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
