"""
Shark Ingestion Service v2.0 - Ingests extracted project data into the shark_* tables

This service handles:
- Upserting news items (deduplication on source_url)
- Deduplicating projects using fuzzy matching (pg_trgm similarity)
- Upserting organizations with strict role taxonomy
- Creating relationships (project_organizations, project_news)

Key features:
- Date Anchor support for temporal normalization
- Strict role taxonomy (MOA, MOE, General_Contractor, etc.)
- Project deduplication with configurable similarity threshold
- Estimated scale tracking (Small/Medium/Large/Mega)
"""

import os
import re
import logging
import unicodedata
from typing import Optional, Dict, Any, List, Tuple
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

# Similarity threshold for project deduplication
DEFAULT_SIMILARITY_THRESHOLD = 0.6


# ============================================================
# Helper Functions
# ============================================================

def normalize_name(name: str) -> str:
    """
    Normalize a project name for deduplication.

    - Lowercase
    - Remove accents
    - Remove articles (le, la, les, de, du, etc.)
    - Collapse whitespace
    """
    if not name:
        return ""

    # Lowercase
    result = name.lower()

    # Remove accents
    result = unicodedata.normalize('NFD', result)
    result = ''.join(c for c in result if unicodedata.category(c) != 'Mn')

    # Remove common French articles
    articles = r"\b(le|la|les|l'|un|une|des|du|de|d'|au|aux)\b"
    result = re.sub(articles, ' ', result, flags=re.IGNORECASE)

    # Collapse whitespace
    result = re.sub(r'\s+', ' ', result).strip()

    return result


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
    is_duplicate: bool = False  # True if project was matched to existing

    def __post_init__(self):
        if self.organization_ids is None:
            self.organization_ids = []


@dataclass
class DedupResult:
    """Result of project deduplication check"""
    found_existing: bool
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    similarity_score: float = 0.0


# ============================================================
# Shark Ingestion Service
# ============================================================

class SharkIngestionService:
    """
    Service to ingest articles and populate the shark_* tables.

    Features:
    - Project deduplication using pg_trgm similarity
    - Strict role taxonomy (MOA, MOE, General_Contractor, etc.)
    - Date Anchor for temporal normalization
    - Estimated scale tracking

    Usage:
        service = SharkIngestionService(tenant_id="xxx")
        result = await service.ingest_article(
            article_text="...",
            source_url="https://...",
            source_name="Le Moniteur"
        )
    """

    def __init__(
        self,
        tenant_id: str,
        similarity_threshold: float = DEFAULT_SIMILARITY_THRESHOLD
    ):
        """
        Initialize the ingestion service.

        Args:
            tenant_id: UUID of the tenant (CoreMatch customer organization)
            similarity_threshold: Threshold for project name similarity (0.0-1.0)
        """
        self.tenant_id = tenant_id
        self.similarity_threshold = similarity_threshold
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
            published_at: Optional publication date (YYYY-MM-DD) - used as DATE ANCHOR
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
                title=article_title or (extraction.news.title if extraction.news else None),
                published_at=published_at or (extraction.news.published_at if extraction.news else None),
                region_hint=region_hint,
                full_text=article_text[:50000]  # Limit stored text
            )

            # Step 4: Find or create project with deduplication
            project_id, is_duplicate = await self.find_or_create_project(extraction.project)

            # Step 5: Upsert organizations and create relationships
            organization_ids = []
            for org in extraction.organizations:
                org_id = await self._upsert_organization(org)
                organization_ids.append(org_id)

                # Create project-organization relationship with raw_role_label
                await self._link_project_organization(
                    project_id=project_id,
                    organization_id=org_id,
                    role_in_project=org.role_in_project,
                    raw_role_label=org.raw_role_label
                )

            # Step 6: Link project to news
            role_of_news = extraction.news.role_of_news if extraction.news else "annonce_projet"
            await self._link_project_news(
                project_id=project_id,
                news_id=news_id,
                role_of_news=role_of_news
            )

            action = "matched existing" if is_duplicate else "created new"
            logger.info(f"Successfully ingested project ({action}): {extraction.project.name}")

            return IngestionResult(
                success=True,
                project_id=project_id,
                news_id=news_id,
                organization_ids=organization_ids,
                extraction_result=extraction,
                is_duplicate=is_duplicate
            )

        except Exception as e:
            logger.exception(f"Ingestion failed for {source_url}: {e}")
            return IngestionResult(
                success=False,
                error_message=str(e)
            )

    async def find_or_create_project(
        self,
        project: ExtractedProject
    ) -> Tuple[str, bool]:
        """
        Find an existing project or create a new one.

        Uses fuzzy matching on normalized name to detect duplicates.

        Args:
            project: Extracted project data

        Returns:
            Tuple of (project_id, is_duplicate)
        """
        # Try to find similar project using pg_trgm
        dedup_result = await self._find_similar_project(project)

        if dedup_result.found_existing:
            logger.info(
                f"Found existing project: '{dedup_result.project_name}' "
                f"(similarity: {dedup_result.similarity_score:.2f})"
            )
            # Update the existing project with new info
            await self._update_project(dedup_result.project_id, project)
            return dedup_result.project_id, True
        else:
            # Create new project
            project_id = await self._create_project(project)
            return project_id, False

    async def _find_similar_project(self, project: ExtractedProject) -> DedupResult:
        """
        Find a similar project using pg_trgm similarity.

        Uses the find_similar_project SQL function.
        """
        try:
            # Call the PostgreSQL function
            result = supabase.rpc(
                "find_similar_project",
                {
                    "p_tenant_id": self.tenant_id,
                    "p_name": project.name,
                    "p_location_city": project.location_city,
                    "p_type": project.type,
                    "p_similarity_threshold": self.similarity_threshold
                }
            ).execute()

            if result.data and len(result.data) > 0:
                best_match = result.data[0]
                return DedupResult(
                    found_existing=True,
                    project_id=best_match["project_id"],
                    project_name=best_match["project_name"],
                    similarity_score=best_match["similarity_score"]
                )
            else:
                return DedupResult(found_existing=False)

        except Exception as e:
            logger.warning(f"Similarity search failed, falling back to exact match: {e}")
            # Fallback to exact name match
            return await self._find_exact_project(project)

    async def _find_exact_project(self, project: ExtractedProject) -> DedupResult:
        """Fallback: find project by exact name match."""
        query = supabase.table("shark_projects").select("id, name").eq(
            "tenant_id", self.tenant_id
        ).eq("name", project.name)

        if project.location_city:
            query = query.eq("location_city", project.location_city)

        result = query.execute()

        if result.data:
            return DedupResult(
                found_existing=True,
                project_id=result.data[0]["id"],
                project_name=result.data[0]["name"],
                similarity_score=1.0
            )
        else:
            return DedupResult(found_existing=False)

    async def _create_project(self, project: ExtractedProject) -> str:
        """Create a new project."""
        project_data = {
            "tenant_id": self.tenant_id,
            "name": project.name,
            "type": project.type,
            "description_short": project.description_short,
            "location_city": project.location_city,
            "location_region": project.location_region,
            "country": project.country or "France",
            "budget_amount": project.budget_amount,
            "budget_currency": project.budget_currency or "EUR",
            "start_date_est": project.start_date_est,
            "end_date_est": project.end_date_est,
            "phase": project.phase or "detection",
            "sector_tags": project.sector_tags or [],
            "estimated_scale": project.estimated_scale or "Medium",
            "ai_extracted_at": datetime.utcnow().isoformat()
        }

        result = supabase.table("shark_projects").insert(project_data).execute()
        project_id = result.data[0]["id"]
        logger.debug(f"Created project: {project_id}")
        return project_id

    async def _update_project(self, project_id: str, project: ExtractedProject) -> None:
        """Update an existing project with new data."""
        update_data = {
            "updated_at": datetime.utcnow().isoformat()
        }

        # Only update fields that have values
        if project.description_short:
            update_data["description_short"] = project.description_short
        if project.budget_amount:
            update_data["budget_amount"] = project.budget_amount
        if project.start_date_est:
            update_data["start_date_est"] = project.start_date_est
        if project.end_date_est:
            update_data["end_date_est"] = project.end_date_est
        if project.phase and project.phase != "detection":
            update_data["phase"] = project.phase
        if project.estimated_scale:
            update_data["estimated_scale"] = project.estimated_scale
        if project.sector_tags:
            # Merge sector tags
            existing = supabase.table("shark_projects").select("sector_tags").eq("id", project_id).execute()
            existing_tags = existing.data[0].get("sector_tags", []) if existing.data else []
            merged_tags = list(set(existing_tags + project.sector_tags))
            update_data["sector_tags"] = merged_tags

        supabase.table("shark_projects").update(update_data).eq("id", project_id).execute()
        logger.debug(f"Updated project: {project_id}")

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

    async def _upsert_organization(self, org: ExtractedOrganization) -> str:
        """Upsert an organization, returning its ID."""
        # Try to find existing org by name + city + org_type
        query = supabase.table("shark_organizations").select("id").eq(
            "tenant_id", self.tenant_id
        ).eq("name", org.name)

        if org.city:
            query = query.eq("city", org.city)
        if org.org_type:
            query = query.eq("org_type", org.org_type)

        existing = query.execute()

        org_data = {
            "name": org.name,
            "org_type": org.org_type or "Other",
            "city": org.city,
            "region": org.region,
            "country": org.country or "France"
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
        role_in_project: str,
        raw_role_label: Optional[str] = None
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
                "role_in_project": role_in_project,
                "raw_role_label": raw_role_label
            }).execute()
            logger.debug(f"Linked project {project_id} to org {organization_id} as {role_in_project}")

    async def _link_project_news(
        self,
        project_id: str,
        news_id: str,
        role_of_news: str = "annonce_projet"
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
            print(f"Is duplicate: {result.is_duplicate}")
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
    duplicate_count = sum(1 for r in results if r.success and r.is_duplicate)
    no_project_count = sum(1 for r in results if r.success and not r.project_id)
    error_count = sum(1 for r in results if not r.success)

    logger.info(
        f"Batch ingestion complete: "
        f"{success_count} projects ({duplicate_count} duplicates matched), "
        f"{no_project_count} no project found, "
        f"{error_count} errors"
    )

    return results
