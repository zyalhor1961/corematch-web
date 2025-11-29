"""
Shark Graph Service - Centralized data access layer for Shark Hunter

This module provides a clean API for accessing shark_* tables.
All SQL queries for the Shark graph are centralized here.

Architecture:
    Phase 1 (current): Basic CRUD operations
    Phase 2: Integration with ProjectExtractor agent
    Phase 3: Lead Sourcing + navigation IA
    Phase 4: Scoring 360

Usage:
    from services.shark_graph_service import SharkGraphService

    service = SharkGraphService(supabase_client)
    projects = await service.list_projects(tenant_id, filters)
    project = await service.get_project_full(tenant_id, project_id)
"""

import os
import logging
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from supabase import create_client, Client

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
                "Supabase client not initialized. "
                "Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables."
            )
        _supabase = create_client(supabase_url, supabase_key)
    return _supabase


# ============================================================
# Data Classes for Results
# ============================================================

@dataclass
class ProjectSummary:
    """Summary of a Shark project (list view)."""
    id: str
    tenant_id: str
    name: str
    type: Optional[str]
    phase: str
    location_city: Optional[str]
    location_region: Optional[str]
    budget_amount: Optional[float]
    shark_score: Optional[int]
    shark_priority: str
    estimated_scale: Optional[str]
    created_at: str
    org_count: int = 0
    news_count: int = 0


@dataclass
class ProjectFull:
    """Full project with organizations and news."""
    id: str
    tenant_id: str
    name: str
    type: Optional[str]
    description_short: Optional[str]
    location_city: Optional[str]
    location_region: Optional[str]
    country: str
    budget_amount: Optional[float]
    budget_currency: str
    start_date_est: Optional[str]
    end_date_est: Optional[str]
    phase: str
    sector_tags: List[str]
    shark_score: Optional[int]
    shark_priority: str
    estimated_scale: Optional[str]
    ai_confidence: Optional[float]
    ai_extracted_at: Optional[str]
    created_at: str
    updated_at: str
    organizations: List[Dict[str, Any]]
    news_items: List[Dict[str, Any]]
    org_count: int
    news_count: int


@dataclass
class OrganizationSummary:
    """Summary of a Shark organization."""
    id: str
    tenant_id: str
    name: str
    org_type: Optional[str]
    city: Optional[str]
    region: Optional[str]
    size_bucket: Optional[str]
    project_count: int = 0
    people_count: int = 0


@dataclass
class PersonSummary:
    """Summary of a Shark person."""
    id: str
    tenant_id: str
    full_name: str
    title: Optional[str]
    city: Optional[str]
    linkedin_url: Optional[str]


@dataclass
class ListResult:
    """Paginated list result."""
    items: List[Any]
    total_count: int
    page: int
    page_size: int
    has_more: bool


# ============================================================
# Filter Classes
# ============================================================

@dataclass
class ProjectFilters:
    """Filters for project listing."""
    phase: Optional[str] = None
    type: Optional[str] = None
    location_city: Optional[str] = None
    location_region: Optional[str] = None
    estimated_scale: Optional[str] = None
    shark_priority: Optional[str] = None
    min_shark_score: Optional[int] = None
    search: Optional[str] = None  # Full-text search on name
    order_by: str = "created_at"
    order_desc: bool = True
    page: int = 1
    page_size: int = 20


@dataclass
class OrganizationFilters:
    """Filters for organization listing."""
    org_type: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    size_bucket: Optional[str] = None
    search: Optional[str] = None
    order_by: str = "name"
    order_desc: bool = False
    page: int = 1
    page_size: int = 20


# ============================================================
# Shark Graph Service
# ============================================================

class SharkGraphService:
    """
    Centralized service for Shark graph data access.

    All shark_* SQL queries should go through this service.

    Usage:
        service = SharkGraphService()

        # List projects with filters
        result = await service.list_projects(
            tenant_id="xxx",
            filters=ProjectFilters(phase="travaux", page=1)
        )

        # Get full project
        project = await service.get_project_full(tenant_id, project_id)

        # Get organizations for a project
        orgs = await service.get_project_organizations(tenant_id, project_id)
    """

    def __init__(self, supabase_client: Optional[Client] = None):
        """
        Initialize the service.

        Args:
            supabase_client: Optional Supabase client. If not provided,
                           uses the global client from environment.
        """
        self.supabase = supabase_client or get_supabase()

    # --------------------------------------------------------
    # PROJECT METHODS
    # --------------------------------------------------------

    async def get_project_full(
        self,
        tenant_id: str,
        project_id: str
    ) -> Optional[ProjectFull]:
        """
        Get a full project with organizations and news.

        Uses the shark_project_full view for optimal performance.

        Args:
            tenant_id: UUID of the tenant
            project_id: UUID of the project

        Returns:
            ProjectFull or None if not found
        """
        result = self.supabase.table("shark_project_full").select("*").eq(
            "tenant_id", tenant_id
        ).eq("id", project_id).execute()

        if not result.data:
            return None

        row = result.data[0]
        return ProjectFull(
            id=row["id"],
            tenant_id=row["tenant_id"],
            name=row["name"],
            type=row.get("type"),
            description_short=row.get("description_short"),
            location_city=row.get("location_city"),
            location_region=row.get("location_region"),
            country=row.get("country", "FR"),
            budget_amount=row.get("budget_amount"),
            budget_currency=row.get("budget_currency", "EUR"),
            start_date_est=row.get("start_date_est"),
            end_date_est=row.get("end_date_est"),
            phase=row.get("phase", "detection"),
            sector_tags=row.get("sector_tags", []),
            shark_score=row.get("shark_score"),
            shark_priority=row.get("shark_priority", "medium"),
            estimated_scale=row.get("estimated_scale"),
            ai_confidence=row.get("ai_confidence"),
            ai_extracted_at=row.get("ai_extracted_at"),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            organizations=row.get("organizations", []),
            news_items=row.get("news_items", []),
            org_count=row.get("org_count", 0),
            news_count=row.get("news_count", 0)
        )

    async def list_projects(
        self,
        tenant_id: str,
        filters: Optional[ProjectFilters] = None
    ) -> ListResult:
        """
        List projects with pagination and filters.

        Args:
            tenant_id: UUID of the tenant
            filters: Optional filters

        Returns:
            ListResult with ProjectSummary items
        """
        filters = filters or ProjectFilters()

        # Base query
        query = self.supabase.table("shark_project_full").select(
            "id, tenant_id, name, type, phase, location_city, location_region, "
            "budget_amount, shark_score, shark_priority, estimated_scale, "
            "created_at, org_count, news_count",
            count="exact"
        ).eq("tenant_id", tenant_id)

        # Apply filters
        if filters.phase:
            query = query.eq("phase", filters.phase)
        if filters.type:
            query = query.eq("type", filters.type)
        if filters.location_city:
            query = query.eq("location_city", filters.location_city)
        if filters.location_region:
            query = query.eq("location_region", filters.location_region)
        if filters.estimated_scale:
            query = query.eq("estimated_scale", filters.estimated_scale)
        if filters.shark_priority:
            query = query.eq("shark_priority", filters.shark_priority)
        if filters.min_shark_score is not None:
            query = query.gte("shark_score", filters.min_shark_score)
        if filters.search:
            query = query.ilike("name", f"%{filters.search}%")

        # Ordering
        order_col = filters.order_by
        if filters.order_desc:
            query = query.order(order_col, desc=True)
        else:
            query = query.order(order_col)

        # Pagination
        offset = (filters.page - 1) * filters.page_size
        query = query.range(offset, offset + filters.page_size - 1)

        result = query.execute()

        items = [
            ProjectSummary(
                id=row["id"],
                tenant_id=row["tenant_id"],
                name=row["name"],
                type=row.get("type"),
                phase=row.get("phase", "detection"),
                location_city=row.get("location_city"),
                location_region=row.get("location_region"),
                budget_amount=row.get("budget_amount"),
                shark_score=row.get("shark_score"),
                shark_priority=row.get("shark_priority", "medium"),
                estimated_scale=row.get("estimated_scale"),
                created_at=row["created_at"],
                org_count=row.get("org_count", 0),
                news_count=row.get("news_count", 0)
            )
            for row in result.data
        ]

        total_count = result.count or len(items)
        has_more = offset + len(items) < total_count

        return ListResult(
            items=items,
            total_count=total_count,
            page=filters.page,
            page_size=filters.page_size,
            has_more=has_more
        )

    async def get_project_organizations(
        self,
        tenant_id: str,
        project_id: str
    ) -> List[Dict[str, Any]]:
        """
        Get organizations linked to a project.

        Args:
            tenant_id: UUID of the tenant
            project_id: UUID of the project

        Returns:
            List of organization dicts with role info
        """
        # First verify the project belongs to the tenant
        project = self.supabase.table("shark_projects").select("id").eq(
            "tenant_id", tenant_id
        ).eq("id", project_id).execute()

        if not project.data:
            return []

        # Get organizations
        result = self.supabase.table("shark_project_organizations").select(
            "role_in_project, raw_role_label, lot_name, "
            "shark_organizations(id, name, org_type, city, region, website, size_bucket)"
        ).eq("project_id", project_id).execute()

        organizations = []
        for row in result.data:
            org = row.get("shark_organizations", {})
            organizations.append({
                "organization_id": org.get("id"),
                "organization_name": org.get("name"),
                "org_type": org.get("org_type"),
                "role_in_project": row.get("role_in_project"),
                "raw_role_label": row.get("raw_role_label"),
                "lot_name": row.get("lot_name"),
                "city": org.get("city"),
                "region": org.get("region"),
                "website": org.get("website"),
                "size_bucket": org.get("size_bucket")
            })

        return organizations

    async def get_project_news(
        self,
        tenant_id: str,
        project_id: str
    ) -> List[Dict[str, Any]]:
        """
        Get news items linked to a project.

        Args:
            tenant_id: UUID of the tenant
            project_id: UUID of the project

        Returns:
            List of news dicts
        """
        # Verify project belongs to tenant
        project = self.supabase.table("shark_projects").select("id").eq(
            "tenant_id", tenant_id
        ).eq("id", project_id).execute()

        if not project.data:
            return []

        # Get news
        result = self.supabase.table("shark_project_news").select(
            "role_of_news, relevant_excerpt, "
            "shark_news_items(id, title, source_name, source_url, published_at, summary)"
        ).eq("project_id", project_id).order("created_at", desc=True).execute()

        news_items = []
        for row in result.data:
            news = row.get("shark_news_items", {})
            news_items.append({
                "news_id": news.get("id"),
                "title": news.get("title"),
                "source_name": news.get("source_name"),
                "source_url": news.get("source_url"),
                "published_at": news.get("published_at"),
                "summary": news.get("summary"),
                "role_of_news": row.get("role_of_news"),
                "relevant_excerpt": row.get("relevant_excerpt")
            })

        return news_items

    # --------------------------------------------------------
    # ORGANIZATION METHODS
    # --------------------------------------------------------

    async def get_organization_full(
        self,
        tenant_id: str,
        organization_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get a full organization with projects and people.

        Uses the shark_organization_full view.
        """
        result = self.supabase.table("shark_organization_full").select("*").eq(
            "tenant_id", tenant_id
        ).eq("id", organization_id).execute()

        if not result.data:
            return None

        return result.data[0]

    async def list_organizations(
        self,
        tenant_id: str,
        filters: Optional[OrganizationFilters] = None
    ) -> ListResult:
        """
        List organizations with pagination and filters.
        """
        filters = filters or OrganizationFilters()

        query = self.supabase.table("shark_organization_full").select(
            "id, tenant_id, name, org_type, city, region, size_bucket, "
            "project_count, people_count",
            count="exact"
        ).eq("tenant_id", tenant_id)

        if filters.org_type:
            query = query.eq("org_type", filters.org_type)
        if filters.city:
            query = query.eq("city", filters.city)
        if filters.region:
            query = query.eq("region", filters.region)
        if filters.size_bucket:
            query = query.eq("size_bucket", filters.size_bucket)
        if filters.search:
            query = query.ilike("name", f"%{filters.search}%")

        # Ordering
        if filters.order_desc:
            query = query.order(filters.order_by, desc=True)
        else:
            query = query.order(filters.order_by)

        # Pagination
        offset = (filters.page - 1) * filters.page_size
        query = query.range(offset, offset + filters.page_size - 1)

        result = query.execute()

        items = [
            OrganizationSummary(
                id=row["id"],
                tenant_id=row["tenant_id"],
                name=row["name"],
                org_type=row.get("org_type"),
                city=row.get("city"),
                region=row.get("region"),
                size_bucket=row.get("size_bucket"),
                project_count=row.get("project_count", 0),
                people_count=row.get("people_count", 0)
            )
            for row in result.data
        ]

        total_count = result.count or len(items)

        return ListResult(
            items=items,
            total_count=total_count,
            page=filters.page,
            page_size=filters.page_size,
            has_more=offset + len(items) < total_count
        )

    async def get_organization_people(
        self,
        tenant_id: str,
        organization_id: str
    ) -> List[Dict[str, Any]]:
        """
        Get people linked to an organization.
        """
        # Verify org belongs to tenant
        org = self.supabase.table("shark_organizations").select("id").eq(
            "tenant_id", tenant_id
        ).eq("id", organization_id).execute()

        if not org.data:
            return []

        result = self.supabase.table("shark_organization_people").select(
            "role_in_org, is_current, start_date, end_date, "
            "shark_people(id, full_name, title, city, linkedin_url)"
        ).eq("organization_id", organization_id).order(
            "is_current", desc=True
        ).execute()

        people = []
        for row in result.data:
            person = row.get("shark_people", {})
            people.append({
                "person_id": person.get("id"),
                "full_name": person.get("full_name"),
                "title": person.get("title"),
                "role_in_org": row.get("role_in_org"),
                "is_current": row.get("is_current"),
                "city": person.get("city"),
                "linkedin_url": person.get("linkedin_url"),
                "start_date": row.get("start_date"),
                "end_date": row.get("end_date")
            })

        return people

    # --------------------------------------------------------
    # STATISTICS METHODS (for dashboards)
    # --------------------------------------------------------

    async def get_tenant_stats(self, tenant_id: str) -> Dict[str, Any]:
        """
        Get aggregate statistics for a tenant's Shark data.

        Useful for dashboards.
        """
        # Projects by phase
        projects_result = self.supabase.table("shark_projects").select(
            "phase", count="exact"
        ).eq("tenant_id", tenant_id).execute()

        # Count by phase
        phase_counts = {}
        for row in projects_result.data:
            phase = row.get("phase", "detection")
            phase_counts[phase] = phase_counts.get(phase, 0) + 1

        # Total counts
        total_projects = len(projects_result.data)

        orgs_result = self.supabase.table("shark_organizations").select(
            "id", count="exact"
        ).eq("tenant_id", tenant_id).execute()
        total_orgs = orgs_result.count or len(orgs_result.data)

        people_result = self.supabase.table("shark_people").select(
            "id", count="exact"
        ).eq("tenant_id", tenant_id).execute()
        total_people = people_result.count or len(people_result.data)

        news_result = self.supabase.table("shark_news_items").select(
            "id", count="exact"
        ).eq("tenant_id", tenant_id).execute()
        total_news = news_result.count or len(news_result.data)

        return {
            "total_projects": total_projects,
            "total_organizations": total_orgs,
            "total_people": total_people,
            "total_news_items": total_news,
            "projects_by_phase": phase_counts,
            "generated_at": datetime.utcnow().isoformat()
        }


# ============================================================
# Convenience Functions
# ============================================================

async def get_shark_project(
    tenant_id: str,
    project_id: str
) -> Optional[ProjectFull]:
    """Convenience function to get a project."""
    service = SharkGraphService()
    return await service.get_project_full(tenant_id, project_id)


async def list_shark_projects(
    tenant_id: str,
    phase: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 20
) -> ListResult:
    """Convenience function to list projects."""
    service = SharkGraphService()
    filters = ProjectFilters(
        phase=phase,
        search=search,
        page=page,
        page_size=page_size
    )
    return await service.list_projects(tenant_id, filters)


async def get_tenant_shark_stats(tenant_id: str) -> Dict[str, Any]:
    """Convenience function to get tenant stats."""
    service = SharkGraphService()
    return await service.get_tenant_stats(tenant_id)
