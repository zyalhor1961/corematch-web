"""
Bootstrap Shark Ingestion - Script de peuplement initial de la base Shark.

Ce script:
1. Lit les articles depuis shark_seed_articles.py
2. Recupere le contenu via Firecrawl
3. Appelle le pipeline d'ingestion pour chaque article
4. Logge les resultats

Usage:
    python -m scripts.bootstrap_shark_ingestion

Environment Variables:
    SHARK_BOOTSTRAP_TENANT_ID: UUID du tenant cible
    FIRECRAWL_ENDPOINT: URL de l'API Firecrawl (default: https://api.firecrawl.dev/v1)
    FIRECRAWL_API_KEY: Cle API Firecrawl
    SUPABASE_URL: URL Supabase
    SUPABASE_SERVICE_KEY: Cle service Supabase

Railway Compatible:
    python -m scripts.bootstrap_shark_ingestion
"""

import os
import sys
import asyncio
from datetime import datetime
from uuid import UUID
from typing import Optional, List, Dict, Any

import httpx
from loguru import logger
from pydantic import BaseModel

# Add parent to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.shark_seed_articles import SEED_ARTICLES, get_seed_stats
from services.shark_ingestion_service import (
    ingest_article_as_project,
    ArticleIngestionInput,
    IngestionResult,
    SharkIngestionError,
)


# ============================================================
# CONFIGURATION
# ============================================================

class BootstrapConfig(BaseModel):
    """Configuration pour le bootstrap."""
    tenant_id: UUID
    firecrawl_endpoint: str = "https://api.firecrawl.dev/v1"
    firecrawl_api_key: str
    max_concurrent: int = 3
    skip_existing: bool = True


def load_config() -> BootstrapConfig:
    """Charge la configuration depuis les variables d'environnement."""
    tenant_id_str = os.getenv("SHARK_BOOTSTRAP_TENANT_ID")
    if not tenant_id_str:
        raise ValueError("SHARK_BOOTSTRAP_TENANT_ID is required")

    firecrawl_key = os.getenv("FIRECRAWL_API_KEY")
    if not firecrawl_key:
        raise ValueError("FIRECRAWL_API_KEY is required")

    return BootstrapConfig(
        tenant_id=UUID(tenant_id_str),
        firecrawl_endpoint=os.getenv("FIRECRAWL_ENDPOINT", "https://api.firecrawl.dev/v1"),
        firecrawl_api_key=firecrawl_key,
        max_concurrent=int(os.getenv("SHARK_BOOTSTRAP_CONCURRENCY", "3")),
        skip_existing=os.getenv("SHARK_BOOTSTRAP_SKIP_EXISTING", "true").lower() == "true",
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
        """
        Scrape une URL et retourne le contenu markdown.

        Returns:
            Le contenu markdown, ou None en cas d'erreur.
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
                else:
                    logger.warning(f"Firecrawl returned success=false for {url}")
                    return None

            elif response.status_code == 429:
                logger.warning(f"Firecrawl rate limited for {url}")
                await asyncio.sleep(5)
                return None

            else:
                logger.error(f"Firecrawl error {response.status_code} for {url}: {response.text}")
                return None

        except httpx.TimeoutException:
            logger.error(f"Firecrawl timeout for {url}")
            return None
        except Exception as e:
            logger.error(f"Firecrawl exception for {url}: {e}")
            return None


# ============================================================
# INGESTION RESULT TRACKING
# ============================================================

class BootstrapStats:
    """Statistiques de bootstrap."""

    def __init__(self):
        self.total_articles = 0
        self.scraped_success = 0
        self.scraped_failed = 0
        self.ingested_success = 0
        self.ingested_failed = 0
        self.projects_created = 0
        self.projects_reused = 0
        self.orgs_created = 0
        self.orgs_reused = 0
        self.no_btp_project = 0
        self.skipped = 0
        self.errors: List[Dict[str, Any]] = []

    def log_summary(self):
        """Affiche le resume des statistiques."""
        logger.info("=" * 60)
        logger.info("BOOTSTRAP SUMMARY")
        logger.info("=" * 60)
        logger.info(f"Total articles:        {self.total_articles}")
        logger.info(f"Scraped success:       {self.scraped_success}")
        logger.info(f"Scraped failed:        {self.scraped_failed}")
        logger.info(f"Skipped (existing):    {self.skipped}")
        logger.info(f"Ingested success:      {self.ingested_success}")
        logger.info(f"Ingested failed:       {self.ingested_failed}")
        logger.info(f"No BTP project:        {self.no_btp_project}")
        logger.info("-" * 40)
        logger.info(f"Projects created:      {self.projects_created}")
        logger.info(f"Projects reused:       {self.projects_reused}")
        logger.info(f"Organizations created: {self.orgs_created}")
        logger.info(f"Organizations reused:  {self.orgs_reused}")
        logger.info("=" * 60)

        if self.errors:
            logger.warning(f"Errors ({len(self.errors)}):")
            for err in self.errors[:5]:
                logger.warning(f"  - {err['url']}: {err['error']}")


# ============================================================
# MAIN BOOTSTRAP FUNCTION
# ============================================================

async def process_article(
    article: Dict[str, Any],
    firecrawl: FirecrawlClient,
    config: BootstrapConfig,
    semaphore: asyncio.Semaphore,
    stats: BootstrapStats,
) -> Optional[IngestionResult]:
    """Traite un article: scrape + ingestion."""

    async with semaphore:
        url = article["source_url"]
        source_name = article["source_name"]
        published_at_str = article.get("published_at", datetime.utcnow().isoformat())
        tags = article.get("tags", [])

        logger.info(f"[Scraping] {url}")

        # 1. Scrape via Firecrawl
        content = await firecrawl.scrape(url)

        if not content:
            stats.scraped_failed += 1
            stats.errors.append({"url": url, "error": "Scraping failed"})
            logger.warning(f"[Failed] Could not scrape: {url}")
            return None

        stats.scraped_success += 1
        logger.debug(f"[Scraped] {len(content)} chars from {url}")

        # 2. Prepare input
        try:
            published_at = datetime.fromisoformat(published_at_str.replace("Z", "+00:00"))
        except ValueError:
            published_at = datetime.utcnow()

        input_data = ArticleIngestionInput(
            tenant_id=config.tenant_id,
            source_url=url,
            source_name=source_name,
            published_at=published_at,
            full_text=content,
            raw_payload={"seed_tags": tags, "bootstrap": True}
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

                stats.orgs_created += result.created_organizations_count
                stats.orgs_reused += result.reused_organizations_count

                logger.info(
                    f"[Ingested] project_id={result.project_id}, "
                    f"created={result.created_project}, "
                    f"orgs_created={result.created_organizations_count}"
                )
            else:
                stats.no_btp_project += 1
                logger.info(f"[No BTP] {url}: {result.message}")

            return result

        except SharkIngestionError as e:
            stats.ingested_failed += 1
            stats.errors.append({"url": url, "error": str(e)})
            logger.error(f"[Error] Ingestion failed for {url}: {e}")
            return None

        except Exception as e:
            stats.ingested_failed += 1
            stats.errors.append({"url": url, "error": str(e)})
            logger.exception(f"[Error] Unexpected error for {url}: {e}")
            return None


async def run_bootstrap(
    articles: Optional[List[Dict[str, Any]]] = None,
    limit: Optional[int] = None,
) -> BootstrapStats:
    """
    Execute le bootstrap complet.

    Args:
        articles: Liste d'articles a traiter (default: SEED_ARTICLES)
        limit: Limite le nombre d'articles (pour tests)

    Returns:
        BootstrapStats avec les statistiques
    """
    # Load config
    config = load_config()
    logger.info(f"Bootstrap config: tenant_id={config.tenant_id}, max_concurrent={config.max_concurrent}")

    # Use provided articles or seed
    articles_to_process = articles or SEED_ARTICLES
    if limit:
        articles_to_process = articles_to_process[:limit]

    stats = BootstrapStats()
    stats.total_articles = len(articles_to_process)

    logger.info(f"Starting bootstrap with {stats.total_articles} articles...")

    # Create semaphore for concurrency control
    semaphore = asyncio.Semaphore(config.max_concurrent)

    # Process articles
    async with FirecrawlClient(config.firecrawl_endpoint, config.firecrawl_api_key) as firecrawl:
        tasks = [
            process_article(article, firecrawl, config, semaphore, stats)
            for article in articles_to_process
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Count exceptions
        for result in results:
            if isinstance(result, Exception):
                stats.ingested_failed += 1
                stats.errors.append({"url": "unknown", "error": str(result)})

    # Log summary
    stats.log_summary()

    return stats


# ============================================================
# CLI ENTRY POINT
# ============================================================

async def main():
    """Point d'entree principal."""
    import argparse

    parser = argparse.ArgumentParser(description="Bootstrap Shark Hunter with seed articles")
    parser.add_argument("--limit", type=int, help="Limit number of articles to process")
    parser.add_argument("--dry-run", action="store_true", help="Show stats only, don't ingest")
    args = parser.parse_args()

    # Configure loguru
    logger.remove()
    logger.add(
        sys.stdout,
        format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | {message}",
        level="INFO",
        colorize=True,
    )

    if args.dry_run:
        logger.info("DRY RUN - Showing seed stats only")
        stats = get_seed_stats()
        logger.info(f"Total articles: {stats['total_articles']}")
        logger.info(f"Sources: {stats['sources']}")
        logger.info(f"Top tags: {stats['top_tags']}")
        return

    # Run bootstrap
    await run_bootstrap(limit=args.limit)


if __name__ == "__main__":
    asyncio.run(main())
