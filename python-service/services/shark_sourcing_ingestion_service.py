"""
Shark Sourcing Ingestion Service

Service d'ingestion pour les articles ajoutes manuellement depuis la page Sourcing.

Ce module:
1. Recoit une URL depuis la page Sourcing (frontend)
2. Scrape la page via Firecrawl
3. Extrait les informations projet via SharkProjectExtractor
4. Ingere le projet dans la base Shark
5. Marque l'origine comme 'user_sourcing'

Usage:
    from services.shark_sourcing_ingestion_service import (
        ingest_article_from_sourcing,
        SourcingIngestionInput
    )

    result = await ingest_article_from_sourcing(
        SourcingIngestionInput(
            tenant_id=UUID("xxx"),
            source_url="https://example.com/article",
            source_name="Example News",
            title_hint="Project Title",
            snippet_hint="Article snippet..."
        )
    )
"""

import os
import asyncio
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

import httpx
from pydantic import BaseModel
from loguru import logger

from services.shark_ingestion_service import (
    ingest_article_as_project,
    ArticleIngestionInput,
    IngestionResult,
    SharkIngestionError,
)


# ============================================================
# PYDANTIC MODELS
# ============================================================

class SourcingIngestionInput(BaseModel):
    """Input for sourcing ingestion."""
    tenant_id: UUID
    source_url: str
    source_name: Optional[str] = None
    title_hint: Optional[str] = None
    snippet_hint: Optional[str] = None


class SourcingIngestionError(Exception):
    """Raised when sourcing ingestion fails."""
    def __init__(self, message: str, source_url: Optional[str] = None):
        super().__init__(message)
        self.source_url = source_url


# ============================================================
# FIRECRAWL SCRAPER
# ============================================================

async def scrape_url_with_firecrawl(url: str) -> Optional[str]:
    """
    Scrape a URL using Firecrawl API and return markdown content.

    Args:
        url: URL to scrape

    Returns:
        Markdown content or None if scraping failed
    """
    firecrawl_key = os.getenv("FIRECRAWL_API_KEY")
    if not firecrawl_key:
        logger.error("[SourcingIngestion] FIRECRAWL_API_KEY not configured")
        return None

    firecrawl_endpoint = os.getenv("FIRECRAWL_ENDPOINT", "https://api.firecrawl.dev/v1")

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(
                f"{firecrawl_endpoint}/scrape",
                headers={
                    "Authorization": f"Bearer {firecrawl_key}",
                    "Content-Type": "application/json",
                },
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
                    content = data.get("data", {}).get("markdown", "")
                    logger.info(f"[SourcingIngestion] Scraped {len(content)} chars from {url}")
                    return content
                else:
                    logger.warning(f"[SourcingIngestion] Firecrawl returned success=false for {url}")
                    return None

            elif response.status_code == 429:
                logger.warning(f"[SourcingIngestion] Rate limited by Firecrawl for {url}")
                # Wait and retry once
                await asyncio.sleep(5)
                retry_response = await client.post(
                    f"{firecrawl_endpoint}/scrape",
                    headers={
                        "Authorization": f"Bearer {firecrawl_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "url": url,
                        "formats": ["markdown"],
                        "onlyMainContent": True,
                        "waitFor": 2000,
                    }
                )
                if retry_response.status_code == 200:
                    retry_data = retry_response.json()
                    if retry_data.get("success"):
                        return retry_data.get("data", {}).get("markdown", "")
                return None

            else:
                logger.error(f"[SourcingIngestion] Firecrawl error {response.status_code} for {url}")
                return None

        except httpx.TimeoutException:
            logger.error(f"[SourcingIngestion] Timeout scraping {url}")
            return None
        except Exception as e:
            logger.error(f"[SourcingIngestion] Exception scraping {url}: {e}")
            return None


# ============================================================
# MAIN INGESTION FUNCTION
# ============================================================

async def ingest_article_from_sourcing(
    input_data: SourcingIngestionInput,
) -> IngestionResult:
    """
    Ingest an article from the Sourcing page into Shark Hunter.

    This function:
    1. Scrapes the URL via Firecrawl
    2. Calls the standard ingestion pipeline
    3. Marks the origin as 'user_sourcing'

    Args:
        input_data: SourcingIngestionInput with URL and hints

    Returns:
        IngestionResult with project/news IDs and statistics

    Raises:
        SourcingIngestionError: If scraping or ingestion fails
    """
    tenant_id = input_data.tenant_id
    source_url = input_data.source_url

    logger.info(f"[SourcingIngestion] Starting ingestion for tenant={tenant_id}, url={source_url}")

    # Step 1: Scrape the URL
    full_text = await scrape_url_with_firecrawl(source_url)

    if not full_text:
        logger.error(f"[SourcingIngestion] Failed to scrape {source_url}")
        raise SourcingIngestionError(
            f"Failed to scrape URL: {source_url}",
            source_url=source_url
        )

    if len(full_text.strip()) < 100:
        logger.warning(f"[SourcingIngestion] Content too short ({len(full_text)} chars) for {source_url}")
        raise SourcingIngestionError(
            f"Content too short to analyze: {len(full_text)} characters",
            source_url=source_url
        )

    # Step 2: Build ArticleIngestionInput
    # Determine source name
    source_name = input_data.source_name
    if not source_name:
        # Extract domain as source name
        try:
            from urllib.parse import urlparse
            parsed = urlparse(source_url)
            domain = parsed.netloc.replace("www.", "")
            source_name = domain or "Sourcing Manual"
        except Exception:
            source_name = "Sourcing Manual"

    # Build raw_payload with origin marker
    raw_payload = {
        "origin": "user_sourcing",
        "title_hint": input_data.title_hint,
        "snippet_hint": input_data.snippet_hint,
        "ingested_at": datetime.now(timezone.utc).isoformat(),
    }

    article_input = ArticleIngestionInput(
        tenant_id=tenant_id,
        source_url=source_url,
        source_name=source_name,
        published_at=datetime.now(timezone.utc),  # Default to now if unknown
        full_text=full_text,
        raw_payload=raw_payload,
    )

    # Step 3: Call standard ingestion pipeline
    try:
        result = await ingest_article_as_project(article_input)

        # Enhance message based on result
        if result.project_id:
            if result.created_project:
                result.message = "sourcing_ingestion_completed_new_project"
            else:
                result.message = "sourcing_ingestion_completed_existing_project"
        else:
            result.message = "sourcing_ingestion_completed_no_btp_project"

        logger.info(
            f"[SourcingIngestion] Completed: project_id={result.project_id}, "
            f"created={result.created_project}, message={result.message}"
        )

        return result

    except SharkIngestionError as e:
        logger.error(f"[SourcingIngestion] Ingestion pipeline error: {e}")
        raise SourcingIngestionError(
            f"Ingestion failed: {str(e)}",
            source_url=source_url
        )
    except Exception as e:
        logger.exception(f"[SourcingIngestion] Unexpected error: {e}")
        raise SourcingIngestionError(
            f"Unexpected error during ingestion: {str(e)}",
            source_url=source_url
        )


# ============================================================
# TESTING
# ============================================================

if __name__ == "__main__":
    async def test():
        # Test with a sample URL
        test_input = SourcingIngestionInput(
            tenant_id=UUID("00000000-0000-0000-0000-000000000001"),
            source_url="https://www.lemoniteur.fr/article/exemple-projet-btp.123456",
            source_name="Le Moniteur",
            title_hint="Projet de construction test",
            snippet_hint="Un nouveau projet de construction...",
        )

        try:
            result = await ingest_article_from_sourcing(test_input)
            print(f"Result: {result}")
        except SourcingIngestionError as e:
            print(f"Error: {e}")

    asyncio.run(test())
