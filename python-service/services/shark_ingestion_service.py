"""
Shark Ingestion Service - Phase 2.2

Pipeline d'ingestion qui:
1. Appelle ProjectExtractor (Phase 2.1)
2. Applique la déduplication sur les projets (pg_trgm similarity)
3. Insère les données dans les tables shark_*

Ce module NE MODIFIE PAS l'extracteur.

Usage:
    from services.shark_ingestion_service import ingest_article_as_project, ArticleIngestionInput

    result = await ingest_article_as_project(
        ArticleIngestionInput(
            tenant_id=UUID("xxx"),
            source_url="https://lemoniteur.fr/123",
            source_name="Le Moniteur",
            published_at=datetime.now(),
            full_text="La mairie de Toulouse lance..."
        )
    )

    if result.project_id:
        print(f"Project: {result.project_id}")
        print(f"Created: {result.created_project}")
"""

import os
import re
import json
import logging
import unicodedata
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID
from pydantic import BaseModel, Field

from supabase import create_client, Client

# Import Phase 2.1 extractor
from services.shark_project_extractor import (
    extract_project_from_article,
    is_valid_btp_project,
    ProjectExtractionResult,
    ProjectPayload,
    OrganizationPayload,
    NewsPayload,
    ProjectExtractionError
)

# Configure logging
logger = logging.getLogger(__name__)

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
_supabase: Optional[Client] = None


def get_supabase() -> Client:
    """Get or create Supabase client."""
    global _supabase
    if _supabase is None:
        if not supabase_url or not supabase_key:
            raise RuntimeError(
                "Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY."
            )
        _supabase = create_client(supabase_url, supabase_key)
    return _supabase


# ============================================================
# PYDANTIC MODELS
# ============================================================

class ArticleIngestionInput(BaseModel):
    """Input for article ingestion."""
    tenant_id: UUID
    source_url: str
    source_name: str
    published_at: datetime
    full_text: str
    raw_payload: Optional[Dict[str, Any]] = None


class IngestionResult(BaseModel):
    """Result of article ingestion."""
    tenant_id: UUID
    project_id: Optional[UUID] = None
    news_id: Optional[UUID] = None
    organization_ids: List[UUID] = Field(default_factory=list)
    created_project: bool = False
    reused_existing_project: bool = False
    created_organizations_count: int = 0
    reused_organizations_count: int = 0
    message: Optional[str] = None


# ============================================================
# CUSTOM EXCEPTION
# ============================================================

class SharkIngestionError(Exception):
    """Raised when ingestion fails."""
    def __init__(self, message: str, source_url: Optional[str] = None, tenant_id: Optional[UUID] = None):
        super().__init__(message)
        self.source_url = source_url
        self.tenant_id = tenant_id


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def normalize_name(name: str) -> str:
    """
    Normalize a name for deduplication matching.

    - Lowercase
    - Remove accents
    - Remove common uninformative words
    - Collapse whitespace
    """
    if not name:
        return ""

    # Lowercase
    result = name.lower()

    # Remove accents
    result = unicodedata.normalize('NFD', result)
    result = ''.join(c for c in result if unicodedata.category(c) != 'Mn')

    # Remove common uninformative words
    stopwords = r"\b(le|la|les|l'|un|une|des|du|de|d'|au|aux|projet|chantier|travaux|construction|renovation)\b"
    result = re.sub(stopwords, ' ', result, flags=re.IGNORECASE)

    # Collapse whitespace
    result = re.sub(r'\s+', ' ', result).strip()

    return result


def extract_title_from_text(text: str, max_length: int = 100) -> str:
    """Extract a title from the first line of text."""
    if not text:
        return "Article sans titre"

    first_line = text.strip().split('\n')[0].strip()
    if len(first_line) > max_length:
        return first_line[:max_length] + "..."
    return first_line or "Article sans titre"


# ============================================================
# DEDUPLICATION: find_or_create_project
# ============================================================

async def find_or_create_project(
    tenant_id: UUID,
    project: ProjectPayload,
    db: Client
) -> Tuple[UUID, bool]:
    """
    Find an existing project or create a new one.

    Uses pg_trgm similarity matching on normalized_name.

    Args:
        tenant_id: UUID of the tenant
        project: Extracted project payload
        db: Supabase client

    Returns:
        Tuple of (project_id, was_created)
        - was_created=True if new project was created
        - was_created=False if existing project was reused
    """
    # Normalize the project name
    candidate_normalized = normalize_name(project.name)

    if not candidate_normalized:
        # Can't dedupe without a name, create new
        project_id = await _create_project(tenant_id, project, candidate_normalized, db)
        return project_id, True

    # Try to find similar project using pg_trgm RPC function
    try:
        result = db.rpc(
            "find_similar_project",
            {
                "p_tenant_id": str(tenant_id),
                "p_name": project.name,
                "p_location_city": project.location_city,
                "p_type": project.type,
                "p_similarity_threshold": 0.7
            }
        ).execute()

        if result.data and len(result.data) > 0:
            best_match = result.data[0]
            existing_id = UUID(best_match["project_id"])
            similarity = best_match["similarity_score"]

            logger.info(
                f"Found existing project: '{best_match['project_name']}' "
                f"(similarity: {similarity:.2f})"
            )

            # Optionally enrich existing project
            await _enrich_existing_project(existing_id, project, db)

            return existing_id, False

    except Exception as e:
        logger.warning(f"Similarity search failed, trying exact match: {e}")

    # Fallback: exact name match
    existing = db.table("shark_projects").select("id").eq(
        "tenant_id", str(tenant_id)
    ).eq("name", project.name).execute()

    if existing.data:
        existing_id = UUID(existing.data[0]["id"])
        logger.info(f"Found exact match project: {existing_id}")
        await _enrich_existing_project(existing_id, project, db)
        return existing_id, False

    # No match found, create new project
    project_id = await _create_project(tenant_id, project, candidate_normalized, db)
    return project_id, True


async def _create_project(
    tenant_id: UUID,
    project: ProjectPayload,
    normalized_name: str,
    db: Client
) -> UUID:
    """Create a new project in shark_projects."""
    project_data = {
        "tenant_id": str(tenant_id),
        "name": project.name,
        "normalized_name": normalized_name,
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
        "estimated_scale": project.estimated_scale,
        "ai_extracted_at": datetime.utcnow().isoformat(),
        "raw_extraction": project.model_dump()
    }

    result = db.table("shark_projects").insert(project_data).execute()
    project_id = UUID(result.data[0]["id"])

    logger.info(f"Created new project: {project_id} - {project.name}")
    return project_id


async def _enrich_existing_project(
    project_id: UUID,
    project: ProjectPayload,
    db: Client
) -> None:
    """Enrich an existing project with new data if fields are null."""
    # Get current project data
    current = db.table("shark_projects").select(
        "budget_amount, start_date_est, end_date_est, estimated_scale, sector_tags"
    ).eq("id", str(project_id)).execute()

    if not current.data:
        return

    current_data = current.data[0]
    update_data = {"updated_at": datetime.utcnow().isoformat()}
    enriched = False

    # Enrich null fields
    if current_data.get("budget_amount") is None and project.budget_amount:
        update_data["budget_amount"] = project.budget_amount
        enriched = True

    if current_data.get("start_date_est") is None and project.start_date_est:
        update_data["start_date_est"] = project.start_date_est
        enriched = True

    if current_data.get("end_date_est") is None and project.end_date_est:
        update_data["end_date_est"] = project.end_date_est
        enriched = True

    if current_data.get("estimated_scale") is None and project.estimated_scale:
        update_data["estimated_scale"] = project.estimated_scale
        enriched = True

    # Merge sector_tags
    if project.sector_tags:
        existing_tags = current_data.get("sector_tags") or []
        merged_tags = list(set(existing_tags + project.sector_tags))
        if merged_tags != existing_tags:
            update_data["sector_tags"] = merged_tags
            enriched = True

    if enriched:
        db.table("shark_projects").update(update_data).eq("id", str(project_id)).execute()
        logger.debug(f"Enriched existing project {project_id}")


# ============================================================
# ORGANIZATION UPSERT
# ============================================================

async def find_or_create_organization(
    tenant_id: UUID,
    org: OrganizationPayload,
    db: Client
) -> Tuple[UUID, bool]:
    """
    Find an existing organization or create a new one.

    Returns:
        Tuple of (organization_id, was_created)
    """
    # Search for existing org by name (case-insensitive) and optionally city
    query = db.table("shark_organizations").select("id").eq(
        "tenant_id", str(tenant_id)
    ).ilike("name", org.name)

    # If city is provided, also filter by city
    if org.city:
        query = query.or_(f"city.is.null,city.eq.{org.city}")

    existing = query.limit(1).execute()

    if existing.data:
        org_id = UUID(existing.data[0]["id"])
        logger.debug(f"Reused organization: {org.name} ({org_id})")
        return org_id, False

    # Create new organization
    org_data = {
        "tenant_id": str(tenant_id),
        "name": org.name,
        "org_type": org.org_type or "Other",
        "city": org.city,
        "region": org.region,
        "country": org.country or "France",
        "raw_extraction": org.model_dump()
    }

    result = db.table("shark_organizations").insert(org_data).execute()
    org_id = UUID(result.data[0]["id"])

    logger.debug(f"Created organization: {org.name} ({org_id})")
    return org_id, True


async def link_project_organization(
    project_id: UUID,
    organization_id: UUID,
    org: OrganizationPayload,
    db: Client
) -> None:
    """Link a project to an organization if not already linked."""
    # Check if link exists
    existing = db.table("shark_project_organizations").select("id").eq(
        "project_id", str(project_id)
    ).eq("organization_id", str(organization_id)).execute()

    if existing.data:
        logger.debug(f"Link already exists: project {project_id} <-> org {organization_id}")
        return

    # Create link
    link_data = {
        "project_id": str(project_id),
        "organization_id": str(organization_id),
        "role_in_project": org.role_in_project or "Other",
        "raw_role_label": org.raw_role_label,
        "metadata": {"raw_role_label": org.raw_role_label} if org.raw_role_label else {}
    }

    db.table("shark_project_organizations").insert(link_data).execute()
    logger.debug(f"Linked project {project_id} to org {organization_id} as {org.role_in_project}")


# ============================================================
# NEWS UPSERT
# ============================================================

async def upsert_news(
    tenant_id: UUID,
    input_data: ArticleIngestionInput,
    extraction_result: Optional[ProjectExtractionResult],
    db: Client
) -> Tuple[UUID, bool]:
    """
    Upsert a news item in shark_news_items.

    Returns:
        Tuple of (news_id, was_created)
    """
    # Check if news already exists
    existing = db.table("shark_news_items").select("id").eq(
        "tenant_id", str(tenant_id)
    ).eq("source_url", input_data.source_url).execute()

    # Prepare news data
    news_title = None
    news_role = "annonce_projet"
    news_published = input_data.published_at.isoformat()

    if extraction_result and extraction_result.news:
        news_title = extraction_result.news.title
        news_role = extraction_result.news.role_of_news or "annonce_projet"
        if extraction_result.news.published_at:
            news_published = extraction_result.news.published_at

    # Fallback title
    if not news_title:
        news_title = extract_title_from_text(input_data.full_text)

    # Build raw_data
    raw_data = input_data.raw_payload or {}
    if extraction_result and extraction_result.news:
        raw_data["extraction"] = extraction_result.news.model_dump()

    if existing.data:
        # Update existing news
        news_id = UUID(existing.data[0]["id"])

        db.table("shark_news_items").update({
            "title": news_title,
            "source_name": input_data.source_name,
            "full_text": input_data.full_text,
            "published_at": news_published,
            "raw_data": raw_data,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", str(news_id)).execute()

        logger.info(f"Updated existing news: {news_id}")
        return news_id, False

    # Create new news
    news_data = {
        "tenant_id": str(tenant_id),
        "source_url": input_data.source_url,
        "source_name": input_data.source_name,
        "title": news_title,
        "full_text": input_data.full_text,
        "published_at": news_published,
        "raw_data": raw_data,
        "crawled_at": datetime.utcnow().isoformat()
    }

    result = db.table("shark_news_items").insert(news_data).execute()
    news_id = UUID(result.data[0]["id"])

    logger.info(f"Created news: {news_id} - {news_title[:50]}...")
    return news_id, True


async def link_project_news(
    project_id: UUID,
    news_id: UUID,
    role_of_news: str,
    db: Client
) -> None:
    """Link a project to a news item if not already linked."""
    # Check if link exists
    existing = db.table("shark_project_news").select("id").eq(
        "project_id", str(project_id)
    ).eq("news_id", str(news_id)).execute()

    if existing.data:
        logger.debug(f"Link already exists: project {project_id} <-> news {news_id}")
        return

    # Create link
    link_data = {
        "project_id": str(project_id),
        "news_id": str(news_id),
        "role_of_news": role_of_news or "annonce_projet"
    }

    db.table("shark_project_news").insert(link_data).execute()
    logger.debug(f"Linked project {project_id} to news {news_id}")


# ============================================================
# MAIN INGESTION PIPELINE
# ============================================================

async def ingest_article_as_project(
    input: ArticleIngestionInput,
) -> IngestionResult:
    """
    Main ingestion pipeline.

    Steps:
    0. Check if news exists
    1. Call ProjectExtractor
    2. Upsert news
    3. Dedupe & upsert project
    4. Upsert organizations + links
    5. Link news to project
    6. Return IngestionResult

    Args:
        input: ArticleIngestionInput with all required data

    Returns:
        IngestionResult with IDs and statistics

    Raises:
        SharkIngestionError: If ingestion fails
    """
    db = get_supabase()
    tenant_id = input.tenant_id

    # Initialize counters
    created_orgs = 0
    reused_orgs = 0
    organization_ids: List[UUID] = []

    try:
        # ─────────────────────────────────────────────────────
        # STEP 0: Check if news already exists (for logging)
        # ─────────────────────────────────────────────────────
        existing_news = db.table("shark_news_items").select("id").eq(
            "tenant_id", str(tenant_id)
        ).eq("source_url", input.source_url).execute()

        news_existed = bool(existing_news.data)
        if news_existed:
            logger.info(f"News already exists for URL: {input.source_url}")

        # ─────────────────────────────────────────────────────
        # STEP 1: Call ProjectExtractor
        # ─────────────────────────────────────────────────────
        logger.info(f"Extracting project from: {input.source_url}")

        try:
            extraction_result = await extract_project_from_article(
                article_text=input.full_text,
                source_name=input.source_name,
                source_url=input.source_url,
                published_at_input=input.published_at
            )
        except ProjectExtractionError as e:
            logger.error(f"Extraction failed: {e}")
            raise SharkIngestionError(
                f"Extraction failed: {e}",
                source_url=input.source_url,
                tenant_id=tenant_id
            )

        # ─────────────────────────────────────────────────────
        # STEP 2: Upsert news
        # ─────────────────────────────────────────────────────
        news_id, news_created = await upsert_news(
            tenant_id=tenant_id,
            input_data=input,
            extraction_result=extraction_result,
            db=db
        )

        # ─────────────────────────────────────────────────────
        # CHECK: Is this a valid BTP project?
        # ─────────────────────────────────────────────────────
        if not is_valid_btp_project(extraction_result):
            logger.info(f"No valid BTP project detected in: {input.source_url}")

            return IngestionResult(
                tenant_id=tenant_id,
                project_id=None,
                news_id=news_id,
                organization_ids=[],
                created_project=False,
                reused_existing_project=False,
                created_organizations_count=0,
                reused_organizations_count=0,
                message="No valid BTP project detected"
            )

        # ─────────────────────────────────────────────────────
        # STEP 3: Dedupe & upsert project
        # ─────────────────────────────────────────────────────
        project_id, project_created = await find_or_create_project(
            tenant_id=tenant_id,
            project=extraction_result.project,
            db=db
        )

        # ─────────────────────────────────────────────────────
        # STEP 4: Upsert organizations + links
        # ─────────────────────────────────────────────────────
        for org in extraction_result.organizations:
            if not org.name:
                continue

            org_id, org_created = await find_or_create_organization(
                tenant_id=tenant_id,
                org=org,
                db=db
            )

            organization_ids.append(org_id)

            if org_created:
                created_orgs += 1
            else:
                reused_orgs += 1

            # Link project to organization
            await link_project_organization(
                project_id=project_id,
                organization_id=org_id,
                org=org,
                db=db
            )

        # ─────────────────────────────────────────────────────
        # STEP 5: Link news to project
        # ─────────────────────────────────────────────────────
        news_role = extraction_result.news.role_of_news if extraction_result.news else "annonce_projet"
        await link_project_news(
            project_id=project_id,
            news_id=news_id,
            role_of_news=news_role,
            db=db
        )

        # ─────────────────────────────────────────────────────
        # STEP 6: Build result
        # ─────────────────────────────────────────────────────
        action = "created" if project_created else "reused existing"
        message = f"OK - Project {action}: {extraction_result.project.name}"

        if news_existed:
            message += " (news already existed)"

        logger.info(
            f"Ingestion complete: project_id={project_id}, "
            f"created={project_created}, orgs_created={created_orgs}, orgs_reused={reused_orgs}"
        )

        return IngestionResult(
            tenant_id=tenant_id,
            project_id=project_id,
            news_id=news_id,
            organization_ids=organization_ids,
            created_project=project_created,
            reused_existing_project=not project_created,
            created_organizations_count=created_orgs,
            reused_organizations_count=reused_orgs,
            message=message
        )

    except SharkIngestionError:
        raise
    except Exception as e:
        logger.exception(f"Ingestion failed for {input.source_url}: {e}")
        raise SharkIngestionError(
            f"Ingestion failed: {e}",
            source_url=input.source_url,
            tenant_id=tenant_id
        )


# ============================================================
# BATCH INGESTION
# ============================================================

async def ingest_articles_batch(
    articles: List[ArticleIngestionInput]
) -> List[IngestionResult]:
    """
    Ingest multiple articles.

    Args:
        articles: List of ArticleIngestionInput

    Returns:
        List of IngestionResult for each article
    """
    results = []

    for i, article in enumerate(articles):
        logger.info(f"Processing article {i+1}/{len(articles)}: {article.source_url}")

        try:
            result = await ingest_article_as_project(article)
            results.append(result)
        except SharkIngestionError as e:
            logger.error(f"Failed to ingest {article.source_url}: {e}")
            # Create error result
            results.append(IngestionResult(
                tenant_id=article.tenant_id,
                project_id=None,
                news_id=None,
                organization_ids=[],
                created_project=False,
                reused_existing_project=False,
                created_organizations_count=0,
                reused_organizations_count=0,
                message=f"Error: {str(e)}"
            ))

    # Summary
    success_count = sum(1 for r in results if r.project_id or r.news_id)
    project_count = sum(1 for r in results if r.project_id)
    created_count = sum(1 for r in results if r.created_project)
    reused_count = sum(1 for r in results if r.reused_existing_project)
    no_btp_count = sum(1 for r in results if r.message and "No valid BTP" in r.message)
    error_count = sum(1 for r in results if r.message and "Error:" in r.message)

    logger.info(
        f"Batch complete: {len(articles)} articles, "
        f"{project_count} projects ({created_count} new, {reused_count} reused), "
        f"{no_btp_count} non-BTP, {error_count} errors"
    )

    return results


# ============================================================
# INGESTION STATS
# ============================================================

class DailyBreakdown(BaseModel):
    """Daily statistics breakdown."""
    date: str
    articles_ingested: int = 0
    projects_created: int = 0
    projects_updated: int = 0
    news_created: int = 0


class SharkIngestionStats(BaseModel):
    """Ingestion statistics for admin monitoring."""
    tenant_id: UUID
    period_days: int
    total_articles_ingested: int = 0
    total_projects: int = 0
    total_projects_this_period: int = 0
    total_organizations: int = 0
    total_news_items: int = 0
    daily_breakdown: List[DailyBreakdown] = Field(default_factory=list)
    last_ingestion_at: Optional[datetime] = None


async def get_shark_ingestion_stats(
    tenant_id: UUID,
    days: int = 7
) -> SharkIngestionStats:
    """
    Get ingestion statistics for a tenant.

    Args:
        tenant_id: UUID of the tenant
        days: Number of days to look back (default: 7)

    Returns:
        SharkIngestionStats with aggregated data
    """
    db = get_supabase()

    # Calculate date range
    from datetime import date, timedelta
    end_date = date.today()
    start_date = end_date - timedelta(days=days)

    stats = SharkIngestionStats(
        tenant_id=tenant_id,
        period_days=days,
    )

    try:
        # Total projects
        projects_total = db.table("shark_projects").select(
            "id", count="exact"
        ).eq("tenant_id", str(tenant_id)).execute()
        stats.total_projects = projects_total.count or 0

        # Projects created in period
        projects_period = db.table("shark_projects").select(
            "id", count="exact"
        ).eq("tenant_id", str(tenant_id)).gte(
            "created_at", start_date.isoformat()
        ).execute()
        stats.total_projects_this_period = projects_period.count or 0

        # Total organizations
        orgs_total = db.table("shark_organizations").select(
            "id", count="exact"
        ).eq("tenant_id", str(tenant_id)).execute()
        stats.total_organizations = orgs_total.count or 0

        # Total news items
        news_total = db.table("shark_news_items").select(
            "id", count="exact"
        ).eq("tenant_id", str(tenant_id)).execute()
        stats.total_news_items = news_total.count or 0

        # News in period (proxy for articles ingested)
        news_period = db.table("shark_news_items").select(
            "id", count="exact"
        ).eq("tenant_id", str(tenant_id)).gte(
            "crawled_at", start_date.isoformat()
        ).execute()
        stats.total_articles_ingested = news_period.count or 0

        # Last ingestion
        last_news = db.table("shark_news_items").select(
            "crawled_at"
        ).eq("tenant_id", str(tenant_id)).order(
            "crawled_at", desc=True
        ).limit(1).execute()

        if last_news.data:
            stats.last_ingestion_at = datetime.fromisoformat(
                last_news.data[0]["crawled_at"].replace("Z", "+00:00")
            )

        # Daily breakdown
        daily_data = {}
        current_date = start_date
        while current_date <= end_date:
            daily_data[current_date.isoformat()] = DailyBreakdown(
                date=current_date.isoformat()
            )
            current_date += timedelta(days=1)

        # Get news by day
        news_by_day = db.table("shark_news_items").select(
            "crawled_at"
        ).eq("tenant_id", str(tenant_id)).gte(
            "crawled_at", start_date.isoformat()
        ).execute()

        for item in news_by_day.data or []:
            crawled_at = item.get("crawled_at", "")
            if crawled_at:
                day = crawled_at[:10]  # YYYY-MM-DD
                if day in daily_data:
                    daily_data[day].articles_ingested += 1

        # Get projects by day
        projects_by_day = db.table("shark_projects").select(
            "created_at"
        ).eq("tenant_id", str(tenant_id)).gte(
            "created_at", start_date.isoformat()
        ).execute()

        for item in projects_by_day.data or []:
            created_at = item.get("created_at", "")
            if created_at:
                day = created_at[:10]
                if day in daily_data:
                    daily_data[day].projects_created += 1

        stats.daily_breakdown = list(daily_data.values())

    except Exception as e:
        logger.error(f"Error getting ingestion stats: {e}")
        # Return partial stats

    return stats
