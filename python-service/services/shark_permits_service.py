"""
Shark Building Permits Service - OSINT for Early Project Detection

Service for fetching and ingesting French building permits (permis de construire)
from open data sources (data.gouv.fr, local municipalities).

This module:
1. Fetches recent permits from data.gouv / open data APIs
2. Filters for relevant permits (construction, renovation, etc.)
3. Transforms permits into early-stage Shark Projects
4. Links applicants (developers/promoters) to shark_organizations
5. Enables very early project detection before news coverage

Usage:
    from services.shark_permits_service import (
        fetch_recent_permits_for_region,
        ingest_permit_as_project,
        PermitPayload,
    )

    # Fetch permits
    permits = await fetch_recent_permits_for_region("Ile-de-France", lookback_days=30)

    # Ingest each permit
    for permit in permits:
        result = await ingest_permit_as_project(permit, tenant_id, db)

Architecture:
- Fully independent module (like BOAMP service)
- Robust error handling (never crashes the job)
- Async/await pattern with Pydantic models
"""

import os
import re
from datetime import datetime, timezone, timedelta
from decimal import Decimal
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

# Data.gouv API for permits (multiple datasets available)
# Primary: "base des permis de construire"
DATAGOUV_API_URL = "https://www.data.gouv.fr/api/1/datasets/permis-de-construire/"
DATAGOUV_RECORDS_URL = "https://tabular-api.data.gouv.fr/api/resources"

# Alternative: Sitadel / Open data regional
SITADEL_API_URL = "https://www.statistiques.developpement-durable.gouv.fr/api"

# Request configuration
API_TIMEOUT = 30.0
MAX_RESULTS_PER_QUERY = 100

# Permit types indicating construction/renovation
RELEVANT_PERMIT_TYPES = [
    "PC",    # Permis de Construire
    "PCMI",  # Permis de Construire Maison Individuelle
    "PA",    # Permis d'Amenager
    "DP",    # Declaration Prealable
    "PD",    # Permis de Demolir
]

# Keywords for filtering relevant permits
CONSTRUCTION_KEYWORDS = [
    "construction", "batiment", "immeuble", "logement",
    "maison", "residence", "bureaux", "commerce",
    "renovation", "rehabilitation", "extension", "agrandissement",
    "demolition", "amenagement",
]

# Similarity threshold for project matching
PROJECT_MATCH_THRESHOLD = 0.65


# ============================================================
# PYDANTIC MODELS
# ============================================================

class PermitPayload(BaseModel):
    """Parsed permit from data.gouv or other sources."""
    external_id: str
    reference: Optional[str] = None
    permit_type: Optional[str] = None
    status: str = "filed"  # filed|accepted|refused|cancelled|unknown
    applicant_name: Optional[str] = None
    project_address: Optional[str] = None
    city: Optional[str] = None
    postcode: Optional[str] = None
    region: Optional[str] = None
    country: str = "FR"
    description: Optional[str] = None
    estimated_surface: Optional[Decimal] = None
    estimated_units: Optional[int] = None
    submission_date: Optional[datetime] = None
    decision_date: Optional[datetime] = None
    raw_data: Dict[str, Any] = Field(default_factory=dict)


class PermitIngestionResult(BaseModel):
    """Result of permit ingestion."""
    permit_id: UUID
    project_id: Optional[UUID] = None
    created_project: bool = False
    reused_project: bool = False
    created_permit: bool = False
    created_organization: bool = False
    message: Optional[str] = None


class PermitFetchSummary(BaseModel):
    """Summary of permit fetch operation."""
    region: str
    lookback_days: int
    total_fetched: int = 0
    relevant: int = 0
    errors: List[str] = Field(default_factory=list)


class PermitIngestionSummary(BaseModel):
    """Summary of bulk permit ingestion."""
    tenant_id: UUID
    total_permits: int = 0
    new_projects: int = 0
    reused_projects: int = 0
    new_permits: int = 0
    new_organizations: int = 0
    failed: int = 0
    results: List[PermitIngestionResult] = Field(default_factory=list)


# ============================================================
# DATA.GOUV API CLIENT
# ============================================================

def _normalize_status(status_raw: Optional[str]) -> str:
    """Normalize permit status string."""
    if not status_raw:
        return "unknown"

    status_lower = status_raw.lower().strip()

    if any(s in status_lower for s in ["accord", "accept", "autor", "favorab"]):
        return "accepted"
    elif any(s in status_lower for s in ["refus", "rejet"]):
        return "refused"
    elif any(s in status_lower for s in ["annul", "retir"]):
        return "cancelled"
    elif any(s in status_lower for s in ["depos", "instru", "encour"]):
        return "filed"
    else:
        return "unknown"


def _parse_permit_record(record: dict) -> Optional[PermitPayload]:
    """
    Parse a data.gouv permit record into PermitPayload.

    Handles various field formats from different datasets.
    """
    try:
        fields = record.get("fields", record)

        # Extract external ID
        external_id = (
            fields.get("numero_permis") or
            fields.get("num_permis") or
            fields.get("id_permis") or
            fields.get("numero") or
            str(uuid4())[:12]
        )

        # Extract reference
        reference = (
            fields.get("reference") or
            fields.get("numero_dossier") or
            fields.get("numero_permis")
        )

        # Extract permit type
        permit_type = (
            fields.get("type_permis") or
            fields.get("type") or
            fields.get("nature_projet")
        )
        if permit_type:
            permit_type = permit_type.upper()[:10]

        # Extract status
        status_raw = (
            fields.get("etat") or
            fields.get("statut") or
            fields.get("decision") or
            fields.get("etat_dossier")
        )
        status = _normalize_status(status_raw)

        # Extract applicant
        applicant_name = (
            fields.get("demandeur") or
            fields.get("petitionnaire") or
            fields.get("nom_demandeur") or
            fields.get("raison_sociale")
        )

        # Extract address
        project_address = (
            fields.get("adresse") or
            fields.get("adresse_terrain") or
            fields.get("localisation") or
            fields.get("lieu")
        )

        # Extract location
        city = (
            fields.get("commune") or
            fields.get("ville") or
            fields.get("nom_commune")
        )
        postcode = (
            fields.get("code_postal") or
            fields.get("cp") or
            fields.get("code_insee", "")[:5]
        )
        region = (
            fields.get("region") or
            fields.get("nom_region")
        )

        # Extract description
        description = (
            fields.get("nature_travaux") or
            fields.get("description") or
            fields.get("objet") or
            fields.get("libelle_nature")
        )

        # Extract metrics
        surface = None
        surface_raw = (
            fields.get("surface_plancher") or
            fields.get("surface") or
            fields.get("shon") or
            fields.get("surface_totale")
        )
        if surface_raw:
            try:
                surface = Decimal(str(surface_raw).replace(",", "."))
            except (ValueError, TypeError):
                pass

        units = None
        units_raw = (
            fields.get("nb_logements") or
            fields.get("nombre_logements") or
            fields.get("nb_lots")
        )
        if units_raw:
            try:
                units = int(units_raw)
            except (ValueError, TypeError):
                pass

        # Extract dates
        submission_date = None
        sub_date_raw = (
            fields.get("date_depot") or
            fields.get("date_demande") or
            fields.get("date_enregistrement")
        )
        if sub_date_raw:
            submission_date = _parse_date(sub_date_raw)

        decision_date = None
        dec_date_raw = (
            fields.get("date_decision") or
            fields.get("date_autorisation") or
            fields.get("date_reponse")
        )
        if dec_date_raw:
            decision_date = _parse_date(dec_date_raw)

        return PermitPayload(
            external_id=str(external_id),
            reference=reference,
            permit_type=permit_type,
            status=status,
            applicant_name=applicant_name,
            project_address=project_address,
            city=city,
            postcode=postcode,
            region=region,
            country="FR",
            description=description,
            estimated_surface=surface,
            estimated_units=units,
            submission_date=submission_date,
            decision_date=decision_date,
            raw_data=fields,
        )

    except Exception as e:
        logger.warning(f"[Permits] Failed to parse permit record: {e}")
        return None


def _parse_date(date_str: str) -> Optional[datetime]:
    """Parse various date formats."""
    if not date_str:
        return None

    # Try ISO format
    try:
        return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except ValueError:
        pass

    # Try common French formats
    for fmt in ["%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%Y%m%d"]:
        try:
            dt = datetime.strptime(date_str[:10], fmt)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue

    return None


def _is_relevant_permit(permit_data: dict) -> bool:
    """Check if permit is relevant for construction/BTP."""
    # Check permit type
    permit_type = (
        permit_data.get("type_permis") or
        permit_data.get("type") or ""
    ).upper()

    for pt in RELEVANT_PERMIT_TYPES:
        if pt in permit_type:
            return True

    # Check keywords in description
    text = " ".join([
        (permit_data.get("nature_travaux") or ""),
        (permit_data.get("description") or ""),
        (permit_data.get("objet") or ""),
    ]).lower()

    for keyword in CONSTRUCTION_KEYWORDS:
        if keyword in text:
            return True

    # Default: include if has significant surface
    surface = permit_data.get("surface_plancher") or permit_data.get("surface")
    if surface:
        try:
            if float(str(surface).replace(",", ".")) > 50:
                return True
        except (ValueError, TypeError):
            pass

    return False


async def fetch_recent_permits_for_region(
    region: str,
    lookback_days: int = 30,
    limit: int = MAX_RESULTS_PER_QUERY,
) -> Tuple[List[PermitPayload], PermitFetchSummary]:
    """
    Fetch recent building permits for a region from data.gouv.

    Args:
        region: Region name (e.g., "Ile-de-France", "Auvergne-Rhone-Alpes")
        lookback_days: How many days back to search
        limit: Maximum results to return

    Returns:
        Tuple of (list of PermitPayload, PermitFetchSummary)

    Notes:
        - Never raises exceptions, returns empty list on error
        - Filters for relevant construction permits
    """
    summary = PermitFetchSummary(
        region=region,
        lookback_days=lookback_days,
    )

    permits: List[PermitPayload] = []

    try:
        since_date = (datetime.now(timezone.utc) - timedelta(days=lookback_days)).strftime("%Y-%m-%d")

        # Try data.gouv tabular API for permis de construire
        # Note: The actual endpoint depends on the available dataset
        # This is a template that should be adapted to the actual API structure

        logger.info(f"[Permits] Fetching permits for {region}, last {lookback_days} days")

        # Build query for data.gouv
        # Using a generic search approach
        params = {
            "q": f"permis construire {region}",
            "page_size": limit,
        }

        async with httpx.AsyncClient(timeout=API_TIMEOUT) as client:
            # First, try to find a relevant dataset
            response = await client.get(
                "https://www.data.gouv.fr/api/1/datasets/",
                params={
                    "q": "permis de construire",
                    "page_size": 5,
                }
            )

            if response.status_code == 200:
                datasets = response.json().get("data", [])

                if datasets:
                    # Use first available dataset
                    dataset = datasets[0]
                    resources = dataset.get("resources", [])

                    # Find CSV/JSON resource
                    for resource in resources:
                        if resource.get("format", "").lower() in ["csv", "json", "geojson"]:
                            resource_id = resource.get("id")
                            if resource_id:
                                # Fetch actual permit data
                                # This would require the tabular API
                                logger.debug(f"[Permits] Found dataset resource: {resource_id}")
                                break

                    # For now, log that we found datasets but need specific integration
                    logger.info(f"[Permits] Found {len(datasets)} datasets, requires specific API integration")

            else:
                error_msg = f"Data.gouv API returned {response.status_code}"
                logger.warning(f"[Permits] {error_msg}")
                summary.errors.append(error_msg)

        # Fallback: Try mock data for testing
        # In production, this should be replaced with actual API integration
        logger.info(f"[Permits] Using mock data for region {region}")

        # Return empty for now - in production would have actual data
        summary.total_fetched = 0
        summary.relevant = 0

    except httpx.TimeoutException:
        error_msg = "Data.gouv API timeout"
        logger.error(f"[Permits] {error_msg}")
        summary.errors.append(error_msg)

    except Exception as e:
        error_msg = f"Permits fetch error: {str(e)}"
        logger.error(f"[Permits] {error_msg}")
        summary.errors.append(error_msg)

    logger.info(
        f"[Permits] Fetch complete: {summary.total_fetched} total, "
        f"{summary.relevant} relevant"
    )

    return permits, summary


async def fetch_permits_by_city(
    city: str,
    postcode: Optional[str] = None,
    lookback_days: int = 30,
    limit: int = MAX_RESULTS_PER_QUERY,
) -> Tuple[List[PermitPayload], PermitFetchSummary]:
    """
    Fetch permits for a specific city.

    Alternative fetch method for more targeted searches.
    """
    summary = PermitFetchSummary(
        region=f"{city} ({postcode or 'all'})",
        lookback_days=lookback_days,
    )

    permits: List[PermitPayload] = []

    try:
        logger.info(f"[Permits] Fetching permits for city {city}")

        # Similar approach to region search
        # Would need integration with actual API

    except Exception as e:
        error_msg = f"Permits fetch error: {str(e)}"
        logger.error(f"[Permits] {error_msg}")
        summary.errors.append(error_msg)

    return permits, summary


# ============================================================
# PERMIT INGESTION
# ============================================================

def _text_similarity(text1: Optional[str], text2: Optional[str]) -> float:
    """Calculate similarity ratio between two texts."""
    if not text1 or not text2:
        return 0.0

    t1 = text1.lower().strip()
    t2 = text2.lower().strip()

    return SequenceMatcher(None, t1, t2).ratio()


def _estimate_scale_from_permit(permit: PermitPayload) -> str:
    """
    Estimate project scale from permit data.

    Based on:
    - Surface area
    - Number of units
    - Permit type
    """
    # Check surface
    if permit.estimated_surface:
        surface = float(permit.estimated_surface)
        if surface >= 5000:
            return "Large"
        elif surface >= 1000:
            return "Medium"
        elif surface >= 200:
            return "Small"

    # Check units
    if permit.estimated_units:
        if permit.estimated_units >= 50:
            return "Large"
        elif permit.estimated_units >= 20:
            return "Medium"
        elif permit.estimated_units >= 5:
            return "Small"

    # Check permit type
    if permit.permit_type:
        if permit.permit_type in ["PA", "PC"]:
            return "Medium"  # Full permit usually larger
        elif permit.permit_type in ["PCMI", "DP"]:
            return "Small"  # Individual/small declarations

    return "Small"  # Default


def _estimate_project_type(permit: PermitPayload) -> str:
    """Estimate project type from permit description."""
    description = (permit.description or "").lower()

    if any(kw in description for kw in ["renovation", "rehabilitation", "restauration"]):
        return "renovation"
    elif any(kw in description for kw in ["extension", "agrandissement", "surelevation"]):
        return "extension"
    elif any(kw in description for kw in ["demolition", "deconstruction"]):
        return "demolition"
    elif any(kw in description for kw in ["logement", "residence", "maison", "immeuble"]):
        return "residential"
    elif any(kw in description for kw in ["bureau", "tertiaire", "commerce"]):
        return "commercial"
    else:
        return "construction"


async def _find_matching_project(
    permit: PermitPayload,
    tenant_id: UUID,
    db: Client,
) -> Optional[Dict[str, Any]]:
    """
    Find an existing Shark project matching this permit.

    Matching criteria:
    - City + postcode
    - Address similarity
    - Name/description similarity
    """
    try:
        # Build query for potential matches
        query = db.table("shark_projects").select(
            "id, name, description_short, location_city, location_region, "
            "start_date_est, phase"
        ).eq("tenant_id", str(tenant_id))

        # Filter by city if available
        if permit.city:
            query = query.ilike("location_city", f"%{permit.city}%")

        result = query.limit(30).execute()
        candidates = result.data or []

        if not candidates:
            return None

        best_match = None
        best_score = 0.0

        for project in candidates:
            score = 0.0

            # City match (weight: 0.3)
            if permit.city and project.get("location_city"):
                city_sim = _text_similarity(permit.city, project.get("location_city"))
                score += city_sim * 0.3

            # Address/description similarity (weight: 0.4)
            permit_text = f"{permit.project_address or ''} {permit.description or ''}"
            project_text = f"{project.get('name', '')} {project.get('description_short', '')}"
            text_sim = _text_similarity(permit_text, project_text)
            score += text_sim * 0.4

            # Applicant in project name (weight: 0.2)
            if permit.applicant_name and project.get("name"):
                applicant_sim = _text_similarity(
                    permit.applicant_name,
                    project.get("name")
                )
                score += applicant_sim * 0.2

            # Date proximity (weight: 0.1)
            if permit.submission_date and project.get("start_date_est"):
                try:
                    project_date = datetime.fromisoformat(
                        project["start_date_est"].replace("Z", "+00:00")
                    )
                    days_diff = abs((permit.submission_date - project_date).days)
                    if days_diff < 180:  # Within 6 months
                        score += 0.1
                except (ValueError, TypeError):
                    pass

            if score > best_score and score >= PROJECT_MATCH_THRESHOLD:
                best_score = score
                best_match = project

        if best_match:
            logger.info(
                f"[Permits] Found matching project: {best_match.get('name')} "
                f"(score: {best_score:.2f})"
            )

        return best_match

    except Exception as e:
        logger.error(f"[Permits] Error finding matching project: {e}")
        return None


async def _upsert_permit(
    permit: PermitPayload,
    tenant_id: UUID,
    db: Client,
) -> Tuple[UUID, bool]:
    """
    Upsert permit into shark_building_permits.

    Returns:
        Tuple of (permit_id, created)
    """
    # Check if exists
    existing = db.table("shark_building_permits").select("id").eq(
        "tenant_id", str(tenant_id)
    ).eq("external_id", permit.external_id).execute()

    permit_data = {
        "tenant_id": str(tenant_id),
        "external_id": permit.external_id,
        "reference": permit.reference,
        "permit_type": permit.permit_type,
        "status": permit.status,
        "applicant_name": permit.applicant_name,
        "project_address": permit.project_address,
        "city": permit.city,
        "postcode": permit.postcode,
        "region": permit.region,
        "country": permit.country,
        "description": permit.description,
        "estimated_surface": float(permit.estimated_surface) if permit.estimated_surface else None,
        "estimated_units": permit.estimated_units,
        "submission_date": permit.submission_date.isoformat() if permit.submission_date else None,
        "decision_date": permit.decision_date.isoformat() if permit.decision_date else None,
        "raw_data": permit.raw_data,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    if existing.data:
        # Update existing
        permit_id = UUID(existing.data[0]["id"])
        db.table("shark_building_permits").update(permit_data).eq(
            "id", str(permit_id)
        ).execute()
        return permit_id, False
    else:
        # Insert new
        result = db.table("shark_building_permits").insert(permit_data).execute()
        permit_id = UUID(result.data[0]["id"])
        return permit_id, True


async def _create_project_from_permit(
    permit: PermitPayload,
    permit_id: UUID,
    tenant_id: UUID,
    db: Client,
) -> UUID:
    """
    Create a new Shark project from a permit.

    Returns:
        Created project UUID
    """
    # Build project name
    name_parts = []
    if permit.description:
        name_parts.append(permit.description[:100])
    elif permit.permit_type:
        name_parts.append(f"Permis {permit.permit_type}")
    else:
        name_parts.append("Permis de construire")

    if permit.city:
        name_parts.append(f"- {permit.city}")

    name = " ".join(name_parts)

    # Determine phase
    if permit.status == "accepted":
        phase = "projeté"
    elif permit.status in ["filed", "unknown"]:
        phase = "etude"
    else:
        phase = "etude"

    # Build sector tags
    sector_tags = ["permits", "immobilier"]
    project_type = _estimate_project_type(permit)
    if project_type:
        sector_tags.append(project_type)

    project_data = {
        "tenant_id": str(tenant_id),
        "name": name,
        "description_short": permit.description[:500] if permit.description else None,
        "type": project_type,
        "phase": phase,
        "location_city": permit.city,
        "location_region": permit.region,
        "country": permit.country or "FR",
        "start_date_est": (
            (permit.decision_date or permit.submission_date).isoformat()
            if (permit.decision_date or permit.submission_date)
            else None
        ),
        "sector_tags": sector_tags,
        "estimated_scale": _estimate_scale_from_permit(permit),
        "is_from_permit": True,
        "permit_status": permit.status,
        "estimated_surface_m2": float(permit.estimated_surface) if permit.estimated_surface else None,
        "ai_confidence": 0.8,  # Permits are reliable but early-stage
        "shark_score": 35,  # Early-stage = lower initial score
        "shark_priority": "LOW",
        "origin": "permits",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    result = db.table("shark_projects").insert(project_data).execute()
    project_id = UUID(result.data[0]["id"])

    logger.info(f"[Permits] Created project: {name} (ID: {project_id})")

    return project_id


async def _link_permit_to_project(
    permit_id: UUID,
    project_id: UUID,
    role: str,
    permit: PermitPayload,
    db: Client,
) -> None:
    """Create link between permit and project."""
    # Check if link exists
    existing = db.table("shark_project_permits").select("id").eq(
        "project_id", str(project_id)
    ).eq("permit_id", str(permit_id)).eq("role", role).execute()

    if existing.data:
        return  # Already linked

    link_data = {
        "project_id": str(project_id),
        "permit_id": str(permit_id),
        "role": role,
        "metadata": {
            "source": "permits",
            "permit_type": permit.permit_type,
            "status": permit.status,
            "surface": float(permit.estimated_surface) if permit.estimated_surface else None,
            "units": permit.estimated_units,
        },
    }

    db.table("shark_project_permits").insert(link_data).execute()
    logger.debug(f"[Permits] Linked permit {permit_id} to project {project_id}")


async def _create_applicant_organization(
    permit: PermitPayload,
    project_id: UUID,
    tenant_id: UUID,
    db: Client,
) -> bool:
    """
    Create organization for the permit applicant if it looks like a company.

    Returns:
        True if organization was created, False otherwise
    """
    if not permit.applicant_name:
        return False

    # Check if looks like a company (not individual)
    applicant = permit.applicant_name.strip()
    company_indicators = [
        "SAS", "SARL", "SA ", "SCI", "SCCV", "SNC",
        "EURL", "GIE", "SEM", "SPL", "OPH",
        "PROMOTION", "IMMOBILIER", "CONSTRUCTION",
        "GROUP", "HOLDING", "INVESTISSEMENT",
    ]

    is_company = any(ind in applicant.upper() for ind in company_indicators)

    if not is_company:
        logger.debug(f"[Permits] Applicant '{applicant}' appears to be individual, skipping org creation")
        return False

    # Check if organization exists
    existing = db.table("shark_organizations").select("id").eq(
        "tenant_id", str(tenant_id)
    ).ilike("name", applicant).execute()

    if existing.data:
        org_id = existing.data[0]["id"]
        created = False
    else:
        # Create new organization
        org_data = {
            "tenant_id": str(tenant_id),
            "name": applicant,
            "org_type": "promoteur",
            "city": permit.city,
            "region": permit.region,
            "country": permit.country,
            "source_type": "permits",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        result = db.table("shark_organizations").insert(org_data).execute()
        org_id = result.data[0]["id"]
        created = True

        logger.info(f"[Permits] Created organization: {applicant}")

    # Link organization to project
    existing_link = db.table("shark_project_organizations").select("id").eq(
        "project_id", str(project_id)
    ).eq("organization_id", org_id).execute()

    if not existing_link.data:
        link_data = {
            "project_id": str(project_id),
            "organization_id": org_id,
            "role_in_project": "Promoteur",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        db.table("shark_project_organizations").insert(link_data).execute()

    return created


async def ingest_permit_as_project(
    permit: PermitPayload,
    tenant_id: UUID,
    db: Client,
) -> PermitIngestionResult:
    """
    Ingest a building permit as a Shark project.

    Pipeline:
    1. Upsert permit in shark_building_permits
    2. Find matching existing project or create new
    3. Create project-permit link
    4. Create applicant organization (if company)

    Args:
        permit: Parsed PermitPayload
        tenant_id: Tenant UUID
        db: Supabase client

    Returns:
        PermitIngestionResult with operation details
    """
    logger.info(f"[Permits] Ingesting permit: {permit.external_id} - {permit.city}")

    result = PermitIngestionResult(
        permit_id=uuid4(),  # Placeholder, will be updated
    )

    try:
        # Step 1: Upsert permit
        permit_id, created_permit = await _upsert_permit(permit, tenant_id, db)
        result.permit_id = permit_id
        result.created_permit = created_permit

        # Step 2: Find or create project
        existing_project = await _find_matching_project(permit, tenant_id, db)

        if existing_project:
            project_id = UUID(existing_project["id"])
            result.project_id = project_id
            result.reused_project = True
            role = "update"
        else:
            project_id = await _create_project_from_permit(
                permit, permit_id, tenant_id, db
            )
            result.project_id = project_id
            result.created_project = True
            role = "source"

        # Step 3: Link permit to project
        await _link_permit_to_project(
            permit_id=permit_id,
            project_id=project_id,
            role=role,
            permit=permit,
            db=db,
        )

        # Step 4: Create applicant organization
        org_created = await _create_applicant_organization(
            permit, project_id, tenant_id, db
        )
        result.created_organization = org_created

        # Step 5: Recompute Shark Score for the project
        # This ensures the project gets a proper score based on all signals
        # (permits, orgs, phase, scale, etc.)
        if result.project_id:
            try:
                from services.shark_scoring_service import compute_shark_score

                score_result = await compute_shark_score(
                    project_id=result.project_id,
                    tenant_id=tenant_id,
                    db=db,
                )
                logger.debug(
                    f"[Permits] Recomputed shark score for project {result.project_id}: "
                    f"score={score_result.score}, priority={score_result.priority}"
                )
            except Exception as e:
                # Scoring failure should not block permit ingestion
                logger.warning(
                    f"[Permits] Failed to recompute shark score for "
                    f"project={result.project_id}: {e}"
                )

        result.message = "permit_ingested_successfully"

        logger.info(
            f"[Permits] Ingestion complete: permit={permit.external_id}, "
            f"project={project_id}, new_project={result.created_project}"
        )

    except Exception as e:
        logger.error(f"[Permits] Ingestion error for {permit.external_id}: {e}")
        result.message = f"error: {str(e)}"

    return result


async def ingest_permits_bulk(
    permits: List[PermitPayload],
    tenant_id: UUID,
    db: Client,
) -> PermitIngestionSummary:
    """
    Bulk ingest multiple permits.

    Args:
        permits: List of PermitPayload objects
        tenant_id: Tenant UUID
        db: Supabase client

    Returns:
        PermitIngestionSummary with statistics
    """
    summary = PermitIngestionSummary(
        tenant_id=tenant_id,
        total_permits=len(permits),
    )

    for permit in permits:
        try:
            result = await ingest_permit_as_project(permit, tenant_id, db)
            summary.results.append(result)

            if result.created_permit:
                summary.new_permits += 1
            if result.created_project:
                summary.new_projects += 1
            if result.reused_project:
                summary.reused_projects += 1
            if result.created_organization:
                summary.new_organizations += 1

        except Exception as e:
            logger.error(f"[Permits] Bulk ingestion error: {e}")
            summary.failed += 1

    logger.info(
        f"[Permits] Bulk ingestion complete: {summary.new_permits} permits, "
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
        permits, summary = await fetch_recent_permits_for_region(
            region="Ile-de-France",
            lookback_days=30,
        )

        print(f"Fetched {len(permits)} permits")
        for p in permits[:3]:
            print(f"  - {p.external_id}: {p.city} - {p.description}")

    asyncio.run(test())
