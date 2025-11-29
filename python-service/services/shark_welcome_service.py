"""
Shark Welcome Scan Service

Service de scan initial pour les nouveaux tenants Shark Hunter.

Ce module:
1. Lance un scan cible sur la zone geographique du tenant
2. Remplit le Shark Radar avec quelques projets locaux
3. Met a jour welcome_scan_done_at dans shark_tenant_settings

Usage:
    from services.shark_welcome_service import run_welcome_scan_for_tenant

    result = await run_welcome_scan_for_tenant(tenant_id)

    if result.created_projects_count > 0:
        print(f"Welcome scan completed: {result.created_projects_count} projects created")
"""

import os
import asyncio
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID

import httpx
from pydantic import BaseModel
from loguru import logger
from supabase import create_client, Client

from services.shark_source_discovery import (
    discover_urls_for_tenant_zone,
    get_tenant_zone_config,
    ArticleSource,
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

# Maximum URLs to process during Welcome Scan
WELCOME_SCAN_MAX_URLS = 20

# Maximum concurrent scraping
WELCOME_SCAN_CONCURRENCY = 3


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
# PYDANTIC MODELS
# ============================================================

class SharkWelcomeResult(BaseModel):
    """Result of a Welcome Scan."""
    tenant_id: UUID
    discovered_urls_count: int = 0
    ingested_articles_count: int = 0
    created_projects_count: int = 0
    reused_projects_count: int = 0
    no_btp_count: int = 0
    failed_count: int = 0
    message: Optional[str] = None


# ============================================================
# FIRECRAWL CLIENT
# ============================================================

class FirecrawlClient:
    """Async HTTP client for Firecrawl API."""

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
        """
        Scrape a URL and return markdown content.

        Returns:
            Markdown content or None on error.
        """
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
                logger.warning(f"[WelcomeScan] Rate limited for {url}")
                await asyncio.sleep(5)
                return None

            else:
                logger.error(f"[WelcomeScan] Firecrawl error {response.status_code} for {url}")
                return None

        except Exception as e:
            logger.error(f"[WelcomeScan] Firecrawl exception for {url}: {e}")
            return None


# ============================================================
# WELCOME SCAN STATS
# ============================================================

class WelcomeScanStats:
    """Statistics tracker for Welcome Scan."""

    def __init__(self):
        self.start_time = datetime.utcnow()
        self.end_time: Optional[datetime] = None
        self.discovered_urls_count = 0
        self.scraped_success = 0
        self.scraped_failed = 0
        self.ingested_success = 0
        self.ingested_failed = 0
        self.created_projects = 0
        self.reused_projects = 0
        self.no_btp_count = 0

    def to_result(self, tenant_id: UUID, message: str) -> SharkWelcomeResult:
        """Convert stats to SharkWelcomeResult."""
        return SharkWelcomeResult(
            tenant_id=tenant_id,
            discovered_urls_count=self.discovered_urls_count,
            ingested_articles_count=self.ingested_success,
            created_projects_count=self.created_projects,
            reused_projects_count=self.reused_projects,
            no_btp_count=self.no_btp_count,
            failed_count=self.scraped_failed + self.ingested_failed,
            message=message,
        )


# ============================================================
# PROCESS SINGLE SOURCE
# ============================================================

async def process_source_for_welcome(
    source: ArticleSource,
    tenant_id: UUID,
    firecrawl: FirecrawlClient,
    semaphore: asyncio.Semaphore,
    stats: WelcomeScanStats,
) -> Optional[IngestionResult]:
    """
    Process a single source for Welcome Scan.

    Args:
        source: Article source to process
        tenant_id: Target tenant
        firecrawl: Firecrawl client
        semaphore: Concurrency limiter
        stats: Stats tracker

    Returns:
        IngestionResult or None
    """
    async with semaphore:
        url = source.source_url
        source_name = source.source_name

        logger.info(f"[WelcomeScan] Processing {url}")

        # 1. Scrape
        content = await firecrawl.scrape(url)

        if not content:
            stats.scraped_failed += 1
            logger.warning(f"[WelcomeScan] Scraping failed for {url}")
            return None

        stats.scraped_success += 1
        logger.debug(f"[WelcomeScan] Scraped {len(content)} chars from {url}")

        # 2. Prepare ingestion input
        published_at = source.published_at or datetime.utcnow()

        input_data = ArticleIngestionInput(
            tenant_id=tenant_id,
            source_url=url,
            source_name=source_name,
            published_at=published_at,
            full_text=content,
            raw_payload={
                "discovery_method": source.discovery_method,
                "welcome_scan": True,
                "scan_date": datetime.utcnow().date().isoformat(),
            }
        )

        # 3. Ingest
        try:
            result = await ingest_article_as_project(input_data)

            if result.project_id:
                stats.ingested_success += 1

                if result.created_project:
                    stats.created_projects += 1
                elif result.reused_existing_project:
                    stats.reused_projects += 1

                logger.info(
                    f"[WelcomeScan] OK project_id={result.project_id}, "
                    f"created={result.created_project}"
                )
            else:
                stats.no_btp_count += 1
                logger.info(f"[WelcomeScan] No BTP project detected for {url}")

            return result

        except SharkIngestionError as e:
            stats.ingested_failed += 1
            logger.error(f"[WelcomeScan] Ingestion error for {url}: {e}")
            return None

        except Exception as e:
            stats.ingested_failed += 1
            logger.exception(f"[WelcomeScan] Unexpected error for {url}: {e}")
            return None


# ============================================================
# UPDATE TENANT SETTINGS
# ============================================================

async def mark_welcome_scan_done(
    tenant_id: UUID,
    projects_count: int,
) -> bool:
    """
    Mark Welcome Scan as completed in shark_tenant_settings.

    Args:
        tenant_id: Target tenant
        projects_count: Number of projects created

    Returns:
        True if update succeeded
    """
    try:
        supabase = get_supabase()

        # Upsert to handle case where settings don't exist yet
        result = supabase.table("shark_tenant_settings").upsert({
            "tenant_id": str(tenant_id),
            "welcome_scan_done_at": datetime.utcnow().isoformat(),
            "welcome_scan_projects_count": projects_count,
            "updated_at": datetime.utcnow().isoformat(),
        }, on_conflict="tenant_id").execute()

        logger.info(f"[WelcomeScan] Marked welcome scan done for tenant {tenant_id}")
        return True

    except Exception as e:
        logger.error(f"[WelcomeScan] Failed to mark welcome scan done: {e}")
        return False


async def create_welcome_scan_activity(
    tenant_id: UUID,
    result: SharkWelcomeResult,
) -> bool:
    """
    Create an activity feed entry for the Welcome Scan.

    Args:
        tenant_id: Target tenant
        result: Welcome scan result

    Returns:
        True if creation succeeded
    """
    try:
        supabase = get_supabase()

        # Check if shark_activity_feed table exists
        # If not, skip silently (table might not be created yet)
        try:
            supabase.table("shark_activity_feed").insert({
                "org_id": str(tenant_id),
                "event_type": "welcome_scan",
                "title": "Analyse initiale terminee",
                "description": (
                    f"{result.created_projects_count} projets detectes "
                    f"dans votre zone"
                ),
                "metadata": {
                    "discovered_urls": result.discovered_urls_count,
                    "created_projects": result.created_projects_count,
                    "reused_projects": result.reused_projects_count,
                },
                "created_at": datetime.utcnow().isoformat(),
            }).execute()

            logger.info(f"[WelcomeScan] Created activity entry for tenant {tenant_id}")
            return True

        except Exception as e:
            # Table might not exist, skip
            logger.debug(f"[WelcomeScan] Could not create activity entry: {e}")
            return False

    except Exception as e:
        logger.error(f"[WelcomeScan] Activity creation error: {e}")
        return False


# ============================================================
# MAIN WELCOME SCAN FUNCTION
# ============================================================

async def run_welcome_scan_for_tenant(
    tenant_id: UUID,
    max_urls: int = WELCOME_SCAN_MAX_URLS,
) -> SharkWelcomeResult:
    """
    Run a Welcome Scan for a new tenant.

    This function:
    1. Gets the tenant's zone configuration
    2. Discovers URLs for that zone
    3. Scrapes and ingests articles
    4. Updates welcome_scan_done_at

    Args:
        tenant_id: UUID of the tenant to scan
        max_urls: Maximum URLs to process (default: 20)

    Returns:
        SharkWelcomeResult with statistics
    """
    logger.info(f"[WelcomeScan] Starting Welcome Scan for tenant {tenant_id}")

    stats = WelcomeScanStats()

    # 1. Check zone configuration
    zone_config = await get_tenant_zone_config(tenant_id)

    if not zone_config:
        logger.warning(f"[WelcomeScan] No zone config for tenant {tenant_id}")
        return stats.to_result(tenant_id, "no_zone_config")

    if not zone_config.city and not zone_config.region:
        logger.warning(f"[WelcomeScan] Tenant {tenant_id} has no geographic zone")
        return stats.to_result(tenant_id, "no_geo_config")

    if not zone_config.shark_enabled:
        logger.warning(f"[WelcomeScan] Shark disabled for tenant {tenant_id}")
        return stats.to_result(tenant_id, "shark_disabled")

    logger.info(
        f"[WelcomeScan] Zone: city={zone_config.city}, "
        f"region={zone_config.region}"
    )

    # 2. Discover URLs for the zone
    sources = await discover_urls_for_tenant_zone(
        tenant_id=tenant_id,
        limit=max_urls,
        lookback_days=7,
    )

    stats.discovered_urls_count = len(sources)

    if not sources:
        logger.warning(f"[WelcomeScan] No URLs found for tenant {tenant_id}")
        await mark_welcome_scan_done(tenant_id, 0)
        return stats.to_result(tenant_id, "no_urls_found_for_zone")

    logger.info(f"[WelcomeScan] Discovered {len(sources)} URLs")

    # 3. Check Firecrawl configuration
    firecrawl_key = os.getenv("FIRECRAWL_API_KEY")
    if not firecrawl_key:
        logger.error("[WelcomeScan] FIRECRAWL_API_KEY not configured")
        return stats.to_result(tenant_id, "firecrawl_not_configured")

    firecrawl_endpoint = os.getenv("FIRECRAWL_ENDPOINT", "https://api.firecrawl.dev/v1")

    # 4. Process sources
    semaphore = asyncio.Semaphore(WELCOME_SCAN_CONCURRENCY)

    async with FirecrawlClient(firecrawl_endpoint, firecrawl_key) as firecrawl:
        tasks = [
            process_source_for_welcome(
                source=source,
                tenant_id=tenant_id,
                firecrawl=firecrawl,
                semaphore=semaphore,
                stats=stats,
            )
            for source in sources
        ]

        await asyncio.gather(*tasks, return_exceptions=True)

    # 5. Mark welcome scan as done
    await mark_welcome_scan_done(tenant_id, stats.created_projects)

    # 6. Create activity entry
    result = stats.to_result(tenant_id, "welcome_scan_completed")
    await create_welcome_scan_activity(tenant_id, result)

    # 7. Log summary
    logger.info(
        f"[WelcomeScan] Completed for tenant {tenant_id}: "
        f"discovered={stats.discovered_urls_count}, "
        f"scraped={stats.scraped_success}, "
        f"created={stats.created_projects}, "
        f"reused={stats.reused_projects}"
    )

    return result


# ============================================================
# CHECK IF WELCOME SCAN NEEDED
# ============================================================

async def is_welcome_scan_needed(tenant_id: UUID) -> bool:
    """
    Check if a tenant needs a Welcome Scan.

    Returns True if:
    - Tenant has Shark enabled
    - welcome_scan_done_at is NULL

    Args:
        tenant_id: UUID of the tenant

    Returns:
        True if Welcome Scan is needed
    """
    try:
        supabase = get_supabase()

        result = supabase.table("shark_tenant_settings") \
            .select("welcome_scan_done_at, shark_enabled") \
            .eq("tenant_id", str(tenant_id)) \
            .execute()

        if not result.data or len(result.data) == 0:
            # No settings = needs setup
            return False

        row = result.data[0]

        if not row.get("shark_enabled", True):
            return False

        return row.get("welcome_scan_done_at") is None

    except Exception as e:
        logger.error(f"[WelcomeScan] Failed to check if welcome scan needed: {e}")
        return False


# ============================================================
# TESTING
# ============================================================

if __name__ == "__main__":
    async def test():
        # Test with a mock tenant ID
        tenant_id = UUID("00000000-0000-0000-0000-000000000001")
        result = await run_welcome_scan_for_tenant(tenant_id)
        print(f"Result: {result}")

    asyncio.run(test())
