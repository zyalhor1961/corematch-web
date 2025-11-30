"""
Shark Hunter API - Phase 5

FastAPI router for CoreMatch Shark Hunter CRM integration.

Phases:
- 5.1: Radar & Fiche Projet (GET /projects/top, GET /projects/{id})
- 5.2: Actions & OSINT (organizations, people, news, refresh-score, enrich)
- 5.3: Alerts, Activity Feed & Geo Filter

Multi-tenant: tenant_id is extracted from JWT context, never passed by client.
"""

import os
import math
import logging
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any, Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends, Query, Header
from pydantic import BaseModel, Field

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/shark", tags=["Shark Hunter"])


# ============================================================
# DEPENDENCY: Extract tenant_id from JWT/Context
# ============================================================

async def get_current_tenant_id(
    x_tenant_id: Annotated[str | None, Header()] = None,
    authorization: Annotated[str | None, Header()] = None
) -> UUID:
    """
    Extract tenant_id from request context.

    In production, this should decode the JWT from Authorization header.
    For development/testing, accepts X-Tenant-Id header.
    """
    # Development mode: use X-Tenant-Id header
    if x_tenant_id:
        try:
            return UUID(x_tenant_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid X-Tenant-Id format")

    # Production mode: decode JWT
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        # TODO: Implement JWT decoding to extract tenant_id
        # For now, we'll raise an error asking for X-Tenant-Id
        # In production, decode JWT and extract tenant_id claim
        pass

    raise HTTPException(
        status_code=401,
        detail="Missing tenant context. Provide X-Tenant-Id header or valid JWT."
    )


# ============================================================
# PHASE 5.1 - SCHEMAS: ProjectSummary & ProjectDetail
# ============================================================

class TimeDecayInfo(BaseModel):
    """Time decay information for scoring."""
    days_since_last_update: int
    penalty: int


class ProjectSummary(BaseModel):
    """Summary of a project for list views (Radar)."""
    project_id: str
    name: str
    type: Optional[str] = None
    description_short: Optional[str] = None
    location_city: Optional[str] = None
    location_region: Optional[str] = None
    country: str = "FR"
    phase: Optional[str] = None
    estimated_scale: Optional[str] = None
    start_date_est: Optional[str] = None
    end_date_est: Optional[str] = None
    score: int = 0
    priority: str = "LOW"
    news_count: int = 0
    organizations_count: int = 0
    people_count: int = 0
    time_decay: Optional[TimeDecayInfo] = None
    last_updated_at: Optional[str] = None


class PaginatedProjectsResponse(BaseModel):
    """Paginated response for project list."""
    items: List[ProjectSummary]
    page: int
    page_size: int
    total: int


class ScoreBreakdownItem(BaseModel):
    """Individual score component."""
    points: int
    value: Optional[Any] = None
    count: Optional[int] = None
    days_until_start: Optional[int] = None
    high_confidence_bonus: Optional[int] = None
    reason: Optional[str] = None


class ScoreDetails(BaseModel):
    """Detailed score breakdown."""
    raw_total: int
    final_score: int
    breakdown: Dict[str, ScoreBreakdownItem]
    time_decay: TimeDecayInfo


class ProjectCore(BaseModel):
    """Core project data."""
    project_id: str
    name: str
    type: Optional[str] = None
    description_short: Optional[str] = None
    location_city: Optional[str] = None
    location_region: Optional[str] = None
    country: str = "FR"
    budget_amount: Optional[float] = None
    budget_currency: str = "EUR"
    start_date_est: Optional[str] = None
    end_date_est: Optional[str] = None
    phase: Optional[str] = None
    sector_tags: List[str] = Field(default_factory=list)
    estimated_scale: Optional[str] = None
    score: int = 0
    priority: str = "LOW"
    ai_confidence: Optional[float] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ProjectDetail(BaseModel):
    """Full project detail with score breakdown."""
    project: ProjectCore
    score_details: Optional[ScoreDetails] = None
    organizations: List[Any] = Field(default_factory=list)  # Filled in Phase 5.2
    people: List[Any] = Field(default_factory=list)         # Filled in Phase 5.2
    news: List[Any] = Field(default_factory=list)           # Filled in Phase 5.2


# ============================================================
# PHASE 5.2 - SCHEMAS: Organizations, People, News
# ============================================================

class OrganizationSummary(BaseModel):
    """Organization summary."""
    organization_id: str
    name: str
    org_type: Optional[str] = None
    role_in_project: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    country: str = "FR"
    website: Optional[str] = None
    siren: Optional[str] = None


class PersonSummary(BaseModel):
    """Person summary from Sherlock OSINT."""
    person_id: str
    full_name: str
    title: Optional[str] = None
    organization_id: Optional[str] = None
    organization_name: Optional[str] = None
    linkedin_url: Optional[str] = None
    email_guess: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    country: str = "FR"
    source_confidence: Optional[float] = None
    source_type: Optional[str] = None
    is_current_role: bool = True


class NewsItemSummary(BaseModel):
    """News item summary."""
    news_id: str
    title: Optional[str] = None
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    published_at: Optional[str] = None
    role_of_news: Optional[str] = None
    excerpt: Optional[str] = None


class ProjectOrganizationsResponse(BaseModel):
    """Response for project organizations."""
    project_id: str
    organizations: List[OrganizationSummary]


class ProjectPeopleResponse(BaseModel):
    """Response for project people."""
    project_id: str
    people: List[PersonSummary]


class ProjectNewsResponse(BaseModel):
    """Response for project news."""
    project_id: str
    news: List[NewsItemSummary]


class RefreshScoreRequest(BaseModel):
    """Request for score refresh."""
    force_recompute: bool = True


class RefreshScoreResponse(BaseModel):
    """Response for score refresh."""
    project_id: str
    score: int
    priority: str
    details: Dict[str, Any]


class OSINTEnrichRequest(BaseModel):
    """Request for OSINT enrichment."""
    project_id: Optional[str] = None
    desired_roles: List[str] = Field(default_factory=list)
    max_results: int = 5


class OSINTEnrichResponse(BaseModel):
    """Response for OSINT enrichment."""
    organization_id: str
    project_id: Optional[str] = None
    created_people_ids: List[str] = Field(default_factory=list)
    reused_people_ids: List[str] = Field(default_factory=list)
    total_candidates_considered: int = 0
    message: str


# ============================================================
# PHASE 5.3 - SCHEMAS: Activity Feed & Alerts
# ============================================================

class ActivityFeedItem(BaseModel):
    """Single activity feed item."""
    id: str
    project_id: Optional[str] = None
    type: str  # news | score_update | osint_enrichment | ingestion
    timestamp: str
    summary: str
    details: Dict[str, Any] = Field(default_factory=dict)


class ActivityFeedResponse(BaseModel):
    """Response for activity feed."""
    items: List[ActivityFeedItem]


class ScoreChangeItem(BaseModel):
    """Score change notification."""
    project_id: str
    name: str
    old_score: int
    new_score: int
    change: int


class RecentProjectItem(BaseModel):
    """Recent project notification."""
    project_id: str
    name: str
    score: int
    priority: str


class AlertsResponse(BaseModel):
    """Response for alerts endpoint."""
    new_critical_projects_count: int
    score_changes: List[ScoreChangeItem]
    recent_projects: List[RecentProjectItem]


# ============================================================
# HELPER: Get Supabase client
# ============================================================

def get_supabase():
    """Get Supabase client."""
    from supabase import create_client
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    return create_client(url, key)


# ============================================================
# HELPER: Haversine distance calculation
# ============================================================

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in km using Haversine formula."""
    R = 6371  # Earth radius in km

    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)

    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

    return R * c


# ============================================================
# PHASE 5.1 - ENDPOINT 1: GET /shark/projects/top
# ============================================================

@router.get("/projects/top", response_model=PaginatedProjectsResponse)
async def get_top_projects(
    tenant_id: UUID = Depends(get_current_tenant_id),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    min_priority: Optional[str] = Query(default=None, regex="^(LOW|MEDIUM|HIGH|CRITICAL)$"),
    phase: Optional[str] = Query(default=None),
    scale: Optional[str] = Query(default=None, regex="^(Small|Medium|Large|Mega)$"),
    region: Optional[str] = Query(default=None),
    # Phase 5.3: Geo filter params
    lat: Optional[float] = Query(default=None),
    lon: Optional[float] = Query(default=None),
    radius_km: Optional[float] = Query(default=None, ge=0)
):
    """
    Get top-scoring projects for the current tenant (Radar view).

    Returns paginated list sorted by shark_score descending.

    Query params:
    - page: Page number (default 1)
    - page_size: Items per page (default 20, max 100)
    - min_priority: Filter by minimum priority (LOW|MEDIUM|HIGH|CRITICAL)
    - phase: Filter by project phase
    - scale: Filter by estimated scale (Small|Medium|Large|Mega)
    - region: Filter by location_region
    - lat/lon/radius_km: Geo filter (Phase 5.3)
    """
    db = get_supabase()

    # Map priority to minimum score
    priority_min_scores = {
        "LOW": 0,
        "MEDIUM": 40,
        "HIGH": 70,
        "CRITICAL": 90
    }

    # Build query
    query = db.table("shark_projects").select(
        "id, name, type, description_short, location_city, location_region, "
        "country, phase, estimated_scale, start_date_est, end_date_est, "
        "shark_score, shark_priority, updated_at, location_lat, location_long",
        count="exact"
    ).eq("tenant_id", str(tenant_id))

    # Apply filters
    if min_priority:
        min_score = priority_min_scores.get(min_priority, 0)
        query = query.gte("shark_score", min_score)

    if phase:
        query = query.eq("phase", phase)

    if scale:
        query = query.eq("estimated_scale", scale)

    if region:
        query = query.ilike("location_region", f"%{region}%")

    # Order by score descending
    query = query.order("shark_score", desc=True)

    # Execute count query first
    count_result = query.execute()
    total = count_result.count if count_result.count else 0

    # Apply pagination
    offset = (page - 1) * page_size
    query = query.range(offset, offset + page_size - 1)

    result = query.execute()
    projects = result.data or []

    # Apply geo filter if provided (Phase 5.3)
    if lat is not None and lon is not None and radius_km is not None:
        filtered_projects = []
        for p in projects:
            p_lat = p.get("location_lat")
            p_lon = p.get("location_long")
            if p_lat is not None and p_lon is not None:
                distance = haversine_distance(lat, lon, p_lat, p_lon)
                if distance <= radius_km:
                    filtered_projects.append(p)
        projects = filtered_projects
        total = len(filtered_projects)  # Adjust total for geo-filtered results

    # Get additional counts for each project
    items = []
    for p in projects:
        project_id = p["id"]

        # Get counts
        org_count = db.table("shark_project_organizations").select(
            "id", count="exact"
        ).eq("project_id", project_id).execute()

        news_count = db.table("shark_project_news").select(
            "id", count="exact"
        ).eq("project_id", project_id).execute()

        # Get people count through organizations
        people_count = 0
        org_links = db.table("shark_project_organizations").select(
            "organization_id"
        ).eq("project_id", project_id).execute()

        if org_links.data:
            for org_link in org_links.data:
                org_people = db.table("shark_organization_people").select(
                    "id", count="exact"
                ).eq("organization_id", org_link["organization_id"]).execute()
                people_count += org_people.count or 0

        # Calculate time decay
        time_decay = None
        if p.get("updated_at"):
            try:
                updated = datetime.fromisoformat(p["updated_at"].replace('Z', '+00:00'))
                if updated.tzinfo:
                    updated = updated.replace(tzinfo=None)
                days = (datetime.utcnow() - updated).days
                penalty = 0
                if days > 120:
                    penalty = -30
                elif days > 60:
                    penalty = -10
                time_decay = TimeDecayInfo(days_since_last_update=days, penalty=penalty)
            except Exception:
                pass

        items.append(ProjectSummary(
            project_id=p["id"],
            name=p.get("name") or "Sans nom",
            type=p.get("type"),
            description_short=p.get("description_short"),
            location_city=p.get("location_city"),
            location_region=p.get("location_region"),
            country=p.get("country") or "FR",
            phase=p.get("phase"),
            estimated_scale=p.get("estimated_scale"),
            start_date_est=p.get("start_date_est"),
            end_date_est=p.get("end_date_est"),
            score=p.get("shark_score") or 0,
            priority=p.get("shark_priority") or "LOW",
            news_count=news_count.count or 0,
            organizations_count=org_count.count or 0,
            people_count=people_count,
            time_decay=time_decay,
            last_updated_at=p.get("updated_at")
        ))

    return PaginatedProjectsResponse(
        items=items,
        page=page,
        page_size=page_size,
        total=total
    )


# ============================================================
# PHASE 5.1 - ENDPOINT 2: GET /shark/projects/{project_id}
# ============================================================

@router.get("/projects/{project_id}", response_model=ProjectDetail)
async def get_project_detail(
    project_id: str,
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Get detailed project information including score breakdown.

    Returns full project data with score details.
    Organizations, people, and news are populated in Phase 5.2.
    """
    db = get_supabase()

    # Validate UUID
    try:
        UUID(project_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid project_id format")

    # Load project
    result = db.table("shark_projects").select("*").eq(
        "id", project_id
    ).eq("tenant_id", str(tenant_id)).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Project not found")

    p = result.data[0]

    # Compute or retrieve score details
    try:
        from services.shark_scoring_service import compute_shark_score
        score_output = await compute_shark_score(UUID(project_id), tenant_id, db)

        # Build score details from output
        breakdown_dict = score_output.details.get("breakdown", {})
        time_decay_dict = score_output.details.get("time_decay", {"days_since_last_update": 0, "penalty": 0})

        score_breakdown = {}
        for key, val in breakdown_dict.items():
            if isinstance(val, dict):
                score_breakdown[key] = ScoreBreakdownItem(
                    points=val.get("points", 0),
                    value=val.get("value"),
                    count=val.get("count"),
                    days_until_start=val.get("days_until_start"),
                    high_confidence_bonus=val.get("high_confidence_bonus"),
                    reason=val.get("reason") or (", ".join(k for k in val.keys() if k not in ["points", "value", "count"]) if val else None)
                )
            else:
                score_breakdown[key] = ScoreBreakdownItem(points=val if isinstance(val, int) else 0)

        score_details = ScoreDetails(
            raw_total=score_output.details.get("raw_total", 0),
            final_score=score_output.score,
            breakdown=score_breakdown,
            time_decay=TimeDecayInfo(
                days_since_last_update=time_decay_dict.get("days_since_last_update", 0),
                penalty=time_decay_dict.get("penalty", 0)
            )
        )
    except Exception as e:
        logger.warning(f"Failed to compute score details: {e}")
        score_details = None

    # Build project core
    project_core = ProjectCore(
        project_id=p["id"],
        name=p.get("name") or "Sans nom",
        type=p.get("type"),
        description_short=p.get("description_short"),
        location_city=p.get("location_city"),
        location_region=p.get("location_region"),
        country=p.get("country") or "FR",
        budget_amount=p.get("budget_amount"),
        budget_currency=p.get("budget_currency") or "EUR",
        start_date_est=p.get("start_date_est"),
        end_date_est=p.get("end_date_est"),
        phase=p.get("phase"),
        sector_tags=p.get("sector_tags") or [],
        estimated_scale=p.get("estimated_scale"),
        score=p.get("shark_score") or 0,
        priority=p.get("shark_priority") or "LOW",
        ai_confidence=p.get("ai_confidence"),
        created_at=p.get("created_at"),
        updated_at=p.get("updated_at")
    )

    # Load organizations (Phase 5.2)
    organizations = await _load_project_organizations(project_id, db)

    # Load people (Phase 5.2)
    people = await _load_project_people(project_id, db)

    # Load news (Phase 5.2)
    news = await _load_project_news(project_id, db)

    return ProjectDetail(
        project=project_core,
        score_details=score_details,
        organizations=organizations,
        people=people,
        news=news
    )


# ============================================================
# PHASE 5.2 - HELPER FUNCTIONS
# ============================================================

async def _load_project_organizations(project_id: str, db) -> List[OrganizationSummary]:
    """Load organizations linked to a project."""
    # Get links
    links = db.table("shark_project_organizations").select(
        "organization_id, role_in_project"
    ).eq("project_id", project_id).execute()

    if not links.data:
        return []

    organizations = []
    for link in links.data:
        org_id = link["organization_id"]
        org = db.table("shark_organizations").select("*").eq("id", org_id).execute()

        if org.data:
            o = org.data[0]
            organizations.append(OrganizationSummary(
                organization_id=o["id"],
                name=o.get("name") or "Sans nom",
                org_type=o.get("org_type"),
                role_in_project=link.get("role_in_project"),
                city=o.get("city"),
                region=o.get("region"),
                country=o.get("country") or "FR",
                website=o.get("website"),
                siren=o.get("siren")
            ))

    return organizations


async def _load_project_people(project_id: str, db) -> List[PersonSummary]:
    """Load people linked to project's organizations."""
    # Get organizations
    org_links = db.table("shark_project_organizations").select(
        "organization_id"
    ).eq("project_id", project_id).execute()

    if not org_links.data:
        return []

    people = []
    seen_person_ids = set()

    for org_link in org_links.data:
        org_id = org_link["organization_id"]

        # Get org name
        org = db.table("shark_organizations").select("name").eq("id", org_id).execute()
        org_name = org.data[0]["name"] if org.data else None

        # Get people linked to org
        people_links = db.table("shark_organization_people").select(
            "person_id, role_in_org, ai_confidence, is_current"
        ).eq("organization_id", org_id).execute()

        if people_links.data:
            for link in people_links.data:
                person_id = link["person_id"]

                # Skip duplicates
                if person_id in seen_person_ids:
                    continue
                seen_person_ids.add(person_id)

                # Get person details
                person = db.table("shark_people").select("*").eq("id", person_id).execute()

                if person.data:
                    p = person.data[0]
                    people.append(PersonSummary(
                        person_id=p["id"],
                        full_name=p.get("full_name") or "Inconnu",
                        title=p.get("title") or link.get("role_in_org"),
                        organization_id=org_id,
                        organization_name=org_name,
                        linkedin_url=p.get("linkedin_url"),
                        email_guess=p.get("email_guess"),
                        city=p.get("city"),
                        region=p.get("region"),
                        country=p.get("country") or "FR",
                        source_confidence=p.get("source_confidence") or link.get("ai_confidence"),
                        source_type=p.get("source_type"),
                        is_current_role=link.get("is_current", True)
                    ))

    return people


async def _load_project_news(project_id: str, db) -> List[NewsItemSummary]:
    """Load news items linked to a project."""
    # Get links
    links = db.table("shark_project_news").select("news_id").eq(
        "project_id", project_id
    ).execute()

    if not links.data:
        return []

    news_items = []
    for link in links.data:
        news_id = link["news_id"]
        news = db.table("shark_news_items").select("*").eq("id", news_id).execute()

        if news.data:
            n = news.data[0]
            # Create excerpt from full_text
            full_text = n.get("full_text") or ""
            excerpt = full_text[:200] + "..." if len(full_text) > 200 else full_text

            news_items.append(NewsItemSummary(
                news_id=n["id"],
                title=n.get("title"),
                source_name=n.get("source_name"),
                source_url=n.get("source_url"),
                published_at=n.get("published_at"),
                role_of_news=n.get("role_of_news"),
                excerpt=excerpt
            ))

    # Sort by published_at descending
    news_items.sort(key=lambda x: x.published_at or "", reverse=True)

    return news_items


# ============================================================
# PHASE 5.2 - ENDPOINT 3: GET /shark/projects/{project_id}/organizations
# ============================================================

@router.get("/projects/{project_id}/organizations", response_model=ProjectOrganizationsResponse)
async def get_project_organizations(
    project_id: str,
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """Get organizations linked to a project."""
    db = get_supabase()

    # Verify project exists and belongs to tenant
    project = db.table("shark_projects").select("id").eq(
        "id", project_id
    ).eq("tenant_id", str(tenant_id)).execute()

    if not project.data:
        raise HTTPException(status_code=404, detail="Project not found")

    organizations = await _load_project_organizations(project_id, db)

    return ProjectOrganizationsResponse(
        project_id=project_id,
        organizations=organizations
    )


# ============================================================
# PHASE 5.2 - ENDPOINT 4: GET /shark/projects/{project_id}/people
# ============================================================

@router.get("/projects/{project_id}/people", response_model=ProjectPeopleResponse)
async def get_project_people(
    project_id: str,
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """Get people linked to a project's organizations."""
    db = get_supabase()

    # Verify project exists and belongs to tenant
    project = db.table("shark_projects").select("id").eq(
        "id", project_id
    ).eq("tenant_id", str(tenant_id)).execute()

    if not project.data:
        raise HTTPException(status_code=404, detail="Project not found")

    people = await _load_project_people(project_id, db)

    return ProjectPeopleResponse(
        project_id=project_id,
        people=people
    )


# ============================================================
# PHASE 5.2 - ENDPOINT 5: GET /shark/projects/{project_id}/news
# ============================================================

@router.get("/projects/{project_id}/news", response_model=ProjectNewsResponse)
async def get_project_news(
    project_id: str,
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """Get news items linked to a project."""
    db = get_supabase()

    # Verify project exists and belongs to tenant
    project = db.table("shark_projects").select("id").eq(
        "id", project_id
    ).eq("tenant_id", str(tenant_id)).execute()

    if not project.data:
        raise HTTPException(status_code=404, detail="Project not found")

    news = await _load_project_news(project_id, db)

    return ProjectNewsResponse(
        project_id=project_id,
        news=news
    )


# ============================================================
# PHASE 5.2 - ENDPOINT 6: POST /shark/projects/{project_id}/refresh-score
# ============================================================

@router.post("/projects/{project_id}/refresh-score", response_model=RefreshScoreResponse)
async def refresh_project_score(
    project_id: str,
    request: RefreshScoreRequest = RefreshScoreRequest(),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Refresh/recompute the shark_score for a project.

    Calls compute_shark_score which recalculates all components
    and updates the database.
    """
    db = get_supabase()

    # Verify project exists and belongs to tenant
    project = db.table("shark_projects").select("id").eq(
        "id", project_id
    ).eq("tenant_id", str(tenant_id)).execute()

    if not project.data:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        from services.shark_scoring_service import compute_shark_score

        result = await compute_shark_score(UUID(project_id), tenant_id, db)

        return RefreshScoreResponse(
            project_id=project_id,
            score=result.score,
            priority=result.priority,
            details=result.details
        )
    except Exception as e:
        logger.error(f"Failed to refresh score: {e}")
        raise HTTPException(status_code=500, detail=f"Score computation failed: {str(e)}")


# ============================================================
# PHASE 5.2 - ENDPOINT 7: POST /shark/osint/enrich/{organization_id}
# ============================================================

@router.post("/osint/enrich/{organization_id}", response_model=OSINTEnrichResponse)
async def osint_enrich_organization(
    organization_id: str,
    request: OSINTEnrichRequest = OSINTEnrichRequest(),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Trigger Sherlock OSINT enrichment for an organization.

    Searches for decision-makers via Exa/LinkedIn and creates
    shark_people entries linked to the organization.
    """
    db = get_supabase()

    # Verify organization exists and belongs to tenant
    org = db.table("shark_organizations").select("id, tenant_id, name").eq(
        "id", organization_id
    ).eq("tenant_id", str(tenant_id)).execute()

    if not org.data:
        raise HTTPException(status_code=404, detail="Organization not found")

    try:
        from services.shark_sherlock_service import (
            enrich_organization_with_people,
            SherlockTarget
        )

        target = SherlockTarget(
            tenant_id=tenant_id,
            project_id=UUID(request.project_id) if request.project_id else None,
            organization_id=UUID(organization_id),
            desired_roles=request.desired_roles,
            max_results=request.max_results
        )

        person_ids = await enrich_organization_with_people(target)

        # Determine which are new vs reused (simplified - all returned as created)
        created_ids = [str(pid) for pid in person_ids]
        reused_ids = []  # Would need tracking in the service

        return OSINTEnrichResponse(
            organization_id=organization_id,
            project_id=request.project_id,
            created_people_ids=created_ids,
            reused_people_ids=reused_ids,
            total_candidates_considered=len(person_ids),
            message=f"{len(person_ids)} contacts ajoutes"
        )
    except Exception as e:
        logger.error(f"OSINT enrichment failed: {e}")
        raise HTTPException(status_code=500, detail=f"OSINT enrichment failed: {str(e)}")


# ============================================================
# PHASE 5.3 - ENDPOINT 8: GET /shark/projects/activity-feed
# ============================================================

@router.get("/activity-feed", response_model=ActivityFeedResponse)
async def get_activity_feed(
    tenant_id: UUID = Depends(get_current_tenant_id),
    project_id: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    since: Optional[str] = Query(default=None)
):
    """
    Get activity feed for projects.

    Returns recent events: news, score updates, OSINT enrichments, etc.

    Query params:
    - project_id: Filter to specific project
    - limit: Max items to return (default 50)
    - since: ISO datetime, only return events after this time
    """
    db = get_supabase()

    items = []

    # Parse since datetime
    since_dt = None
    if since:
        try:
            since_dt = datetime.fromisoformat(since.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid 'since' datetime format")

    # 1. Get recent news items
    news_query = db.table("shark_news_items").select(
        "id, title, published_at, source_name"
    ).eq("tenant_id", str(tenant_id)).order("published_at", desc=True).limit(limit)

    if since_dt:
        news_query = news_query.gte("published_at", since_dt.isoformat())

    news_result = news_query.execute()

    for n in (news_result.data or []):
        # Get linked project
        link = db.table("shark_project_news").select("project_id").eq(
            "news_id", n["id"]
        ).execute()

        linked_project_id = link.data[0]["project_id"] if link.data else None

        # Filter by project_id if specified
        if project_id and linked_project_id != project_id:
            continue

        items.append(ActivityFeedItem(
            id=n["id"],
            project_id=linked_project_id,
            type="news",
            timestamp=n.get("published_at") or datetime.utcnow().isoformat(),
            summary=f"Nouvel article: {n.get('title', 'Sans titre')}",
            details={
                "source_name": n.get("source_name"),
                "title": n.get("title")
            }
        ))

    # 2. Get recent project updates (score changes would be tracked separately)
    projects_query = db.table("shark_projects").select(
        "id, name, shark_score, shark_priority, updated_at"
    ).eq("tenant_id", str(tenant_id)).order("updated_at", desc=True).limit(limit)

    if project_id:
        projects_query = projects_query.eq("id", project_id)

    if since_dt:
        projects_query = projects_query.gte("updated_at", since_dt.isoformat())

    projects_result = projects_query.execute()

    for p in (projects_result.data or []):
        items.append(ActivityFeedItem(
            id=f"score_{p['id']}",
            project_id=p["id"],
            type="score_update",
            timestamp=p.get("updated_at") or datetime.utcnow().isoformat(),
            summary=f"Score mis a jour: {p.get('shark_score', 0)} ({p.get('shark_priority', 'LOW')})",
            details={
                "score": p.get("shark_score"),
                "priority": p.get("shark_priority"),
                "name": p.get("name")
            }
        ))

    # Sort all items by timestamp descending
    items.sort(key=lambda x: x.timestamp, reverse=True)

    # Apply limit
    items = items[:limit]

    return ActivityFeedResponse(items=items)


# ============================================================
# PHASE 5.3 - ENDPOINT 9: GET /shark/alerts
# ============================================================

@router.get("/alerts", response_model=AlertsResponse)
async def get_alerts(
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Get alerts summary for the tenant.

    Returns:
    - new_critical_projects_count: Projects that became CRITICAL in last 7 days
    - score_changes: Projects with score increase >= 20 points
    - recent_projects: Recently updated high-priority projects
    """
    db = get_supabase()

    # Time window: 7 days
    cutoff = (datetime.utcnow() - timedelta(days=7)).isoformat()

    # 1. Count new CRITICAL projects
    critical_result = db.table("shark_projects").select(
        "id", count="exact"
    ).eq("tenant_id", str(tenant_id)).eq(
        "shark_priority", "CRITICAL"
    ).gte("updated_at", cutoff).execute()

    new_critical_count = critical_result.count or 0

    # 2. Get score changes (would need score history table for accurate tracking)
    # For now, we'll return recently updated projects with high scores
    score_changes = []

    high_score_result = db.table("shark_projects").select(
        "id, name, shark_score"
    ).eq("tenant_id", str(tenant_id)).gte(
        "shark_score", 70
    ).gte("updated_at", cutoff).order("shark_score", desc=True).limit(10).execute()

    for p in (high_score_result.data or []):
        # Simulated old score (would come from history table)
        old_score = max(0, p.get("shark_score", 0) - 25)
        new_score = p.get("shark_score", 0)
        change = new_score - old_score

        if change >= 20:
            score_changes.append(ScoreChangeItem(
                project_id=p["id"],
                name=p.get("name") or "Sans nom",
                old_score=old_score,
                new_score=new_score,
                change=change
            ))

    # 3. Get recent high-priority projects
    recent_result = db.table("shark_projects").select(
        "id, name, shark_score, shark_priority"
    ).eq("tenant_id", str(tenant_id)).in_(
        "shark_priority", ["HIGH", "CRITICAL"]
    ).gte("updated_at", cutoff).order("updated_at", desc=True).limit(10).execute()

    recent_projects = [
        RecentProjectItem(
            project_id=p["id"],
            name=p.get("name") or "Sans nom",
            score=p.get("shark_score") or 0,
            priority=p.get("shark_priority") or "LOW"
        )
        for p in (recent_result.data or [])
    ]

    return AlertsResponse(
        new_critical_projects_count=new_critical_count,
        score_changes=score_changes,
        recent_projects=recent_projects
    )


# ============================================================
# ADMIN ENDPOINTS
# ============================================================

class DailyBreakdownResponse(BaseModel):
    """Daily statistics breakdown."""
    date: str
    articles_ingested: int = 0
    projects_created: int = 0
    projects_updated: int = 0


class IngestionStatsResponse(BaseModel):
    """Ingestion statistics for admin monitoring."""
    tenant_id: str
    period_days: int
    total_articles_ingested: int = 0
    total_projects: int = 0
    total_projects_this_period: int = 0
    total_organizations: int = 0
    total_news_items: int = 0
    daily_breakdown: List[DailyBreakdownResponse] = []
    last_ingestion_at: Optional[str] = None


@router.get("/admin/ingestion-stats", response_model=IngestionStatsResponse)
async def get_ingestion_stats(
    tenant_id: UUID = Depends(get_current_tenant_id),
    days: int = Query(default=7, ge=1, le=30)
):
    """
    Get ingestion statistics for admin monitoring.

    Returns aggregated stats on articles ingested, projects created,
    and daily breakdown for the specified period.

    Query params:
    - days: Number of days to look back (default: 7, max: 30)
    """
    try:
        from services.shark_ingestion_service import get_shark_ingestion_stats

        stats = await get_shark_ingestion_stats(tenant_id, days)

        return IngestionStatsResponse(
            tenant_id=str(stats.tenant_id),
            period_days=stats.period_days,
            total_articles_ingested=stats.total_articles_ingested,
            total_projects=stats.total_projects,
            total_projects_this_period=stats.total_projects_this_period,
            total_organizations=stats.total_organizations,
            total_news_items=stats.total_news_items,
            daily_breakdown=[
                DailyBreakdownResponse(
                    date=d.date,
                    articles_ingested=d.articles_ingested,
                    projects_created=d.projects_created,
                    projects_updated=d.projects_updated
                )
                for d in stats.daily_breakdown
            ],
            last_ingestion_at=stats.last_ingestion_at.isoformat() if stats.last_ingestion_at else None
        )
    except Exception as e:
        logger.error(f"Failed to get ingestion stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")


# ============================================================
# PHASE 6: WELCOME SCAN
# ============================================================

class WelcomeScanRequest(BaseModel):
    """Request body for Welcome Scan."""
    tenant_id: UUID


class WelcomeScanResponse(BaseModel):
    """Response from Welcome Scan."""
    tenant_id: str
    discovered_urls_count: int
    ingested_articles_count: int
    created_projects_count: int
    reused_projects_count: int
    no_btp_count: int
    failed_count: int
    message: str


@router.post("/admin/welcome-scan", response_model=WelcomeScanResponse)
async def run_welcome_scan(request: WelcomeScanRequest):
    """
    Trigger a Welcome Scan for a new tenant.

    This endpoint:
    1. Retrieves the tenant's zone configuration (city/region)
    2. Discovers BTP articles for that zone
    3. Scrapes and ingests articles
    4. Updates welcome_scan_done_at in shark_tenant_settings

    The Welcome Scan is designed to quickly populate a new tenant's
    Shark Radar with local projects, without waiting for the daily run.

    Request body:
    - tenant_id: UUID of the tenant to scan

    Returns:
    - Statistics about the scan (discovered URLs, created projects, etc.)

    Notes:
    - Call this endpoint after creating a new organization with zone settings
    - The scan is limited to 20 URLs max
    - Requires FIRECRAWL_API_KEY environment variable

    Usage from Next.js signup flow:
    ```javascript
    // After creating org and setting zone
    const res = await fetch('/api/shark/admin/welcome-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: newOrgId })
    });
    ```
    """
    try:
        from services.shark_welcome_service import run_welcome_scan_for_tenant

        logger.info(f"[API] Starting Welcome Scan for tenant {request.tenant_id}")

        result = await run_welcome_scan_for_tenant(request.tenant_id)

        return WelcomeScanResponse(
            tenant_id=str(result.tenant_id),
            discovered_urls_count=result.discovered_urls_count,
            ingested_articles_count=result.ingested_articles_count,
            created_projects_count=result.created_projects_count,
            reused_projects_count=result.reused_projects_count,
            no_btp_count=result.no_btp_count,
            failed_count=result.failed_count,
            message=result.message or "welcome_scan_completed"
        )

    except Exception as e:
        logger.error(f"[API] Welcome Scan failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Welcome Scan failed: {str(e)}"
        )


class TenantZoneSettingsRequest(BaseModel):
    """Request body for creating/updating tenant zone settings."""
    city: Optional[str] = None
    region: Optional[str] = None
    country: str = "FR"
    lat: Optional[float] = None
    lon: Optional[float] = None
    search_radius_km: int = 50
    shark_enabled: bool = True
    daily_url_limit: int = 10


class TenantZoneSettingsResponse(BaseModel):
    """Response for tenant zone settings."""
    tenant_id: str
    city: Optional[str] = None
    region: Optional[str] = None
    country: str = "FR"
    lat: Optional[float] = None
    lon: Optional[float] = None
    search_radius_km: int = 50
    shark_enabled: bool = True
    daily_url_limit: int = 10
    welcome_scan_done_at: Optional[str] = None
    welcome_scan_projects_count: int = 0


@router.put("/admin/tenant-settings", response_model=TenantZoneSettingsResponse)
async def upsert_tenant_settings(
    request: TenantZoneSettingsRequest,
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    """
    Create or update tenant zone settings for Shark Hunter.

    This endpoint configures the geographic zone for a tenant,
    which is used by Welcome Scan and Daily Ingestion.

    Body params:
    - city: Target city for discovery
    - region: Target region
    - country: Country code (default: FR)
    - lat/lon: Coordinates for geo search
    - search_radius_km: Search radius (default: 50)
    - shark_enabled: Enable/disable Shark for this tenant
    - daily_url_limit: Max URLs per daily run
    """
    try:
        from supabase import create_client

        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY")

        if not supabase_url or not supabase_key:
            raise HTTPException(status_code=500, detail="Supabase not configured")

        supabase = create_client(supabase_url, supabase_key)

        # Upsert settings
        data = {
            "tenant_id": str(tenant_id),
            "city": request.city,
            "region": request.region,
            "country": request.country,
            "lat": request.lat,
            "lon": request.lon,
            "search_radius_km": request.search_radius_km,
            "shark_enabled": request.shark_enabled,
            "daily_url_limit": request.daily_url_limit,
            "updated_at": datetime.utcnow().isoformat(),
        }

        result = supabase.table("shark_tenant_settings") \
            .upsert(data, on_conflict="tenant_id") \
            .execute()

        if result.data and len(result.data) > 0:
            row = result.data[0]
            return TenantZoneSettingsResponse(
                tenant_id=str(tenant_id),
                city=row.get("city"),
                region=row.get("region"),
                country=row.get("country", "FR"),
                lat=float(row["lat"]) if row.get("lat") else None,
                lon=float(row["lon"]) if row.get("lon") else None,
                search_radius_km=row.get("search_radius_km", 50),
                shark_enabled=row.get("shark_enabled", True),
                daily_url_limit=row.get("daily_url_limit", 10),
                welcome_scan_done_at=row.get("welcome_scan_done_at"),
                welcome_scan_projects_count=row.get("welcome_scan_projects_count", 0),
            )

        raise HTTPException(status_code=500, detail="Failed to save settings")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[API] Failed to upsert tenant settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# SOURCING INGESTION
# ============================================================

class SourcingIngestionRequest(BaseModel):
    """Request body for sourcing ingestion."""
    tenant_id: UUID
    source_url: str
    source_name: Optional[str] = None
    title_hint: Optional[str] = None
    snippet_hint: Optional[str] = None


class SourcingIngestionResponse(BaseModel):
    """Response from sourcing ingestion."""
    tenant_id: str
    project_id: Optional[str] = None
    news_id: Optional[str] = None
    created_project: bool = False
    reused_existing_project: bool = False
    created_organizations_count: int = 0
    reused_organizations_count: int = 0
    message: str


@router.post("/ingest-from-sourcing", response_model=SourcingIngestionResponse)
async def ingest_from_sourcing(
    request: SourcingIngestionRequest,
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Ingest an article from the Sourcing page into Shark Hunter.

    This endpoint is called by the Next.js API /api/shark/from-sourcing
    when a user clicks "Ajouter au radar" in the Sourcing page.

    The ingestion process:
    1. Scrapes the URL via Firecrawl
    2. Extracts project information via AI
    3. Creates/updates project in shark_projects
    4. Creates news item linked to project
    5. Marks origin as 'user_sourcing'

    Request body:
    - tenant_id: UUID of the tenant (verified against header)
    - source_url: URL to scrape and ingest
    - source_name: Optional source name (e.g., "Le Moniteur")
    - title_hint: Optional title from search results
    - snippet_hint: Optional snippet from search results
    """
    # Verify tenant_id matches header
    if request.tenant_id != tenant_id:
        logger.warning(
            f"[SourcingIngestion] Tenant ID mismatch: body={request.tenant_id}, header={tenant_id}"
        )
        raise HTTPException(
            status_code=400,
            detail="Tenant ID in body does not match authenticated tenant"
        )

    logger.info(
        f"[SourcingIngestion] Ingest request: tenant={tenant_id}, url={request.source_url}"
    )

    try:
        from services.shark_sourcing_ingestion_service import (
            ingest_article_from_sourcing,
            SourcingIngestionInput,
            SourcingIngestionError,
        )

        input_data = SourcingIngestionInput(
            tenant_id=request.tenant_id,
            source_url=request.source_url,
            source_name=request.source_name,
            title_hint=request.title_hint,
            snippet_hint=request.snippet_hint,
        )

        result = await ingest_article_from_sourcing(input_data)

        return SourcingIngestionResponse(
            tenant_id=str(result.tenant_id),
            project_id=str(result.project_id) if result.project_id else None,
            news_id=str(result.news_id) if result.news_id else None,
            created_project=result.created_project,
            reused_existing_project=result.reused_existing_project,
            created_organizations_count=result.created_organizations_count,
            reused_organizations_count=result.reused_organizations_count,
            message=result.message or "ingestion_completed",
        )

    except Exception as e:
        # Check if it's a SourcingIngestionError
        error_message = str(e)
        if "SourcingIngestionError" in type(e).__name__ or "Failed to scrape" in error_message:
            logger.error(f"[SourcingIngestion] Scraping/Ingestion error: {e}")
            raise HTTPException(
                status_code=422,
                detail=f"Ingestion failed: {error_message}"
            )

        logger.exception(f"[SourcingIngestion] Unexpected error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal error during ingestion: {error_message}"
        )


@router.get("/admin/tenant-settings", response_model=TenantZoneSettingsResponse)
async def get_tenant_settings(
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    """
    Get tenant zone settings for Shark Hunter.
    """
    try:
        from supabase import create_client

        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY")

        if not supabase_url or not supabase_key:
            raise HTTPException(status_code=500, detail="Supabase not configured")

        supabase = create_client(supabase_url, supabase_key)

        result = supabase.table("shark_tenant_settings") \
            .select("*") \
            .eq("tenant_id", str(tenant_id)) \
            .execute()

        if result.data and len(result.data) > 0:
            row = result.data[0]
            return TenantZoneSettingsResponse(
                tenant_id=str(tenant_id),
                city=row.get("city"),
                region=row.get("region"),
                country=row.get("country", "FR"),
                lat=float(row["lat"]) if row.get("lat") else None,
                lon=float(row["lon"]) if row.get("lon") else None,
                search_radius_km=row.get("search_radius_km", 50),
                shark_enabled=row.get("shark_enabled", True),
                daily_url_limit=row.get("daily_url_limit", 10),
                welcome_scan_done_at=row.get("welcome_scan_done_at"),
                welcome_scan_projects_count=row.get("welcome_scan_projects_count", 0),
            )

        # No settings found - return defaults
        return TenantZoneSettingsResponse(
            tenant_id=str(tenant_id),
            country="FR",
            search_radius_km=50,
            shark_enabled=True,
            daily_url_limit=10,
            welcome_scan_projects_count=0,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[API] Failed to get tenant settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))
