"""
Shark Sherlock OSINT Service - Phase 3

Agent "Sherlock OSINT" qui recherche des décideurs pertinents pour une organisation
via recherche web (Exa), et les insère dans shark_people + shark_organization_people.

Contraintes:
- Respect légal (recherche publique, pas de scraping massif)
- Rate limiting pour protéger les coûts Exa
- Filtrage des faux positifs (rôles obsolètes via is_current_role)
- Email guesser probabiliste

Usage:
    from services.shark_sherlock_service import enrich_organization_with_people, SherlockTarget

    person_ids = await enrich_organization_with_people(
        SherlockTarget(
            tenant_id=UUID("xxx"),
            organization_id=UUID("yyy"),
            desired_roles=["Directeur Travaux", "Responsable Projet"]
        )
    )
"""

import os
import re
import json
import asyncio
import logging
import unicodedata
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID

from pydantic import BaseModel, Field
from exa_py import Exa

from supabase import Client

# Configure logging
logger = logging.getLogger(__name__)

# Initialize Exa client
exa_api_key = os.getenv("EXA_API_KEY")
exa_client = Exa(api_key=exa_api_key) if exa_api_key else None


# ============================================================
# PYDANTIC MODELS
# ============================================================

class SherlockTarget(BaseModel):
    """Target for Sherlock OSINT enrichment."""
    tenant_id: UUID
    project_id: Optional[UUID] = None
    organization_id: UUID
    desired_roles: List[str] = Field(default_factory=list)
    max_results: int = 5


class SherlockPersonCandidate(BaseModel):
    """Candidate person found via OSINT."""
    full_name: str
    title: str
    organization_name: Optional[str] = None
    linkedin_url: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    country: str = "France"
    source_confidence: float  # 0.0 - 1.0
    source_type: str = "osint_linkedin_search"
    raw_snippet: Optional[str] = None
    is_current_role: bool = True
    email_guess: Optional[str] = None


class SherlockResult(BaseModel):
    """Result of Sherlock enrichment."""
    organization_id: UUID
    person_ids: List[UUID] = Field(default_factory=list)
    candidates_found: int = 0
    candidates_filtered: int = 0
    persons_created: int = 0
    persons_reused: int = 0
    message: Optional[str] = None


# ============================================================
# ROLE MAPPINGS BY ORG TYPE
# ============================================================

DEFAULT_ROLES_BY_ORG_TYPE: Dict[str, List[str]] = {
    "MOA": [
        "Directeur du Patrimoine",
        "Responsable Immobilier",
        "Directeur Travaux",
        "Responsable Grands Projets",
        "Directeur de l'Aménagement"
    ],
    "MOE": [
        "Associé",
        "Directeur d'agence",
        "Responsable Projet",
        "Chef de projet",
        "Architecte associé"
    ],
    "General_Contractor": [
        "Directeur Travaux",
        "Responsable d'exploitation",
        "Responsable de chantier",
        "Directeur de filiale",
        "Directeur Général"
    ],
    "Subcontractor": [
        "Directeur Technique",
        "Responsable d'activité",
        "Chargé d'affaires",
        "Directeur Commercial"
    ],
    "Operator": [
        "Responsable Patrimoine",
        "Directeur Infrastructure",
        "Directeur d'exploitation",
        "Responsable Technique"
    ],
    "Other": [
        "Directeur",
        "Responsable",
        "Chef de projet"
    ]
}


# ============================================================
# HELPER: Get Supabase client
# ============================================================

def get_supabase() -> Client:
    """Get Supabase client."""
    from services.shark_ingestion_service import get_supabase as _get_supabase
    return _get_supabase()


# ============================================================
# HELPER: Email Guesser
# ============================================================

def normalize_for_email(text: str) -> str:
    """Normalize text for email (lowercase, no accents, no spaces)."""
    if not text:
        return ""
    # Remove accents
    result = unicodedata.normalize('NFD', text)
    result = ''.join(c for c in result if unicodedata.category(c) != 'Mn')
    # Lowercase
    result = result.lower()
    # Remove special chars except dot and hyphen
    result = re.sub(r"[^a-z0-9.\-]", "", result)
    return result


def extract_domain_from_website(website: str) -> Optional[str]:
    """Extract domain from website URL."""
    if not website:
        return None

    # Remove protocol
    domain = website.lower()
    domain = re.sub(r'^https?://', '', domain)
    domain = re.sub(r'^www\.', '', domain)

    # Remove path
    domain = domain.split('/')[0]

    # Remove port
    domain = domain.split(':')[0]

    return domain if domain else None


def guess_email(full_name: str, org_website: Optional[str]) -> Optional[str]:
    """
    Generate probabilistic email guess from name and org website.

    Examples:
        "Jean Dupont" + "toulouse-metropole.fr" -> "jean.dupont@toulouse-metropole.fr"
        "Marie-Claire Lefèvre" + "eiffage.com" -> "marie-claire.lefevre@eiffage.com"

    Returns None if org_website is not available.
    """
    if not org_website or not full_name:
        return None

    domain = extract_domain_from_website(org_website)
    if not domain:
        return None

    # Split name into parts
    name_parts = full_name.strip().split()
    if len(name_parts) < 2:
        return None

    # First name and last name
    prenom = normalize_for_email(name_parts[0])
    nom = normalize_for_email(name_parts[-1])

    if not prenom or not nom:
        return None

    # Generate email: prenom.nom@domain
    email = f"{prenom}.{nom}@{domain}"

    return email


# ============================================================
# HELPER: Current Role Detection
# ============================================================

# Patterns indicating past/former roles
PAST_ROLE_PATTERNS = [
    r'\bex[\-\s]',
    r'\bancien(?:ne)?\b',
    r'\bformer\b',
    r'\bpast\b',
    r'\bpreviously\b',
    r'\b(?:19|20)\d{2}\s*[-\u2013]\s*(?:19|20)\d{2}\b',  # Date ranges like "2015-2020"
    r'\bjusqu[\'\u2019](?:en|a)\s*(?:19|20)\d{2}\b',
    r'\bquitt[e\u00e9]\b',
    r'\bleft\b',
]

# Patterns indicating current roles
CURRENT_ROLE_PATTERNS = [
    r'\bpresent\b',
    r'\bactuel(?:lement)?\b',
    r'\bcurrent(?:ly)?\b',
    r'\bdepuis\s+(?:19|20)\d{2}\b',
    r'\b(?:19|20)\d{2}\s*[-\u2013]\s*(?:present|aujourd|actuel)',
    r'\b(?:19|20)\d{2}\s*[-\u2013]\s*$',  # "2020 -" (open-ended)
]


def detect_is_current_role(snippet: str, title: str) -> bool:
    """
    Analyze snippet and title to determine if role is current.

    Returns True if likely current, False if likely past.
    """
    if not snippet and not title:
        return True  # Assume current if no info

    text = f"{snippet or ''} {title or ''}".lower()

    # Check for past role indicators
    for pattern in PAST_ROLE_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            # Double-check it's not followed by current indicator
            has_current = any(
                re.search(p, text, re.IGNORECASE)
                for p in CURRENT_ROLE_PATTERNS
            )
            if not has_current:
                return False

    # Check for explicit current indicators
    for pattern in CURRENT_ROLE_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return True

    # Default to True (assume current)
    return True


# ============================================================
# OSINT QUERY BUILDER
# ============================================================

def build_osint_queries(
    org_name: str,
    city: Optional[str],
    roles: List[str],
    max_queries: int = 5
) -> List[str]:
    """
    Build OSINT search queries for LinkedIn profiles.

    Args:
        org_name: Organization name
        city: City (optional)
        roles: List of desired role titles
        max_queries: Maximum number of queries to generate

    Returns:
        List of search query strings
    """
    queries = []

    # Clean org name
    org_clean = org_name.strip()

    # Build queries for each role
    for role in roles[:max_queries]:
        # Main query with city
        if city:
            query = f'site:linkedin.com/in "{org_clean}" "{role}" "{city}"'
            queries.append(query)

        # Query without city
        query_no_city = f'site:linkedin.com/in "{org_clean}" "{role}"'
        if query_no_city not in queries:
            queries.append(query_no_city)

        if len(queries) >= max_queries:
            break

    # Add a generic query if we have room
    if len(queries) < max_queries:
        generic = f'site:linkedin.com/in "{org_clean}" directeur responsable'
        if generic not in queries:
            queries.append(generic)

    return queries[:max_queries]


# ============================================================
# EXA SEARCH
# ============================================================

async def search_people_via_exa(
    query: str,
    num_results: int = 5
) -> List[SherlockPersonCandidate]:
    """
    Search for people via Exa API.

    Args:
        query: Search query string
        num_results: Number of results to request

    Returns:
        List of SherlockPersonCandidate
    """
    if not exa_client:
        logger.warning("Exa client not configured (EXA_API_KEY missing)")
        return []

    try:
        # Call Exa search
        response = exa_client.search(
            query,
            num_results=num_results,
            use_autoprompt=False,
            type="neural"
        )

        candidates = []

        for result in response.results:
            # Parse LinkedIn URL and extract info
            candidate = _parse_exa_result(result, query)
            if candidate:
                candidates.append(candidate)

        logger.debug(f"Exa search returned {len(candidates)} candidates for: {query[:50]}...")
        return candidates

    except Exception as e:
        logger.error(f"Exa search failed: {e}")
        return []


def _parse_exa_result(result: Any, query: str) -> Optional[SherlockPersonCandidate]:
    """Parse an Exa result into a SherlockPersonCandidate."""
    try:
        url = result.url if hasattr(result, 'url') else None
        title = result.title if hasattr(result, 'title') else ""
        snippet = result.text if hasattr(result, 'text') else ""

        # Skip if not LinkedIn
        if not url or "linkedin.com/in/" not in url.lower():
            return None

        # Extract name from title (LinkedIn titles are usually "Name - Title - Company")
        full_name = ""
        person_title = ""
        org_name = None

        if title:
            parts = title.split(" - ")
            if len(parts) >= 1:
                full_name = parts[0].strip()
            if len(parts) >= 2:
                person_title = parts[1].strip()
            if len(parts) >= 3:
                org_name = parts[2].strip()

        # Skip if no name extracted
        if not full_name or len(full_name) < 3:
            return None

        # Clean up name (remove "| LinkedIn" etc)
        full_name = re.sub(r'\s*\|.*$', '', full_name)
        full_name = re.sub(r'\s*LinkedIn.*$', '', full_name, flags=re.IGNORECASE)

        # Extract city from snippet or title
        city = _extract_city_from_text(f"{title} {snippet}")

        # Calculate confidence
        confidence = _calculate_confidence(
            full_name=full_name,
            title=person_title,
            org_name=org_name,
            snippet=snippet,
            query=query
        )

        # Detect if current role
        is_current = detect_is_current_role(snippet, person_title)

        return SherlockPersonCandidate(
            full_name=full_name,
            title=person_title or "Unknown",
            organization_name=org_name,
            linkedin_url=url,
            city=city,
            region=None,
            country="France",
            source_confidence=confidence,
            source_type="osint_linkedin_search",
            raw_snippet=snippet[:500] if snippet else None,
            is_current_role=is_current,
            email_guess=None  # Will be set later with org website
        )

    except Exception as e:
        logger.warning(f"Failed to parse Exa result: {e}")
        return None


def _extract_city_from_text(text: str) -> Optional[str]:
    """Extract city from text using common French city patterns."""
    if not text:
        return None

    # Common French cities
    cities = [
        "Paris", "Lyon", "Marseille", "Toulouse", "Nice", "Nantes",
        "Strasbourg", "Montpellier", "Bordeaux", "Lille", "Rennes",
        "Reims", "Saint-Étienne", "Le Havre", "Toulon", "Grenoble",
        "Dijon", "Angers", "Nîmes", "Villeurbanne", "Clermont-Ferrand"
    ]

    text_lower = text.lower()
    for city in cities:
        if city.lower() in text_lower:
            return city

    # Check for "Région" patterns
    region_match = re.search(r'(?:région|region)\s+([A-Za-zÀ-ÿ\-]+)', text, re.IGNORECASE)
    if region_match:
        return region_match.group(1)

    return None


def _calculate_confidence(
    full_name: str,
    title: str,
    org_name: Optional[str],
    snippet: str,
    query: str
) -> float:
    """Calculate confidence score for a candidate."""
    confidence = 0.5  # Base confidence

    # Name quality
    if full_name and len(full_name.split()) >= 2:
        confidence += 0.1

    # Title present
    if title and len(title) > 3:
        confidence += 0.1

    # Organization match
    if org_name:
        # Check if org name from query is in the result
        query_lower = query.lower()
        org_lower = org_name.lower()
        if org_lower in query_lower or any(
            word in query_lower for word in org_lower.split() if len(word) > 3
        ):
            confidence += 0.2

    # LinkedIn URL present (implicit since we filter for it)
    confidence += 0.1

    return min(confidence, 1.0)


# ============================================================
# PERSON UPSERT
# ============================================================

async def find_or_create_person_from_candidate(
    tenant_id: UUID,
    org_id: UUID,
    candidate: SherlockPersonCandidate,
    org_website: Optional[str],
    db: Client
) -> Tuple[UUID, bool]:
    """
    Find or create a person from a Sherlock candidate.

    Returns:
        Tuple of (person_id, was_created)
    """
    # Try to find by LinkedIn URL first
    if candidate.linkedin_url:
        existing = db.table("shark_people").select("id, source_confidence").eq(
            "tenant_id", str(tenant_id)
        ).eq("linkedin_url", candidate.linkedin_url).execute()

        if existing.data:
            person_id = UUID(existing.data[0]["id"])
            existing_confidence = existing.data[0].get("source_confidence") or 0

            # Update if new confidence is higher
            if candidate.source_confidence > existing_confidence:
                _update_person(person_id, candidate, org_website, db)

            # Ensure link exists
            await _ensure_organization_person_link(org_id, person_id, candidate, db)

            logger.debug(f"Reused person by LinkedIn: {person_id}")
            return person_id, False

    # Try to find by name + organization
    existing = db.table("shark_people").select("id").eq(
        "tenant_id", str(tenant_id)
    ).ilike("full_name", candidate.full_name).execute()

    if existing.data:
        person_id = UUID(existing.data[0]["id"])
        _update_person(person_id, candidate, org_website, db)
        await _ensure_organization_person_link(org_id, person_id, candidate, db)

        logger.debug(f"Reused person by name: {person_id}")
        return person_id, False

    # Create new person
    email = candidate.email_guess or guess_email(candidate.full_name, org_website)

    person_data = {
        "tenant_id": str(tenant_id),
        "full_name": candidate.full_name,
        "title": candidate.title,
        "linkedin_url": candidate.linkedin_url,
        "email_guess": email,
        "city": candidate.city,
        "region": candidate.region,
        "country": candidate.country or "France",
        "source_type": candidate.source_type,
        "source_confidence": candidate.source_confidence,
        "raw_extraction": candidate.model_dump()
    }

    result = db.table("shark_people").insert(person_data).execute()
    person_id = UUID(result.data[0]["id"])

    # Create link
    await _ensure_organization_person_link(org_id, person_id, candidate, db)

    logger.info(f"Created person: {person_id} - {candidate.full_name}")
    return person_id, True


def _update_person(
    person_id: UUID,
    candidate: SherlockPersonCandidate,
    org_website: Optional[str],
    db: Client
) -> None:
    """Update existing person with new data."""
    update_data = {
        "updated_at": datetime.utcnow().isoformat()
    }

    # Update fields if we have better data
    if candidate.title:
        update_data["title"] = candidate.title
    if candidate.city:
        update_data["city"] = candidate.city
    if candidate.linkedin_url:
        update_data["linkedin_url"] = candidate.linkedin_url

    # Update email_guess if not set
    current = db.table("shark_people").select("email_guess").eq(
        "id", str(person_id)
    ).execute()

    if current.data and not current.data[0].get("email_guess"):
        email = candidate.email_guess or guess_email(candidate.full_name, org_website)
        if email:
            update_data["email_guess"] = email

    # Update confidence if higher
    update_data["source_confidence"] = candidate.source_confidence

    db.table("shark_people").update(update_data).eq("id", str(person_id)).execute()


async def _ensure_organization_person_link(
    org_id: UUID,
    person_id: UUID,
    candidate: SherlockPersonCandidate,
    db: Client
) -> None:
    """Ensure link exists between organization and person."""
    # Check if link exists
    existing = db.table("shark_organization_people").select("id").eq(
        "organization_id", str(org_id)
    ).eq("person_id", str(person_id)).execute()

    if existing.data:
        # Update is_current if needed
        db.table("shark_organization_people").update({
            "is_current": candidate.is_current_role,
            "ai_confidence": candidate.source_confidence
        }).eq("id", existing.data[0]["id"]).execute()
        return

    # Map title to role_in_org
    role = _map_title_to_role(candidate.title)

    link_data = {
        "organization_id": str(org_id),
        "person_id": str(person_id),
        "role_in_org": role,
        "is_current": candidate.is_current_role,
        "ai_confidence": candidate.source_confidence
    }

    db.table("shark_organization_people").insert(link_data).execute()
    logger.debug(f"Linked person {person_id} to org {org_id} as {role}")


def _map_title_to_role(title: str) -> str:
    """Map a title to a role_in_org enum value."""
    if not title:
        return "autre"

    title_lower = title.lower()

    # Check DGA first (more specific)
    if "directeur general adjoint" in title_lower or "dga" in title_lower:
        return "dga"
    # Then check DG (more generic)
    if "directeur general" in title_lower or "dg" in title_lower:
        return "dg"
    if "directeur travaux" in title_lower:
        return "directeur_travaux"
    if "chef de projet" in title_lower or "responsable projet" in title_lower:
        return "chef_de_projet"
    if "conducteur travaux" in title_lower or "conducteur de travaux" in title_lower:
        return "conducteur_travaux"
    if "commercial" in title_lower:
        return "responsable_commercial"
    if "acheteur" in title_lower or "achats" in title_lower:
        return "acheteur"
    if "prescripteur" in title_lower:
        return "prescripteur"

    return "autre"


# ============================================================
# MAIN ENRICHMENT FUNCTION
# ============================================================

async def enrich_organization_with_people(
    target: SherlockTarget,
    min_confidence: float = 0.6
) -> List[UUID]:
    """
    Enrich an organization with people found via OSINT.

    Args:
        target: SherlockTarget with org info
        min_confidence: Minimum confidence threshold (0-1)

    Returns:
        List of person_ids created or reused
    """
    db = get_supabase()
    person_ids = []

    # Load organization
    org_result = db.table("shark_organizations").select("*").eq(
        "id", str(target.organization_id)
    ).eq("tenant_id", str(target.tenant_id)).execute()

    if not org_result.data:
        logger.warning(f"Organization not found: {target.organization_id}")
        return []

    org = org_result.data[0]
    org_name = org["name"]
    org_type = org.get("org_type", "Other")
    org_city = org.get("city")
    org_website = org.get("website")

    logger.info(f"Enriching org: {org_name} ({org_type})")

    # Determine roles to search
    roles = target.desired_roles
    if not roles:
        roles = DEFAULT_ROLES_BY_ORG_TYPE.get(org_type, DEFAULT_ROLES_BY_ORG_TYPE["Other"])

    # Build OSINT queries
    queries = build_osint_queries(
        org_name=org_name,
        city=org_city,
        roles=roles,
        max_queries=5
    )

    # Search and collect candidates
    all_candidates: List[SherlockPersonCandidate] = []
    seen_urls = set()

    for query in queries:
        candidates = await search_people_via_exa(query, num_results=target.max_results)

        for candidate in candidates:
            # Deduplicate by LinkedIn URL
            if candidate.linkedin_url and candidate.linkedin_url in seen_urls:
                continue
            if candidate.linkedin_url:
                seen_urls.add(candidate.linkedin_url)

            all_candidates.append(candidate)

        # Small delay between queries
        await asyncio.sleep(0.2)

    logger.info(f"Found {len(all_candidates)} candidates for {org_name}")

    # Filter candidates
    filtered_candidates = [
        c for c in all_candidates
        if c.source_confidence >= min_confidence and c.is_current_role
    ]

    logger.info(f"Filtered to {len(filtered_candidates)} candidates (confidence >= {min_confidence}, current role)")

    # Create/update persons
    for candidate in filtered_candidates[:target.max_results]:
        # Set email guess if possible
        if not candidate.email_guess and org_website:
            candidate.email_guess = guess_email(candidate.full_name, org_website)

        person_id, created = await find_or_create_person_from_candidate(
            tenant_id=target.tenant_id,
            org_id=target.organization_id,
            candidate=candidate,
            org_website=org_website,
            db=db
        )

        person_ids.append(person_id)

    logger.info(f"Enrichment complete for {org_name}: {len(person_ids)} persons")
    return person_ids


# ============================================================
# BATCH ENRICHMENT WITH RATE LIMITING
# ============================================================

async def enrich_projects_organizations_batch(
    tenant_id: UUID,
    project_ids: List[UUID],
    max_orgs_per_project: int = 3,
    max_concurrent_orgs: int = 3,
    delay_between_batches: float = 0.5,
    min_confidence: float = 0.6
) -> Dict[UUID, List[UUID]]:
    """
    Batch enrich organizations for multiple projects with rate limiting.

    Args:
        tenant_id: Tenant UUID
        project_ids: List of project UUIDs to enrich
        max_orgs_per_project: Max orgs to enrich per project
        max_concurrent_orgs: Max concurrent org enrichments (rate limiting)
        delay_between_batches: Delay in seconds between batches
        min_confidence: Minimum confidence for candidates

    Returns:
        Dict mapping organization_id -> list of person_ids
    """
    db = get_supabase()
    results: Dict[UUID, List[UUID]] = {}

    # Semaphore for rate limiting
    semaphore = asyncio.Semaphore(max_concurrent_orgs)

    async def enrich_org_with_semaphore(org_id: UUID) -> Tuple[UUID, List[UUID]]:
        async with semaphore:
            target = SherlockTarget(
                tenant_id=tenant_id,
                organization_id=org_id,
                max_results=5
            )
            person_ids = await enrich_organization_with_people(
                target=target,
                min_confidence=min_confidence
            )
            await asyncio.sleep(delay_between_batches)
            return org_id, person_ids

    # Collect all organizations to enrich
    orgs_to_enrich: List[UUID] = []

    for project_id in project_ids:
        # Get organizations linked to project (prioritize MOA, MOE, GC)
        links = db.table("shark_project_organizations").select(
            "organization_id, role_in_project"
        ).eq("project_id", str(project_id)).execute()

        if not links.data:
            continue

        # Sort by role priority
        role_priority = {"MOA": 0, "MOE": 1, "General_Contractor": 2, "Subcontractor": 3, "Operator": 4, "Other": 5}
        sorted_links = sorted(
            links.data,
            key=lambda x: role_priority.get(x.get("role_in_project", "Other"), 5)
        )

        # Take top N orgs
        for link in sorted_links[:max_orgs_per_project]:
            org_id = UUID(link["organization_id"])
            if org_id not in orgs_to_enrich:
                orgs_to_enrich.append(org_id)

    logger.info(f"Batch enrichment: {len(orgs_to_enrich)} organizations from {len(project_ids)} projects")

    # Run enrichments with rate limiting
    tasks = [enrich_org_with_semaphore(org_id) for org_id in orgs_to_enrich]
    completed = await asyncio.gather(*tasks, return_exceptions=True)

    # Collect results
    for result in completed:
        if isinstance(result, Exception):
            logger.error(f"Enrichment failed: {result}")
            continue
        org_id, person_ids = result
        results[org_id] = person_ids

    total_persons = sum(len(pids) for pids in results.values())
    logger.info(f"Batch complete: {len(results)} orgs enriched, {total_persons} persons found")

    return results


# ============================================================
# CONVENIENCE FUNCTION
# ============================================================

async def enrich_single_organization(
    tenant_id: UUID,
    organization_id: UUID,
    desired_roles: Optional[List[str]] = None,
    max_results: int = 5
) -> SherlockResult:
    """
    Convenience function to enrich a single organization.

    Returns:
        SherlockResult with statistics
    """
    target = SherlockTarget(
        tenant_id=tenant_id,
        organization_id=organization_id,
        desired_roles=desired_roles or [],
        max_results=max_results
    )

    try:
        person_ids = await enrich_organization_with_people(target)

        return SherlockResult(
            organization_id=organization_id,
            person_ids=person_ids,
            candidates_found=len(person_ids),
            persons_created=len(person_ids),  # Simplified - actual tracking would need more logic
            message="OK"
        )

    except Exception as e:
        logger.exception(f"Enrichment failed for org {organization_id}: {e}")
        return SherlockResult(
            organization_id=organization_id,
            message=f"Error: {str(e)}"
        )
