"""
Sherlock Agent - OSINT Lead Enrichment for B2B Prospecting

This module implements intelligent lead enrichment from news articles and web pages.
It extracts entities, infers target roles, searches LinkedIn profiles via Exa,
and scores results to avoid homonymy issues.

Use Cases:
- BTP/Construction project hunting
- Real estate development leads
- Public infrastructure projects (metro, tramway, bridges)
- Industrial projects

Pipeline:
1. Extract entities from article (company, project, location, budget, phase)
2. Infer target roles based on project type and user's offer
3. Build Exa queries for LinkedIn profiles
4. Search and filter profiles
5. Score profiles against company/role/location
6. Return structured JSON for CRM integration
"""

import os
import json
import re
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, asdict, field
from pydantic import BaseModel, Field
from openai import AsyncOpenAI
from exa_py import Exa
from dotenv import load_dotenv

load_dotenv()

# Initialize clients
openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
exa_client = Exa(api_key=os.getenv("EXA_API_KEY")) if os.getenv("EXA_API_KEY") else None


# ============================================================
# PYDANTIC MODELS
# ============================================================

class ProjectEntities(BaseModel):
    """Entities extracted from an article about a project"""
    company: str = Field(..., description="Main entity (maître d'ouvrage, owner)")
    project_type: Optional[str] = Field(None, description="Type of project")
    location: Optional[str] = Field(None, description="City or region")
    region: Optional[str] = Field(None, description="Broader region")
    budget: Optional[float] = Field(None, description="Budget in euros")
    phase: Optional[str] = Field(None, description="Project phase")
    raw_title: Optional[str] = Field(None, description="Article title if available")


class ProfileMatch(BaseModel):
    """A matched profile from Exa search"""
    name: str
    role: str
    score: float = Field(..., ge=0, le=1)
    score_label: str = Field(..., description="A/B/C grade")
    linkedin_url: str
    location: Optional[str] = None
    source: str = "exa"
    why_relevant: str = ""

    # Score breakdown for transparency
    score_company: float = 0
    score_role: float = 0
    score_location: float = 0


class SherlockResult(BaseModel):
    """Complete enrichment result from Sherlock"""
    success: bool
    company: Dict[str, Any]
    contacts: List[ProfileMatch] = Field(default_factory=list)
    target_roles: List[str] = Field(default_factory=list)
    queries_used: List[str] = Field(default_factory=list)
    article_source: Optional[str] = None
    error: Optional[str] = None


# ============================================================
# ROLE MAPPINGS BY PROJECT TYPE
# ============================================================

# Roles for building/rehabilitation projects
ROLES_BUILDING = [
    "Directeur du patrimoine",
    "Responsable du patrimoine",
    "Chargé d'opérations",
    "Chef de projet travaux",
    "Responsable maintenance",
    "Conducteur de travaux",
    "Directeur technique",
    "Responsable travaux",
]

# Roles for infrastructure projects (metro, tram, bridges)
ROLES_INFRASTRUCTURE = [
    "Directeur grands projets",
    "Chef de projet infrastructure",
    "Responsable travaux",
    "Acheteur travaux",
    "Responsable génie civil",
    "Directeur des infrastructures",
    "Chef de projet MOA",
    "Directeur de programme",
]

# Roles for real estate/property projects
ROLES_REAL_ESTATE = [
    "Directeur de programme immobilier",
    "Responsable développement",
    "Chef de projet immobilier",
    "Directeur technique",
    "Chargé d'opérations immobilières",
    "Responsable programmes",
]

# Roles for industrial projects
ROLES_INDUSTRIAL = [
    "Directeur industriel",
    "Responsable site",
    "Directeur des opérations",
    "Chef de projet industriel",
    "Directeur technique",
    "Responsable maintenance industrielle",
]

# Additional roles by offer type
ROLES_BY_OFFER = {
    "beton": ["Conducteur de travaux", "Chef de chantier", "Responsable gros oeuvre"],
    "logiciel_btp": ["DSI", "Directeur des systèmes d'information", "Directeur des études", "Directeur méthodes", "BIM Manager"],
    "equipement_chantier": ["Responsable matériel", "Chef de chantier", "Conducteur de travaux", "Responsable achats"],
    "renovation": ["Directeur du patrimoine", "Chargé d'opérations", "Architecte"],
    "securite": ["Responsable QSE", "Coordinateur SPS", "Directeur QHSE"],
    "energie": ["Responsable énergie", "Directeur développement durable", "Chef de projet EnR"],
}

# Keywords to detect project types
PROJECT_TYPE_KEYWORDS = {
    "building": ["réhabilitation", "rénovation", "bâtiment", "logement", "immeuble", "résidence", "hlm", "habitat"],
    "infrastructure": ["métro", "metro", "tramway", "tram", "pont", "viaduc", "tunnel", "ligne", "gare", "station"],
    "real_estate": ["immobilier", "promotion", "programme", "lotissement", "quartier", "zac"],
    "industrial": ["usine", "entrepôt", "plateforme logistique", "site industriel", "manufacture"],
}


# ============================================================
# ROLE SYNONYMS FOR MATCHING
# ============================================================

ROLE_SYNONYMS = {
    "directeur du patrimoine": ["dir patrimoine", "responsable patrimoine", "head of property"],
    "chargé d'opérations": ["charge operations", "project manager", "chef de projet"],
    "directeur technique": ["dir technique", "technical director", "dt", "cto"],
    "conducteur de travaux": ["conducteur travaux", "site manager", "works manager"],
    "directeur grands projets": ["dir grands projets", "major projects director"],
    "dsi": ["directeur si", "it director", "cio", "directeur informatique"],
}


# ============================================================
# 1. ENTITY EXTRACTION
# ============================================================

async def extract_entities_from_article(article_text: str) -> Dict[str, Any]:
    """
    Extract project entities from an article using LLM.

    Returns:
        Dict with: company, project_type, location, budget, phase
    """
    system_prompt = """Tu es un expert en analyse d'articles de presse sur les projets BTP/immobilier.
Ton rôle est d'extraire les informations clés sur le projet mentionné.

RÈGLES D'EXTRACTION:
- company: L'entité qui LANCE/FINANCE le projet (maître d'ouvrage), pas l'entreprise de travaux
- project_type: Type de projet (réhabilitation, construction, infrastructure...)
- location: Ville principale du projet
- region: Région (Occitanie, Île-de-France, etc.)
- budget: Montant en euros (null si non mentionné)
- phase: "appel_offres", "travaux_en_cours", "projet", "livraison_proche", "etude"

IMPORTANT:
- Le maître d'ouvrage est souvent une collectivité, un bailleur social, une métropole, pas l'entreprise BTP
- Si "Bouygues construit pour Toulouse Métropole" → company = "Toulouse Métropole"

Retourne UNIQUEMENT du JSON valide."""

    user_prompt = f"""Analyse cet article et extrait les entités du projet:

{article_text[:6000]}

Retourne:
{{
    "company": "Nom du maître d'ouvrage (celui qui finance/lance)",
    "project_type": "type de projet",
    "location": "ville",
    "region": "région",
    "budget": montant_en_euros_ou_null,
    "phase": "phase_du_projet"
}}"""

    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.2,
            max_tokens=500
        )

        content = response.choices[0].message.content.strip()
        content = content.replace("```json", "").replace("```", "").strip()
        data = json.loads(content)

        return {
            "company": data.get("company"),
            "project_type": data.get("project_type"),
            "location": data.get("location"),
            "region": data.get("region"),
            "budget": data.get("budget"),
            "phase": data.get("phase"),
            "raw_spans": {}
        }

    except Exception as e:
        print(f"[Sherlock] Entity extraction error: {e}")
        return {
            "company": None,
            "project_type": None,
            "location": None,
            "region": None,
            "budget": None,
            "phase": None,
            "error": str(e)
        }


# ============================================================
# 2. TARGET ROLE INFERENCE
# ============================================================

def _detect_project_category(project_type: Optional[str]) -> str:
    """Detect project category from project_type string."""
    if not project_type:
        return "building"  # default

    project_lower = project_type.lower()

    for category, keywords in PROJECT_TYPE_KEYWORDS.items():
        for keyword in keywords:
            if keyword in project_lower:
                return category

    return "building"  # default


def infer_target_roles(entities: Dict[str, Any], offer_type: str) -> List[str]:
    """
    Infer target decision-maker roles based on project type and user's offer.

    Args:
        entities: Extracted entities from article
        offer_type: What the user sells (beton, logiciel_btp, equipement_chantier...)

    Returns:
        List of target role titles
    """
    project_type = entities.get("project_type", "")
    category = _detect_project_category(project_type)

    # Base roles by project category
    if category == "infrastructure":
        base_roles = ROLES_INFRASTRUCTURE.copy()
    elif category == "real_estate":
        base_roles = ROLES_REAL_ESTATE.copy()
    elif category == "industrial":
        base_roles = ROLES_INDUSTRIAL.copy()
    else:
        base_roles = ROLES_BUILDING.copy()

    # Add offer-specific roles
    offer_roles = ROLES_BY_OFFER.get(offer_type.lower(), [])

    # Merge and deduplicate, keeping order
    all_roles = []
    seen = set()
    for role in base_roles + offer_roles:
        role_lower = role.lower()
        if role_lower not in seen:
            all_roles.append(role)
            seen.add(role_lower)

    # Limit to top 6 most relevant
    return all_roles[:6]


# ============================================================
# 3. EXA QUERY BUILDING
# ============================================================

def build_exa_queries(
    company: str,
    location: Optional[str],
    target_roles: List[str],
    region: Optional[str] = None
) -> List[str]:
    """
    Build Exa search queries for LinkedIn profiles.

    Returns:
        List of query strings (primary + fallback)
    """
    queries = []

    if not company:
        return []

    # Build role OR clause
    role_clause = " OR ".join([f'"{role}"' for role in target_roles[:4]])

    # Primary query (strict)
    primary_parts = [
        'site:linkedin.com/in',
        f'"{company}"',
        f'({role_clause})'
    ]

    # Add location filter
    location_parts = []
    if location:
        location_parts.append(f'"{location}"')
    if region:
        location_parts.append(f'"{region}"')
    if location_parts:
        primary_parts.append(f'({" OR ".join(location_parts)})')

    queries.append(" ".join(primary_parts))

    # Fallback query (relaxed location)
    if location:
        fallback_parts = [
            'site:linkedin.com/in',
            f'"{company}"',
            f'({role_clause})'
        ]
        if region:
            fallback_parts.append(f'"{region}"')
        else:
            fallback_parts.append('"France"')

        queries.append(" ".join(fallback_parts))

    # Super fallback (company only with broader roles)
    broader_roles = ["Directeur", "Director", "Responsable", "Manager", "Chef de projet"]
    broader_clause = " OR ".join([f'"{r}"' for r in broader_roles])
    queries.append(f'site:linkedin.com/in "{company}" ({broader_clause})')

    return queries


# ============================================================
# 4. EXA SEARCH
# ============================================================

def search_profiles_with_exa(queries: List[str]) -> List[Dict[str, Any]]:
    """
    Search LinkedIn profiles via Exa API.

    Returns:
        List of raw profile dicts with url, title, snippet
    """
    if not exa_client:
        print("[Sherlock] Exa client not configured")
        return []

    profiles = []
    seen_urls = set()

    for query in queries:
        try:
            print(f"[Sherlock] Exa query: {query[:100]}...")

            results = exa_client.search_and_contents(
                query,
                num_results=10,
                text=True
            )

            for result in results.results:
                url = result.url

                # Only keep LinkedIn profile URLs
                if "linkedin.com/in/" not in url.lower():
                    continue

                # Skip duplicates
                if url in seen_urls:
                    continue
                seen_urls.add(url)

                profiles.append({
                    "url": url,
                    "title": result.title or "",
                    "snippet": (result.text or "")[:500],
                    "source": "exa"
                })

            # If we have enough profiles, stop
            if len(profiles) >= 15:
                break

        except Exception as e:
            print(f"[Sherlock] Exa search error: {e}")
            continue

    print(f"[Sherlock] Found {len(profiles)} LinkedIn profiles")
    return profiles


# ============================================================
# 5. PROFILE SCORING (Anti-Homonymy)
# ============================================================

def _normalize_text(text: str) -> str:
    """Normalize text for comparison."""
    return re.sub(r'[^\w\s]', '', text.lower())


def _company_in_text(company: str, text: str) -> float:
    """Check if company name appears in text. Returns score 0-1."""
    text_norm = _normalize_text(text)
    company_norm = _normalize_text(company)

    # Exact match
    if company_norm in text_norm:
        return 1.0

    # Partial match (company words)
    company_words = company_norm.split()
    if len(company_words) > 1:
        # Check if main words appear
        matches = sum(1 for w in company_words if len(w) > 3 and w in text_norm)
        if matches >= len(company_words) - 1:
            return 0.7
        if matches >= len(company_words) // 2:
            return 0.4

    return 0.0


def _role_in_text(target_roles: List[str], text: str) -> float:
    """Check if any target role appears in text. Returns score 0-1."""
    text_norm = _normalize_text(text)

    for role in target_roles:
        role_norm = _normalize_text(role)

        # Exact match
        if role_norm in text_norm:
            return 1.0

        # Check synonyms
        for base_role, synonyms in ROLE_SYNONYMS.items():
            if role_norm == _normalize_text(base_role):
                for syn in synonyms:
                    if _normalize_text(syn) in text_norm:
                        return 0.8

    # Generic role keywords
    generic_keywords = ["directeur", "director", "responsable", "manager", "chef"]
    for kw in generic_keywords:
        if kw in text_norm:
            return 0.4

    return 0.0


def _location_in_text(location: Optional[str], region: Optional[str], text: str) -> float:
    """Check if location appears in text. Returns score 0-1."""
    text_norm = _normalize_text(text)

    # City match
    if location:
        if _normalize_text(location) in text_norm:
            return 1.0

    # Region match
    if region:
        if _normalize_text(region) in text_norm:
            return 0.7

    # France fallback
    if "france" in text_norm:
        return 0.3

    return 0.0


def score_profile(
    profile: Dict[str, Any],
    company: str,
    location: Optional[str],
    target_roles: List[str],
    region: Optional[str] = None
) -> Dict[str, float]:
    """
    Score a profile for relevance. Returns dict with total score and breakdown.

    Scoring formula:
    - 35% company match
    - 25% role match
    - 20% location match
    - 10% seniority (default 0.5)
    - 10% recency (default 0.5)
    """
    text = f"{profile.get('title', '')} {profile.get('snippet', '')}"

    score_company = _company_in_text(company, text)
    score_role = _role_in_text(target_roles, text)
    score_location = _location_in_text(location, region, text)
    score_seniority = 0.5  # Default, can be enhanced later
    score_recency = 0.5  # Default, can be enhanced later

    total = (
        0.35 * score_company +
        0.25 * score_role +
        0.20 * score_location +
        0.10 * score_seniority +
        0.10 * score_recency
    )

    return {
        "total": round(total, 3),
        "company": round(score_company, 2),
        "role": round(score_role, 2),
        "location": round(score_location, 2),
        "seniority": round(score_seniority, 2),
        "recency": round(score_recency, 2)
    }


def _score_to_label(score: float) -> str:
    """Convert score to A/B/C label."""
    if score >= 0.85:
        return "A"
    elif score >= 0.70:
        return "B"
    elif score >= 0.50:
        return "C"
    else:
        return "D"


# ============================================================
# 6. PROFILE PARSING
# ============================================================

def _extract_name_from_title(title: str) -> str:
    """Extract person name from LinkedIn title."""
    # Format: "Name - Role at Company | LinkedIn"
    if " - " in title:
        return title.split(" - ")[0].strip()
    if " | " in title:
        return title.split(" | ")[0].strip()
    # Fallback: take first part
    return title.split(",")[0].strip()[:50]


def _extract_role_from_title(title: str) -> str:
    """Extract role from LinkedIn title."""
    # Format: "Name - Role at Company | LinkedIn"
    if " - " in title:
        parts = title.split(" - ", 1)
        if len(parts) > 1:
            role_part = parts[1]
            # Remove "at Company" and "| LinkedIn"
            role_part = role_part.split(" at ")[0]
            role_part = role_part.split(" chez ")[0]
            role_part = role_part.split(" | ")[0]
            return role_part.strip()[:100]
    return "Non spécifié"


async def _generate_why_relevant(
    profile: Dict[str, Any],
    entities: Dict[str, Any],
    target_roles: List[str]
) -> str:
    """Generate a short explanation of why this profile is relevant."""
    name = _extract_name_from_title(profile.get("title", ""))
    role = _extract_role_from_title(profile.get("title", ""))
    company = entities.get("company", "l'entreprise")
    project = entities.get("project_type", "le projet")

    # Simple template-based generation (can be LLM-enhanced)
    return (
        f"{name} occupe le poste de {role}, potentiellement impliqué "
        f"dans {project} chez {company}."
    )


# ============================================================
# 7. MAIN ENRICHMENT FUNCTION
# ============================================================

async def enrich_lead_from_article(
    article_text: str,
    offer_type: str,
    article_url: Optional[str] = None,
    threshold_min: float = 0.45
) -> SherlockResult:
    """
    Main Sherlock pipeline: Extract entities, infer roles, search profiles, score.

    Args:
        article_text: Full text of the article
        offer_type: What the user sells (beton, logiciel_btp, equipement_chantier...)
        article_url: Optional URL of the source article
        threshold_min: Minimum score to include a profile (default 0.45)

    Returns:
        SherlockResult with company info and ranked contacts
    """
    print(f"[Sherlock] Starting enrichment pipeline...")
    print(f"[Sherlock] Offer type: {offer_type}")

    # Step 1: Extract entities
    print("[Sherlock] Step 1: Extracting entities...")
    entities = await extract_entities_from_article(article_text)

    if not entities.get("company"):
        return SherlockResult(
            success=False,
            company={},
            error="Could not extract company from article",
            article_source=article_url
        )

    print(f"[Sherlock] Found company: {entities['company']}")
    print(f"[Sherlock] Location: {entities.get('location')}, Region: {entities.get('region')}")
    print(f"[Sherlock] Project type: {entities.get('project_type')}")

    # Step 2: Infer target roles
    print("[Sherlock] Step 2: Inferring target roles...")
    target_roles = infer_target_roles(entities, offer_type)
    print(f"[Sherlock] Target roles: {target_roles}")

    # Step 3: Build Exa queries
    print("[Sherlock] Step 3: Building Exa queries...")
    queries = build_exa_queries(
        entities["company"],
        entities.get("location"),
        target_roles,
        entities.get("region")
    )
    print(f"[Sherlock] Generated {len(queries)} queries")

    # Step 4: Search profiles
    print("[Sherlock] Step 4: Searching LinkedIn profiles...")
    raw_profiles = search_profiles_with_exa(queries)

    if not raw_profiles:
        return SherlockResult(
            success=True,
            company={
                "name": entities["company"],
                "location": entities.get("location"),
                "region": entities.get("region"),
                "project_type": entities.get("project_type"),
                "phase": entities.get("phase"),
                "budget": entities.get("budget"),
            },
            contacts=[],
            target_roles=target_roles,
            queries_used=queries,
            article_source=article_url,
            error="No LinkedIn profiles found"
        )

    # Step 5: Score and filter profiles
    print("[Sherlock] Step 5: Scoring profiles...")
    scored_profiles = []

    for profile in raw_profiles:
        scores = score_profile(
            profile,
            entities["company"],
            entities.get("location"),
            target_roles,
            entities.get("region")
        )

        if scores["total"] >= threshold_min:
            why_relevant = await _generate_why_relevant(profile, entities, target_roles)

            scored_profiles.append(ProfileMatch(
                name=_extract_name_from_title(profile.get("title", "")),
                role=_extract_role_from_title(profile.get("title", "")),
                score=scores["total"],
                score_label=_score_to_label(scores["total"]),
                linkedin_url=profile["url"],
                location=entities.get("location"),
                source="exa",
                why_relevant=why_relevant,
                score_company=scores["company"],
                score_role=scores["role"],
                score_location=scores["location"]
            ))

    # Sort by score descending
    scored_profiles.sort(key=lambda x: x.score, reverse=True)

    # Limit to top 10
    scored_profiles = scored_profiles[:10]

    print(f"[Sherlock] Found {len(scored_profiles)} qualified contacts")

    return SherlockResult(
        success=True,
        company={
            "name": entities["company"],
            "location": entities.get("location"),
            "region": entities.get("region"),
            "project_type": entities.get("project_type"),
            "phase": entities.get("phase"),
            "budget": entities.get("budget"),
        },
        contacts=scored_profiles,
        target_roles=target_roles,
        queries_used=queries,
        article_source=article_url
    )


# ============================================================
# API ENTRY POINT
# ============================================================

async def sherlock_enrich(
    article_text: str,
    offer_type: str = "renovation",
    article_url: Optional[str] = None
) -> Dict[str, Any]:
    """
    API entry point for Sherlock enrichment.

    Args:
        article_text: Article content (text/HTML/markdown)
        offer_type: User's business type
        article_url: Source URL

    Returns:
        Dict ready for CRM integration
    """
    result = await enrich_lead_from_article(
        article_text,
        offer_type,
        article_url
    )

    # Convert to dict for JSON serialization
    return {
        "success": result.success,
        "company": result.company,
        "contacts": [c.model_dump() for c in result.contacts],
        "target_roles": result.target_roles,
        "queries_used": result.queries_used,
        "article_source": result.article_source,
        "error": result.error
    }


# ============================================================
# TESTS
# ============================================================

def test_infer_target_roles():
    """Test role inference."""
    # Building project
    entities = {"project_type": "réhabilitation de logements sociaux"}
    roles = infer_target_roles(entities, "beton")
    assert "Directeur du patrimoine" in roles or "Chargé d'opérations" in roles
    print(f"✓ Building roles: {roles}")

    # Infrastructure project
    entities = {"project_type": "construction ligne métro B"}
    roles = infer_target_roles(entities, "equipement_chantier")
    assert "Directeur grands projets" in roles or "Chef de projet infrastructure" in roles
    print(f"✓ Infrastructure roles: {roles}")

    # Software offer
    entities = {"project_type": "rénovation bâtiment"}
    roles = infer_target_roles(entities, "logiciel_btp")
    assert "DSI" in roles or "Directeur des systèmes d'information" in roles
    print(f"✓ Software roles: {roles}")

    print("✅ test_infer_target_roles passed")


def test_build_exa_queries():
    """Test query building."""
    queries = build_exa_queries(
        company="Toulouse Métropole Habitat",
        location="Toulouse",
        target_roles=["Directeur du patrimoine", "Chargé d'opérations"],
        region="Occitanie"
    )

    assert len(queries) >= 2
    assert "linkedin.com/in" in queries[0]
    assert "Toulouse Métropole Habitat" in queries[0]
    print(f"✓ Generated {len(queries)} queries")
    print(f"  Primary: {queries[0][:80]}...")

    print("✅ test_build_exa_queries passed")


def test_score_profile():
    """Test profile scoring."""
    profile = {
        "url": "https://linkedin.com/in/test",
        "title": "Michel Martin - Directeur du Patrimoine chez Toulouse Métropole Habitat",
        "snippet": "Directeur du Patrimoine à Toulouse, Occitanie, France. Expert en gestion immobilière."
    }

    scores = score_profile(
        profile,
        company="Toulouse Métropole Habitat",
        location="Toulouse",
        target_roles=["Directeur du patrimoine", "Chargé d'opérations"],
        region="Occitanie"
    )

    assert scores["total"] >= 0.7, f"Score too low: {scores['total']}"
    assert scores["company"] >= 0.7, f"Company score too low: {scores['company']}"
    assert scores["role"] >= 0.7, f"Role score too low: {scores['role']}"

    print(f"✓ Score: {scores['total']:.2f}")
    print(f"  Company: {scores['company']}, Role: {scores['role']}, Location: {scores['location']}")

    # Test low-match profile
    bad_profile = {
        "url": "https://linkedin.com/in/test2",
        "title": "Jean Dupont - Marketing Manager at Random Corp",
        "snippet": "Marketing expert in Paris"
    }

    bad_scores = score_profile(
        bad_profile,
        company="Toulouse Métropole Habitat",
        location="Toulouse",
        target_roles=["Directeur du patrimoine"],
        region="Occitanie"
    )

    assert bad_scores["total"] < 0.5, f"Bad profile score too high: {bad_scores['total']}"
    print(f"✓ Bad profile score: {bad_scores['total']:.2f} (correctly low)")

    print("✅ test_score_profile passed")


async def test_enrichment_pipeline():
    """Integration test with sample article."""
    sample_article = """
    Toulouse : Toulouse Métropole Habitat lance un vaste programme de réhabilitation

    Le bailleur social Toulouse Métropole Habitat vient d'annoncer un programme de
    réhabilitation thermique de 500 logements dans le quartier des Izards à Toulouse.

    Le budget total du projet s'élève à 12 millions d'euros, financé en partie par
    l'ANRU et la Région Occitanie. Les travaux devraient débuter au premier trimestre 2025.

    "Ce projet s'inscrit dans notre stratégie de décarbonation du parc immobilier",
    a déclaré le directeur général de TMH.

    Les entreprises locales seront sollicitées pour les lots gros œuvre, façades et
    menuiseries. Un appel d'offres sera lancé en décembre.
    """

    print("\n" + "="*60)
    print("INTEGRATION TEST: Sherlock Pipeline")
    print("="*60)

    result = await enrich_lead_from_article(
        sample_article,
        offer_type="renovation",
        article_url="https://example.com/article"
    )

    print(f"\nSuccess: {result.success}")
    print(f"Company: {result.company}")
    print(f"Target roles: {result.target_roles}")
    print(f"Contacts found: {len(result.contacts)}")

    for contact in result.contacts[:3]:
        print(f"\n  📧 {contact.name}")
        print(f"     Role: {contact.role}")
        print(f"     Score: {contact.score:.2f} ({contact.score_label})")
        print(f"     LinkedIn: {contact.linkedin_url}")

    print("\n✅ Integration test completed")
    return result


def run_tests():
    """Run all unit tests."""
    print("\n" + "="*60)
    print("SHERLOCK AGENT - UNIT TESTS")
    print("="*60 + "\n")

    test_infer_target_roles()
    print()
    test_build_exa_queries()
    print()
    test_score_profile()

    print("\n" + "="*60)
    print("ALL UNIT TESTS PASSED ✅")
    print("="*60)


if __name__ == "__main__":
    import asyncio

    # Run unit tests
    run_tests()

    # Run integration test
    asyncio.run(test_enrichment_pipeline())
