"""
Shark Ingestion Service - Ingests extracted project data into the shark_* tables

This service handles:
- Upserting news items (deduplication on source_url)
- Upserting projects (matching on name + location_city + type)
- Upserting organizations
- Creating relationships (project_organizations, project_news)
"""

import os
import logging
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from supabase import create_client, Client

from agents.project_extractor import (
    ProjectExtractor,
    ExtractionResult,
    ExtractedProject,
    ExtractedOrganization,
    ExtractedNews,
    extract_project_from_article
)

# Configure logging
logger = logging.getLogger(__name__)

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(supabase_url, supabase_key) if supabase_url and supabase_key else None


# ============================================================
# Data Classes for Results
# ============================================================

@dataclass
class IngestionResult:
    """Result of ingesting an article"""
    success: bool
    project_id: Optional[str] = None
    news_id: Optional[str] = None
    organization_ids: List[str] = None
    error_message: Optional[str] = None
    extraction_result: Optional[ExtractionResult] = None

    def __post_init__(self):
        if self.organization_ids is None:
            self.organization_ids = []


# ============================================================
# Shark Ingestion Service
# ============================================================

class SharkIngestionService:
    """
    Service to ingest articles and populate the shark_* tables.

    Usage:
        service = SharkIngestionService(tenant_id="xxx")
        result = await service.ingest_article(
            article_text="...",
            source_url="https://...",
            source_name="Le Moniteur"
        )
    """

    def __init__(self, tenant_id: str):
        """
        Initialize the ingestion service.

        Args:
            tenant_id: UUID of the tenant (CoreMatch customer organization)
        """
        self.tenant_id = tenant_id
        self.extractor = ProjectExtractor()

        if not supabase:
            raise RuntimeError("Supabase client not initialized. Check SUPABASE_URL and SUPABASE_SERVICE_KEY.")

    async def ingest_article(
        self,
        article_text: str,
        source_url: str,
        source_name: Optional[str] = None,
        region_hint: Optional[str] = None,
        published_at: Optional[str] = None,
        article_title: Optional[str] = None
    ) -> IngestionResult:
        """
        Ingest an article: extract project data and store in shark_* tables.

        Args:
            article_text: Full text of the article
            source_url: URL of the article (used for deduplication)
            source_name: Name of the news source
            region_hint: Optional region hint for extraction
            published_at: Optional publication date (YYYY-MM-DD)
            article_title: Optional article title

        Returns:
            IngestionResult with IDs of created/updated records
        """
        try:
            # Step 1: Extract project data using LLM
            logger.info(f"Extracting project from article: {source_url}")
            extraction = await self.extractor.extract(
                article_text=article_text,
                source_url=source_url,
                source_name=source_name,
                region_hint=region_hint,
                published_at=published_at
            )

            if not extraction.extraction_success:
                logger.error(f"Extraction failed: {extraction.error_message}")
                return IngestionResult(
                    success=False,
                    error_message=extraction.error_message,
                    extraction_result=extraction
                )

            # Step 2: Check if a project was found
            if extraction.project is None:
                logger.info(f"No BTP project found in article: {source_url}")
                return IngestionResult(
                    success=True,
                    error_message="No BTP project found in article",
                    extraction_result=extraction
                )

            # Step 3: Upsert news item
            news_id = await self._upsert_news_item(
                source_url=source_url,
                source_name=source_name,
                title=article_title or extraction.news.title if extraction.news else None,
                published_at=published_at or (extraction.news.published_at if extraction.news else None),
                region_hint=region_hint,
                full_text=article_text[:50000]  # Limit stored text
            )

            # Step 4: Upsert project
            project_id = await self._upsert_project(extraction.project)

            # Step 5: Upsert organizations and create relationships
            organization_ids = []
            for org in extraction.organizations:
                org_id = await self._upsert_organization(org)
                organization_ids.append(org_id)

                # Create project-organization relationship
                await self._link_project_organization(
                    project_id=project_id,
                    organization_id=org_id,
                    role_in_project=org.role_in_project
                )

            # Step 6: Link project to news
            await self._link_project_news(
                project_id=project_id,
                news_id=news_id,
                role_of_news=extraction.news.role_of_news if extraction.news else "source"
            )

            logger.info(f"Successfully ingested project: {extraction.project.name}")
            return IngestionResult(
                success=True,
                project_id=project_id,
                news_id=news_id,
                organization_ids=organization_ids,
                extraction_result=extraction
            )

        except Exception as e:
            logger.exception(f"Ingestion failed for {source_url}: {e}")
            return IngestionResult(
                success=False,
                error_message=str(e)
            )

    async def _upsert_news_item(
        self,
        source_url: str,
        source_name: Optional[str],
        title: Optional[str],
        published_at: Optional[str],
        region_hint: Optional[str],
        full_text: Optional[str]
    ) -> str:
        """Upsert a news item, returning its ID."""
        # Check if news already exists
        existing = supabase.table("shark_news_items").select("id").eq(
            "tenant_id", self.tenant_id
        ).eq("source_url", source_url).execute()

        if existing.data:
            news_id = existing.data[0]["id"]
            # Update existing record
            supabase.table("shark_news_items").update({
                "title": title,
                "source_name": source_name,
                "published_at": published_at,
                "region_hint": region_hint,
                "full_text": full_text,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", news_id).execute()
            logger.debug(f"Updated news item: {news_id}")
            return news_id
        else:
            # Insert new record
            result = supabase.table("shark_news_items").insert({
                "tenant_id": self.tenant_id,
                "source_url": source_url,
                "source_name": source_name,
                "title": title,
                "published_at": published_at,
                "region_hint": region_hint,
                "full_text": full_text,
                "crawled_at": datetime.utcnow().isoformat()
            }).execute()
            news_id = result.data[0]["id"]
            logger.debug(f"Created news item: {news_id}")
            return news_id

    async def _upsert_project(self, project: ExtractedProject) -> str:
        """Upsert a project, returning its ID."""
        # Try to find existing project by name + location + type
        query = supabase.table("shark_projects").select("id").eq(
            "tenant_id", self.tenant_id
        ).eq("name", project.name)

        if project.location_city:
            query = query.eq("location_city", project.location_city)
        if project.type:
            query = query.eq("type", project.type)

        existing = query.execute()

        project_data = {
            "name": project.name,
            "type": project.type,
            "description_short": project.description_short,
            "location_city": project.location_city,
            "location_region": project.location_region,
            "country": project.country,
            "budget_amount": project.budget_amount,
            "budget_currency": project.budget_currency,
            "start_date_est": project.start_date_est,
            "end_date_est": project.end_date_est,
            "phase": project.phase,
            "sector_tags": project.sector_tags,
            "ai_extracted_at": datetime.utcnow().isoformat()
        }

        if existing.data:
            project_id = existing.data[0]["id"]
            # Update existing project
            supabase.table("shark_projects").update({
                **project_data,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", project_id).execute()
            logger.debug(f"Updated project: {project_id}")
            return project_id
        else:
            # Insert new project
            result = supabase.table("shark_projects").insert({
                "tenant_id": self.tenant_id,
                **project_data
            }).execute()
            project_id = result.data[0]["id"]
            logger.debug(f"Created project: {project_id}")
            return project_id

    async def _upsert_organization(self, org: ExtractedOrganization) -> str:
        """Upsert an organization, returning its ID."""
        # Try to find existing org by name + city
        query = supabase.table("shark_organizations").select("id").eq(
            "tenant_id", self.tenant_id
        ).eq("name", org.name)

        if org.city:
            query = query.eq("city", org.city)

        existing = query.execute()

        org_data = {
            "name": org.name,
            "org_type": org.org_type,
            "city": org.city,
            "region": org.region,
            "country": org.country
        }

        if existing.data:
            org_id = existing.data[0]["id"]
            # Update existing org
            supabase.table("shark_organizations").update({
                **org_data,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", org_id).execute()
            logger.debug(f"Updated organization: {org_id}")
            return org_id
        else:
            # Insert new org
            result = supabase.table("shark_organizations").insert({
                "tenant_id": self.tenant_id,
                **org_data
            }).execute()
            org_id = result.data[0]["id"]
            logger.debug(f"Created organization: {org_id}")
            return org_id

    async def _link_project_organization(
        self,
        project_id: str,
        organization_id: str,
        role_in_project: str
    ) -> None:
        """Create or update a project-organization relationship."""
        # Check if relationship exists
        existing = supabase.table("shark_project_organizations").select("id").eq(
            "project_id", project_id
        ).eq("organization_id", organization_id).eq(
            "role_in_project", role_in_project
        ).execute()

        if not existing.data:
            supabase.table("shark_project_organizations").insert({
                "project_id": project_id,
                "organization_id": organization_id,
                "role_in_project": role_in_project
            }).execute()
            logger.debug(f"Linked project {project_id} to org {organization_id}")

    async def _link_project_news(
        self,
        project_id: str,
        news_id: str,
        role_of_news: str = "source"
    ) -> None:
        """Create or update a project-news relationship."""
        # Check if relationship exists
        existing = supabase.table("shark_project_news").select("id").eq(
            "project_id", project_id
        ).eq("news_id", news_id).execute()

        if not existing.data:
            supabase.table("shark_project_news").insert({
                "project_id": project_id,
                "news_id": news_id,
                "role_of_news": role_of_news
            }).execute()
            logger.debug(f"Linked project {project_id} to news {news_id}")


# ============================================================
# Convenience Functions
# ============================================================

async def ingest_article_as_project(
    tenant_id: str,
    article_text: str,
    source_url: str,
    source_name: Optional[str] = None,
    region_hint: Optional[str] = None,
    published_at: Optional[str] = None,
    article_title: Optional[str] = None
) -> IngestionResult:
    """
    Convenience function to ingest an article as a project.

    Example:
        result = await ingest_article_as_project(
            tenant_id="xxx-xxx-xxx",
            article_text="La mairie de Toulouse...",
            source_url="https://lemoniteur.fr/article/123",
            source_name="Le Moniteur"
        )

        if result.success and result.project_id:
            print(f"Created project: {result.project_id}")
    """
    service = SharkIngestionService(tenant_id=tenant_id)
    return await service.ingest_article(
        article_text=article_text,
        source_url=source_url,
        source_name=source_name,
        region_hint=region_hint,
        published_at=published_at,
        article_title=article_title
    )


async def batch_ingest_articles(
    tenant_id: str,
    articles: List[Dict[str, Any]]
) -> List[IngestionResult]:
    """
    Batch ingest multiple articles.

    Args:
        tenant_id: UUID of the tenant
        articles: List of article dicts with keys:
            - article_text: str
            - source_url: str
            - source_name: Optional[str]
            - region_hint: Optional[str]
            - published_at: Optional[str]
            - article_title: Optional[str]

    Returns:
        List of IngestionResult for each article
    """
    service = SharkIngestionService(tenant_id=tenant_id)
    results = []

    for i, article in enumerate(articles):
        logger.info(f"Processing article {i+1}/{len(articles)}: {article.get('source_url', 'unknown')}")
        result = await service.ingest_article(
            article_text=article.get("article_text", ""),
            source_url=article.get("source_url", ""),
            source_name=article.get("source_name"),
            region_hint=article.get("region_hint"),
            published_at=article.get("published_at"),
            article_title=article.get("article_title")
        )
        results.append(result)

    # Summary
    success_count = sum(1 for r in results if r.success and r.project_id)
    no_project_count = sum(1 for r in results if r.success and not r.project_id)
    error_count = sum(1 for r in results if not r.success)

    logger.info(f"Batch ingestion complete: {success_count} projects created, {no_project_count} no project found, {error_count} errors")

    return results
