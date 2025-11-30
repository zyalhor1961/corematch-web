"""
Shark BOAMP Service - Public Tenders Integration

Service for fetching and ingesting French public procurement tenders
from BOAMP (Bulletin Officiel des Annonces des Marches Publics).

This module:
1. Fetches recent tenders from BOAMP/data.gouv API
2. Filters for BTP-relevant tenders (construction, renovation, etc.)
3. Transforms tenders into enriched Shark Projects
4. Links MOA (buyers) to shark_organizations
5. Improves scoring based on deadline urgency

Usage:
    from services.shark_boamp_service import (
        fetch_recent_tenders_for_region,
        ingest_tender_as_project,
        TenderIngestionResult,
    )

    # Fetch tenders
    tenders = await fetch_recent_tenders_for_region("Ile-de-France", lookback_days=7)

    # Ingest each tender
    for tender in tenders:
        result = await ingest_tender_as_project(tender, tenant_id, db)

Architecture:
- Fully independent module (like Legal Enrichment)
- Robust error handling (never crashes the job)
- Async/await pattern with Pydantic models
"""

import os
import re
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID, uuid4

import httpx
from pydantic import BaseModel, Field
from loguru import logger
from supabase import Client
from difflib import SequenceMatcher


# ============================================================
# CONFIGURATION
# ============================================================

# BOAMP API endpoints
# Primary: data.gouv.fr BOAMP dataset
BOAMP_API_URL = "https://api.donneespubliques.fr/api/records/1.0/search/"
BOAMP_DATASET = "boamp"

# Fallback: DILA BOAMP API
DILA_BOAMP_URL = "https://boamp.fr/api/v1/annonces"

# Request configuration
API_TIMEOUT = 30.0
MAX_RESULTS_PER_QUERY = 100

# BTP keywords for filtering
BTP_KEYWORDS = [
    "travaux", "construction", "batiment", "bâtiment",
    "renovation", "rénovation", "amenagement", "aménagement",
    "voirie", "assainissement", "génie civil", "genie civil",
    "maconnerie", "maçonnerie", "charpente", "couverture",
    "electricite", "électricité", "plomberie", "chauffage",
    "peinture", "menuiserie", "carrelage", "demolition",
    "terrassement", "fondations", "gros oeuvre", "second oeuvre",
]

# CPV codes for BTP (Construction / Works)
BTP_CPV_PREFIXES = [
    "45",  # Construction work
    "44",  # Construction structures and materials
    "71",  # Architectural services (MOE)
]

# Similarity threshold for project matching
PROJECT_MATCH_THRESHOLD = 0.7

# Score bonus for public tenders
TENDER_SCORE_BONUS = 15


# ============================================================
# PYDANTIC MODELS
# ============================================================

class BoampTender(BaseModel):
    """Parsed tender from BOAMP API."""
    external_id: str
    title: Optional[str] = None
    description: Optional[str] = None
    published_at: Optional[datetime] = None
    deadline_at: Optional[datetime] = None
    procedure_type: Optional[str] = None
    cpv_codes: List[str] = Field(default_factory=list)
    status: str = "published"
    location_city: Optional[str] = None
    location_region: Optional[str] = None
    location_department: Optional[str] = None
    buyer_name: Optional[str] = None
    buyer_siret: Optional[str] = None
    raw_data: Dict[str, Any] = Field(default_factory=dict)


class TenderIngestionResult(BaseModel):
    """Result of tender ingestion."""
    tender_id: UUID
    project_id: Optional[UUID] = None
    created_project: bool = False
    reused_project: bool = False
    created_tender: bool = False
    created_organization: bool = False
    message: Optional[str] = None


class TenderFetchSummary(BaseModel):
    """Summary of tender fetch operation."""
    region: str
    lookback_days: int
    total_fetched: int = 0
    btp_relevant: int = 0
    errors: List[str] = Field(default_factory=list)


class TenderIngestionSummary(BaseModel):
    """Summary of bulk tender ingestion."""
    tenant_id: UUID
    total_tenders: int = 0
    new_projects: int = 0
    reused_projects: int = 0
    new_tenders: int = 0
    new_organizations: int = 0
    failed: int = 0
    results: List[TenderIngestionResult] = Field(default_factory=list)


# ============================================================
# BOAMP API CLIENT
# ============================================================

def _is_btp_relevant(tender_data: dict) -> bool:
    """
    Check if a tender is relevant for BTP sector.

    Checks:
    1. CPV codes starting with BTP prefixes
    2. Keywords in title/description
    """
    # Check CPV codes
    cpv_codes = tender_data.get("cpv", []) or []
    if isinstance(cpv_codes, str):
        cpv_codes = [cpv_codes]

    for cpv in cpv_codes:
        if isinstance(cpv, str):
            for prefix in BTP_CPV_PREFIXES:
                if cpv.startswith(prefix):
                    return True

    # Check keywords in title and description
    text = " ".join([
        (tender_data.get("objet") or ""),
        (tender_data.get("description") or ""),
        (tender_data.get("titre") or ""),
    ]).lower()

    for keyword in BTP_KEYWORDS:
        if keyword in text:
            return True

    return False


def _parse_tender_record(record: dict) -> Optional[BoampTender]:
    """
    Parse a BOAMP API record into a BoampTender.

    Handles various field formats from different API versions.
    """
    try:
        fields = record.get("fields", record)

        # Extract external ID
        external_id = (
            fields.get("idannonce") or
            fields.get("id") or
            fields.get("reference") or
            str(uuid4())[:8]
        )

        # Extract dates
        published_at = None
        deadline_at = None

        pub_date_str = fields.get("dateparution") or fields.get("date_publication")
        if pub_date_str:
            try:
                published_at = datetime.fromisoformat(pub_date_str.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                try:
                    published_at = datetime.strptime(pub_date_str[:10], "%Y-%m-%d")
                    published_at = published_at.replace(tzinfo=timezone.utc)
                except (ValueError, TypeError):
                    pass

        deadline_str = fields.get("datelimite") or fields.get("date_limite_reponse")
        if deadline_str:
            try:
                deadline_at = datetime.fromisoformat(deadline_str.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                try:
                    deadline_at = datetime.strptime(deadline_str[:10], "%Y-%m-%d")
                    deadline_at = deadline_at.replace(tzinfo=timezone.utc)
                except (ValueError, TypeError):
                    pass

        # Extract CPV codes
        cpv_raw = fields.get("cpv") or fields.get("code_cpv") or []
        if isinstance(cpv_raw, str):
            cpv_codes = [c.strip() for c in cpv_raw.split(",") if c.strip()]
        elif isinstance(cpv_raw, list):
            cpv_codes = [str(c) for c in cpv_raw]
        else:
            cpv_codes = []

        # Extract location
        location_city = fields.get("ville") or fields.get("lieu_execution_ville")
        location_region = fields.get("region") or fields.get("lieu_execution_region")
        location_dept = fields.get("departement") or fields.get("lieu_execution_dept")

        # Extract buyer info
        buyer_name = (
            fields.get("organisme") or
            fields.get("acheteur") or
            fields.get("nom_acheteur")
        )
        buyer_siret = fields.get("siret") or fields.get("siret_acheteur")

        # Determine status
        status = "published"
        status_raw = fields.get("etat") or fields.get("statut") or ""
        if isinstance(status_raw, str):
            status_lower = status_raw.lower()
            if "attribu" in status_lower:
                status = "awarded"
            elif "clos" in status_lower or "ferme" in status_lower:
                status = "closed"
            elif "annul" in status_lower:
                status = "cancelled"

        return BoampTender(
            external_id=str(external_id),
            title=fields.get("objet") or fields.get("titre"),
            description=fields.get("descriptif") or fields.get("description"),
            published_at=published_at,
            deadline_at=deadline_at,
            procedure_type=fields.get("typeprocedure") or fields.get("procedure"),
            cpv_codes=cpv_codes,
            status=status,
            location_city=location_city,
            location_region=location_region,
            location_department=location_dept,
            buyer_name=buyer_name,
            buyer_siret=buyer_siret,
            raw_data=fields,
        )

    except Exception as e:
        logger.warning(f"[BOAMP] Failed to parse tender record: {e}")
        return None


async def fetch_recent_tenders_for_region(
    region: str,
    lookback_days: int = 7,
    max_results: int = MAX_RESULTS_PER_QUERY,
) -> Tuple[List[BoampTender], TenderFetchSummary]:
    """
    Fetch recent BTP tenders for a region from BOAMP.

    Args:
        region: Region name (e.g., "Ile-de-France", "Auvergne-Rhone-Alpes")
        lookback_days: How many days back to search
        max_results: Maximum results to return

    Returns:
        Tuple of (list of BoampTender, TenderFetchSummary)

    Notes:
        - Never raises exceptions, returns empty list on error
        - Filters for BTP-relevant tenders only
        - Uses data.gouv.fr BOAMP dataset
    """
    summary = TenderFetchSummary(
        region=region,
        lookback_days=lookback_days,
    )

    tenders: List[BoampTender] = []

    try:
        # Calculate date range
        since_date = (datetime.now(timezone.utc) - timedelta(days=lookback_days)).strftime("%Y-%m-%d")

        # Build query
        # Note: The actual BOAMP API structure may vary
        # This is designed to work with data.gouv.fr datasets
        params = {
            "dataset": BOAMP_DATASET,
            "rows": max_results,
            "sort": "-dateparution",
            "q": f"region:{region} AND dateparution>={since_date}",
        }

        logger.info(f"[BOAMP] Fetching tenders for {region}, last {lookback_days} days")

        async with httpx.AsyncClient(timeout=API_TIMEOUT) as client:
            response = await client.get(BOAMP_API_URL, params=params)

            if response.status_code == 200:
                data = response.json()
                records = data.get("records", [])
                summary.total_fetched = len(records)

                logger.info(f"[BOAMP] Fetched {len(records)} raw records")

                # Parse and filter for BTP
                for record in records:
                    fields = record.get("fields", record)

                    if _is_btp_relevant(fields):
                        tender = _parse_tender_record(record)
                        if tender:
                            tenders.append(tender)
                            summary.btp_relevant += 1

            elif response.status_code == 404:
                # Try alternative approach: search without dataset parameter
                logger.warning("[BOAMP] Dataset not found, trying fallback search")
                summary.errors.append("Primary dataset not found")

            else:
                error_msg = f"BOAMP API returned {response.status_code}"
                logger.error(f"[BOAMP] {error_msg}")
                summary.errors.append(error_msg)

    except httpx.TimeoutException:
        error_msg = "BOAMP API timeout"
        logger.error(f"[BOAMP] {error_msg}")
        summary.errors.append(error_msg)

    except Exception as e:
        error_msg = f"BOAMP fetch error: {str(e)}"
        logger.error(f"[BOAMP] {error_msg}")
        summary.errors.append(error_msg)

    logger.info(
        f"[BOAMP] Fetch complete: {summary.total_fetched} total, "
        f"{summary.btp_relevant} BTP-relevant"
    )

    return tenders, summary


async def fetch_tenders_by_keywords(
    keywords: List[str],
    lookback_days: int = 7,
    max_results: int = MAX_RESULTS_PER_QUERY,
) -> Tuple[List[BoampTender], TenderFetchSummary]:
    """
    Fetch tenders matching specific keywords.

    Alternative fetch method when region filtering isn't available.

    Args:
        keywords: List of keywords to search for
        lookback_days: How many days back to search
        max_results: Maximum results to return

    Returns:
        Tuple of (list of BoampTender, TenderFetchSummary)
    """
    summary = TenderFetchSummary(
        region="keywords:" + ",".join(keywords[:3]),
        lookback_days=lookback_days,
    )

    tenders: List[BoampTender] = []

    try:
        since_date = (datetime.now(timezone.utc) - timedelta(days=lookback_days)).strftime("%Y-%m-%d")

        # Build keyword query
        keyword_query = " OR ".join(keywords)

        params = {
            "dataset": BOAMP_DATASET,
            "rows": max_results,
            "sort": "-dateparution",
            "q": f"({keyword_query}) AND dateparution>={since_date}",
        }

        logger.info(f"[BOAMP] Fetching tenders by keywords: {keywords[:3]}")

        async with httpx.AsyncClient(timeout=API_TIMEOUT) as client:
            response = await client.get(BOAMP_API_URL, params=params)

            if response.status_code == 200:
                data = response.json()
                records = data.get("records", [])
                summary.total_fetched = len(records)

                for record in records:
                    fields = record.get("fields", record)

                    if _is_btp_relevant(fields):
                        tender = _parse_tender_record(record)
                        if tender:
                            tenders.append(tender)
                            summary.btp_relevant += 1

            else:
                error_msg = f"BOAMP API returned {response.status_code}"
                logger.error(f"[BOAMP] {error_msg}")
                summary.errors.append(error_msg)

    except Exception as e:
        error_msg = f"BOAMP fetch error: {str(e)}"
        logger.error(f"[BOAMP] {error_msg}")
        summary.errors.append(error_msg)

    return tenders, summary


# ============================================================
# TENDER INGESTION
# ============================================================

def _text_similarity(text1: Optional[str], text2: Optional[str]) -> float:
    """Calculate similarity ratio between two texts."""
    if not text1 or not text2:
        return 0.0

    # Normalize texts
    t1 = text1.lower().strip()
    t2 = text2.lower().strip()

    return SequenceMatcher(None, t1, t2).ratio()


def _cpv_overlap(cpv1: List[str], cpv2: List[str]) -> float:
    """Calculate overlap between CPV code lists."""
    if not cpv1 or not cpv2:
        return 0.0

    # Compare prefixes (first 2 digits)
    prefixes1 = {cpv[:2] for cpv in cpv1 if len(cpv) >= 2}
    prefixes2 = {cpv[:2] for cpv in cpv2 if len(cpv) >= 2}

    if not prefixes1 or not prefixes2:
        return 0.0

    intersection = len(prefixes1 & prefixes2)
    union = len(prefixes1 | prefixes2)

    return intersection / union if union > 0 else 0.0


def _estimate_scale_from_cpv(cpv_codes: List[str]) -> str:
    """
    Estimate project scale based on CPV codes.

    CPV code patterns:
    - 452xxxxx: Construction of complete constructions (Large/Mega)
    - 453xxxxx: Building installation work (Medium)
    - 454xxxxx: Building completion work (Small/Medium)
    """
    if not cpv_codes:
        return "Medium"

    for cpv in cpv_codes:
        if cpv.startswith("452"):
            # Complete construction = Large projects
            return "Large"
        elif cpv.startswith("451"):
            # Site preparation = often Mega projects
            return "Mega"

    # Default to Medium for other BTP works
    return "Medium"


async def _find_matching_project(
    tender: BoampTender,
    tenant_id: UUID,
    db: Client,
) -> Optional[Dict[str, Any]]:
    """
    Find an existing Shark project matching this tender.

    Matching criteria:
    - Title similarity > threshold
    - CPV code overlap
    - Location match
    - Date proximity
    """
    try:
        # Fetch candidate projects
        # Limit to recent projects in similar location
        query = db.table("shark_projects").select(
            "id, name, description_short, sector_tags, location_city, "
            "location_region, start_date_est, phase"
        ).eq("tenant_id", str(tenant_id))

        if tender.location_region:
            query = query.ilike("location_region", f"%{tender.location_region}%")

        result = query.limit(50).execute()
        candidates = result.data or []

        if not candidates:
            return None

        best_match = None
        best_score = 0.0

        for project in candidates:
            # Calculate match score
            score = 0.0

            # Title similarity (weight: 0.5)
            title_sim = _text_similarity(tender.title, project.get("name"))
            score += title_sim * 0.5

            # CPV/sector overlap (weight: 0.25)
            project_tags = project.get("sector_tags") or []
            cpv_sim = _cpv_overlap(tender.cpv_codes, project_tags)
            score += cpv_sim * 0.25

            # Location match (weight: 0.15)
            if tender.location_city and project.get("location_city"):
                city_sim = _text_similarity(tender.location_city, project.get("location_city"))
                score += city_sim * 0.15

            # Date proximity (weight: 0.1)
            if tender.deadline_at and project.get("start_date_est"):
                try:
                    project_date = datetime.fromisoformat(
                        project["start_date_est"].replace("Z", "+00:00")
                    )
                    days_diff = abs((tender.deadline_at - project_date).days)
                    if days_diff < 30:
                        score += 0.1
                    elif days_diff < 90:
                        score += 0.05
                except (ValueError, TypeError):
                    pass

            if score > best_score and score >= PROJECT_MATCH_THRESHOLD:
                best_score = score
                best_match = project

        if best_match:
            logger.info(
                f"[BOAMP] Found matching project: {best_match.get('name')} "
                f"(score: {best_score:.2f})"
            )

        return best_match

    except Exception as e:
        logger.error(f"[BOAMP] Error finding matching project: {e}")
        return None


async def _upsert_tender(
    tender: BoampTender,
    tenant_id: UUID,
    db: Client,
) -> Tuple[UUID, bool]:
    """
    Upsert tender into shark_public_tenders.

    Returns:
        Tuple of (tender_id, created)
    """
    # Check if exists
    existing = db.table("shark_public_tenders").select("id").eq(
        "tenant_id", str(tenant_id)
    ).eq("external_id", tender.external_id).execute()

    tender_data = {
        "tenant_id": str(tenant_id),
        "external_id": tender.external_id,
        "title": tender.title,
        "description": tender.description,
        "procedure_type": tender.procedure_type,
        "cpv_codes": tender.cpv_codes,
        "published_at": tender.published_at.isoformat() if tender.published_at else None,
        "deadline_at": tender.deadline_at.isoformat() if tender.deadline_at else None,
        "status": tender.status,
        "location_city": tender.location_city,
        "location_region": tender.location_region,
        "location_department": tender.location_department,
        "buyer_name": tender.buyer_name,
        "buyer_siret": tender.buyer_siret,
        "raw_data": tender.raw_data,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    if existing.data:
        # Update existing
        tender_id = UUID(existing.data[0]["id"])
        db.table("shark_public_tenders").update(tender_data).eq(
            "id", str(tender_id)
        ).execute()
        return tender_id, False
    else:
        # Insert new
        result = db.table("shark_public_tenders").insert(tender_data).execute()
        tender_id = UUID(result.data[0]["id"])
        return tender_id, True


async def _create_project_from_tender(
    tender: BoampTender,
    tender_id: UUID,
    tenant_id: UUID,
    db: Client,
) -> UUID:
    """
    Create a new Shark project from a tender.

    Returns:
        Created project UUID
    """
    project_data = {
        "tenant_id": str(tenant_id),
        "name": tender.title or f"Appel d'offres {tender.external_id}",
        "description_short": (tender.description or "")[:500],
        "phase": "appel_offres",
        "location_city": tender.location_city,
        "location_region": tender.location_region,
        "country": "FR",
        "start_date_est": tender.deadline_at.isoformat() if tender.deadline_at else None,
        "sector_tags": tender.cpv_codes,
        "estimated_scale": _estimate_scale_from_cpv(tender.cpv_codes),
        "is_public_tender": True,
        "tender_deadline": tender.deadline_at.isoformat() if tender.deadline_at else None,
        "tender_procedure_type": tender.procedure_type,
        "ai_confidence": 0.95,  # Public tenders are highly reliable
        "shark_score": 50 + TENDER_SCORE_BONUS,  # Base score + tender bonus
        "shark_priority": "MEDIUM",
        "origin": "boamp",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    result = db.table("shark_projects").insert(project_data).execute()
    project_id = UUID(result.data[0]["id"])

    logger.info(f"[BOAMP] Created project: {project_data['name']} (ID: {project_id})")

    return project_id


async def _link_tender_to_project(
    tender_id: UUID,
    project_id: UUID,
    role: str,
    cpv_codes: List[str],
    deadline: Optional[datetime],
    procedure_type: Optional[str],
    db: Client,
) -> None:
    """Create link between tender and project."""
    # Check if link exists
    existing = db.table("shark_project_tenders").select("id").eq(
        "project_id", str(project_id)
    ).eq("tender_id", str(tender_id)).eq("role", role).execute()

    if existing.data:
        return  # Already linked

    link_data = {
        "project_id": str(project_id),
        "tender_id": str(tender_id),
        "role": role,
        "metadata": {
            "cpv_codes": cpv_codes,
            "deadline": deadline.isoformat() if deadline else None,
            "procedure_type": procedure_type,
        },
    }

    db.table("shark_project_tenders").insert(link_data).execute()
    logger.debug(f"[BOAMP] Linked tender {tender_id} to project {project_id}")


async def _create_buyer_organization(
    tender: BoampTender,
    project_id: UUID,
    tenant_id: UUID,
    db: Client,
) -> bool:
    """
    Create organization for the tender buyer (MOA).

    Returns:
        True if organization was created, False if reused
    """
    if not tender.buyer_name:
        return False

    # Check if organization exists (by SIRET or name)
    query = db.table("shark_organizations").select("id").eq(
        "tenant_id", str(tenant_id)
    )

    if tender.buyer_siret:
        query = query.eq("siret", tender.buyer_siret)
    else:
        query = query.ilike("name", tender.buyer_name)

    existing = query.execute()

    if existing.data:
        org_id = existing.data[0]["id"]
        created = False
    else:
        # Create new organization
        org_data = {
            "tenant_id": str(tenant_id),
            "name": tender.buyer_name,
            "org_type": "public_entity",
            "siret": tender.buyer_siret,
            "city": tender.location_city,
            "region": tender.location_region,
            "country": "FR",
            "source_type": "boamp",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        result = db.table("shark_organizations").insert(org_data).execute()
        org_id = result.data[0]["id"]
        created = True

        logger.info(f"[BOAMP] Created organization: {tender.buyer_name}")

    # Link organization to project as MOA
    existing_link = db.table("shark_project_organizations").select("id").eq(
        "project_id", str(project_id)
    ).eq("organization_id", org_id).execute()

    if not existing_link.data:
        link_data = {
            "project_id": str(project_id),
            "organization_id": org_id,
            "role_in_project": "MOA",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        db.table("shark_project_organizations").insert(link_data).execute()

    return created


async def _update_project_score_for_tender(
    project_id: UUID,
    tender: BoampTender,
    db: Client,
) -> None:
    """
    Update project score based on tender information.

    Bonuses:
    - Public tender: +15 points
    - Deadline urgency:
      - < 7 days: +20 points
      - < 14 days: +15 points
      - < 30 days: +10 points
    """
    try:
        # Fetch current score
        project = db.table("shark_projects").select(
            "shark_score"
        ).eq("id", str(project_id)).execute()

        if not project.data:
            return

        current_score = project.data[0].get("shark_score") or 50
        bonus = TENDER_SCORE_BONUS  # Base tender bonus

        # Urgency bonus
        if tender.deadline_at:
            days_until = (tender.deadline_at - datetime.now(timezone.utc)).days
            if days_until < 7:
                bonus += 20
            elif days_until < 14:
                bonus += 15
            elif days_until < 30:
                bonus += 10

        new_score = min(100, current_score + bonus)

        # Determine priority
        if new_score >= 90:
            priority = "CRITICAL"
        elif new_score >= 70:
            priority = "HIGH"
        elif new_score >= 40:
            priority = "MEDIUM"
        else:
            priority = "LOW"

        # Update project
        db.table("shark_projects").update({
            "shark_score": new_score,
            "shark_priority": priority,
            "is_public_tender": True,
            "tender_deadline": tender.deadline_at.isoformat() if tender.deadline_at else None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", str(project_id)).execute()

        logger.debug(
            f"[BOAMP] Updated project score: {current_score} -> {new_score} ({priority})"
        )

    except Exception as e:
        logger.error(f"[BOAMP] Error updating project score: {e}")


async def ingest_tender_as_project(
    tender: BoampTender,
    tenant_id: UUID,
    db: Client,
) -> TenderIngestionResult:
    """
    Ingest a BOAMP tender as a Shark project.

    Pipeline:
    1. Upsert tender in shark_public_tenders
    2. Find matching existing project or create new
    3. Create project-tender link
    4. Create buyer organization (MOA)
    5. Update project score

    Args:
        tender: Parsed BoampTender
        tenant_id: Tenant UUID
        db: Supabase client

    Returns:
        TenderIngestionResult with operation details
    """
    logger.info(f"[BOAMP] Ingesting tender: {tender.external_id} - {tender.title}")

    result = TenderIngestionResult(
        tender_id=uuid4(),  # Placeholder, will be updated
    )

    try:
        # Step 1: Upsert tender
        tender_id, created_tender = await _upsert_tender(tender, tenant_id, db)
        result.tender_id = tender_id
        result.created_tender = created_tender

        # Step 2: Find or create project
        existing_project = await _find_matching_project(tender, tenant_id, db)

        if existing_project:
            project_id = UUID(existing_project["id"])
            result.project_id = project_id
            result.reused_project = True
            role = "update"
        else:
            project_id = await _create_project_from_tender(
                tender, tender_id, tenant_id, db
            )
            result.project_id = project_id
            result.created_project = True
            role = "source"

        # Step 3: Link tender to project
        await _link_tender_to_project(
            tender_id=tender_id,
            project_id=project_id,
            role=role,
            cpv_codes=tender.cpv_codes,
            deadline=tender.deadline_at,
            procedure_type=tender.procedure_type,
            db=db,
        )

        # Step 4: Create buyer organization
        org_created = await _create_buyer_organization(
            tender, project_id, tenant_id, db
        )
        result.created_organization = org_created

        # Step 5: Update project score
        await _update_project_score_for_tender(project_id, tender, db)

        result.message = "tender_ingested_successfully"

        logger.info(
            f"[BOAMP] Ingestion complete: tender={tender.external_id}, "
            f"project={project_id}, new_project={result.created_project}"
        )

    except Exception as e:
        logger.error(f"[BOAMP] Ingestion error for {tender.external_id}: {e}")
        result.message = f"error: {str(e)}"

    return result


async def ingest_tenders_bulk(
    tenders: List[BoampTender],
    tenant_id: UUID,
    db: Client,
) -> TenderIngestionSummary:
    """
    Bulk ingest multiple tenders.

    Args:
        tenders: List of BoampTender objects
        tenant_id: Tenant UUID
        db: Supabase client

    Returns:
        TenderIngestionSummary with statistics
    """
    summary = TenderIngestionSummary(
        tenant_id=tenant_id,
        total_tenders=len(tenders),
    )

    for tender in tenders:
        try:
            result = await ingest_tender_as_project(tender, tenant_id, db)
            summary.results.append(result)

            if result.created_tender:
                summary.new_tenders += 1
            if result.created_project:
                summary.new_projects += 1
            if result.reused_project:
                summary.reused_projects += 1
            if result.created_organization:
                summary.new_organizations += 1

        except Exception as e:
            logger.error(f"[BOAMP] Bulk ingestion error: {e}")
            summary.failed += 1

    logger.info(
        f"[BOAMP] Bulk ingestion complete: {summary.new_tenders} tenders, "
        f"{summary.new_projects} new projects, {summary.reused_projects} reused"
    )

    return summary


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def get_supabase() -> Client:
    """Get or create Supabase client."""
    from supabase import create_client

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")

    if not url or not key:
        raise RuntimeError("Supabase not configured")

    return create_client(url, key)


# ============================================================
# CLI / TESTING
# ============================================================

if __name__ == "__main__":
    import asyncio

    async def test():
        # Test fetch
        tenders, summary = await fetch_recent_tenders_for_region(
            region="Ile-de-France",
            lookback_days=7,
        )

        print(f"Fetched {len(tenders)} BTP tenders")
        for t in tenders[:3]:
            print(f"  - {t.external_id}: {t.title}")
            print(f"    Deadline: {t.deadline_at}")
            print(f"    CPV: {t.cpv_codes}")

    asyncio.run(test())
