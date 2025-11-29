"""
Shark Project Extractor - Phase 2.1

LLM-based agent that extracts structured BTP project data from news articles.
This module does NOT write to the database - it only returns structured JSON.

Features:
- Date Anchor: Converts relative dates to absolute dates using published_at_input
- BTP Taxonomy: MOA, MOE, General_Contractor, Subcontractor, Operator, Other
- Estimated Scale: Small, Medium, Large, Mega
- BTP-only filter: Returns empty project if article is not about construction

Usage:
    from services.shark_project_extractor import extract_project_from_article

    result = await extract_project_from_article(
        article_text="La mairie de Toulouse lance un projet...",
        source_name="Le Moniteur",
        source_url="https://lemoniteur.fr/article/123",
        published_at_input=datetime(2024, 11, 29)
    )

    if result.project.name:  # Non-empty = valid BTP project
        print(f"Project: {result.project.name}")
        print(f"Scale: {result.project.estimated_scale}")
"""

import os
import json
import logging
from datetime import datetime, date
from typing import Optional, List, Literal
from pydantic import BaseModel, Field, field_validator
from openai import AsyncOpenAI

# Configure logging
logger = logging.getLogger(__name__)

# Initialize OpenAI client
openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))


# ============================================================
# ENUMS & TYPE DEFINITIONS
# ============================================================

OrgTypeEnum = Literal["MOA", "MOE", "General_Contractor", "Subcontractor", "Operator", "Other"]
RoleInProjectEnum = Literal["MOA", "MOE", "General_Contractor", "Subcontractor", "Operator", "Other"]
EstimatedScaleEnum = Literal["Small", "Medium", "Large", "Mega"]
ProjectPhaseEnum = Literal["detection", "etude", "appel_offres", "attribution", "travaux", "livraison", "abandonne", ""]
NewsRoleEnum = Literal["annonce_projet", "appel_offres", "mise_a_jour_budget", "retard", "livraison", "autre"]


# ============================================================
# PYDANTIC MODELS - Exact schema as specified
# ============================================================

class ProjectPayload(BaseModel):
    """Extracted project data from article."""
    name: str = ""
    type: Optional[str] = None
    description_short: Optional[str] = None
    location_city: Optional[str] = None
    location_region: Optional[str] = None
    country: str = "France"
    budget_amount: Optional[float] = None
    budget_currency: str = "EUR"
    start_date_est: Optional[str] = None  # ISO 8601 date (YYYY-MM-DD)
    end_date_est: Optional[str] = None    # ISO 8601 date (YYYY-MM-DD)
    phase: str = ""
    sector_tags: List[str] = Field(default_factory=list)
    estimated_scale: Optional[str] = None  # Small, Medium, Large, Mega

    @field_validator('estimated_scale')
    @classmethod
    def validate_scale(cls, v):
        if v is not None and v not in ["Small", "Medium", "Large", "Mega"]:
            return None
        return v


class OrganizationPayload(BaseModel):
    """Extracted organization data with BTP taxonomy."""
    name: str
    org_type: str = "Other"  # MOA, MOE, General_Contractor, Subcontractor, Operator, Other
    city: Optional[str] = None
    region: Optional[str] = None
    country: str = "France"
    role_in_project: str = "Other"  # Same enum as org_type
    raw_role_label: Optional[str] = None  # Original text from article

    @field_validator('org_type', 'role_in_project')
    @classmethod
    def validate_org_type(cls, v):
        valid = {"MOA", "MOE", "General_Contractor", "Subcontractor", "Operator", "Other"}
        if v not in valid:
            return "Other"
        return v


class NewsPayload(BaseModel):
    """Extracted news metadata."""
    title: Optional[str] = None
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    published_at: Optional[str] = None  # ISO 8601 datetime
    role_of_news: str = "annonce_projet"

    @field_validator('role_of_news')
    @classmethod
    def validate_news_role(cls, v):
        valid = {"annonce_projet", "appel_offres", "mise_a_jour_budget", "retard", "livraison", "autre"}
        if v not in valid:
            return "autre"
        return v


class ProjectExtractionResult(BaseModel):
    """Complete extraction result."""
    project: ProjectPayload
    organizations: List[OrganizationPayload] = Field(default_factory=list)
    news: NewsPayload


# ============================================================
# CUSTOM EXCEPTION
# ============================================================

class ProjectExtractionError(Exception):
    """Raised when project extraction fails."""
    def __init__(self, message: str, raw_response: Optional[str] = None):
        super().__init__(message)
        self.raw_response = raw_response


# ============================================================
# SYSTEM PROMPT - Encodes all business rules
# ============================================================

SYSTEM_PROMPT = """Tu es un expert en extraction de données structurées pour le secteur du BTP (Bâtiment et Travaux Publics) en France.

Ta mission : Analyser un article de presse et extraire les informations sur le PROJET de construction/rénovation/infrastructure mentionné.

## RÈGLE CRITIQUE 1 : DATE ANCHOR

La date de publication de l'article t'est fournie. Tu DOIS l'utiliser comme référence pour convertir les durées relatives en dates ABSOLUES au format YYYY-MM-DD.

Exemples de conversion (si l'article est publié le 2024-10-15) :
- "au printemps prochain" → "2025-03-01"
- "fin 2026" → "2026-12-31"
- "dans 18 mois" → "2026-04-15"
- "l'an prochain" → "2025-01-01"
- "livraison prévue pour 2027" → "2027-12-31"
- "travaux débutant en septembre" → si on est avant septembre, c'est l'année en cours, sinon l'année prochaine

Si aucune indication temporelle fiable → mettre null.

## RÈGLE CRITIQUE 2 : TAXONOMIE BTP STRICTE

Tu DOIS mapper les rôles sur ces ENUM strictes :

org_type et role_in_project :
- "MOA" : Maître d'Ouvrage (bailleur, métropole, région, ville, conseil départemental, État, promoteur qui commande)
- "MOE" : Maître d'Œuvre (architecte, cabinet d'architecture, bureau d'études, ingénierie)
- "General_Contractor" : Entreprise Générale (mandataire, groupement d'entreprises, constructeur principal)
- "Subcontractor" : Sous-traitant (entreprise d'un lot spécifique : électricité, plomberie, etc.)
- "Operator" : Exploitant (Tisséo, SNCF, gestionnaire d'infrastructure, concessionnaire)
- "Other" : Si vraiment impossible à classifier

raw_role_label : Stocke AUSSI le texte brut vu dans l'article (ex: "maître d'ouvrage", "exploitant")

## RÈGLE CRITIQUE 3 : ESTIMATED SCALE

Tu DOIS toujours renseigner estimated_scale selon ces heuristiques :

- "Small" : Petits travaux, rénovation légère, peinture, quelques logements, local commercial, petit équipement sportif.
- "Medium" : Collège, groupe scolaire, petit immeuble (< 50 logements), voirie locale, gymnase, crèche, médiathèque.
- "Large" : Hôpital, ZAC, gros ensemble de logements (> 100), grande infrastructure locale, centre commercial, stade.
- "Mega" : Métro, tramway, ligne TGV/LGV, aéroport, grand équipement régional/national, budget > 100M€.

Indicateur budget :
- < 5M€ → Small
- 5M€ - 30M€ → Medium
- 30M€ - 100M€ → Large
- > 100M€ → Mega

## RÈGLE CRITIQUE 4 : FILTRE BTP-ONLY

Si l'article NE PARLE PAS d'un projet BTP/travaux/construction/infrastructure identifiable :
- Renvoie project.name = "" (chaîne vide)
- Renvoie project.phase = ""
- organizations = []

Exemples NON-BTP : article politique pure, sport, gastronomie, économie générale sans projet concret.

## TYPE DE PROJET

- "construction_neuve"
- "renovation"
- "extension"
- "demolition"
- "infrastructure"
- "amenagement"
- "maintenance"
- "autre"

## PHASE DU PROJET

- "detection" : annonce ou rumeur d'un projet
- "etude" : phase de conception/études
- "appel_offres" : consultation en cours
- "attribution" : marché attribué
- "travaux" : chantier en cours
- "livraison" : projet terminé/inauguré
- "abandonne" : projet annulé

## ROLE DE LA NEWS

- "annonce_projet" : première annonce du projet
- "appel_offres" : annonce d'un appel d'offres
- "mise_a_jour_budget" : information sur le budget
- "retard" : annonce de retard
- "livraison" : annonce de livraison/inauguration
- "autre" : autre type d'information

## FORMAT DE SORTIE JSON STRICT

Tu dois UNIQUEMENT retourner un JSON valide, sans commentaire ni texte autour :

{
  "project": {
    "name": "string (nom du projet, VIDE si pas BTP)",
    "type": "string ou null",
    "description_short": "string ou null (1-2 phrases)",
    "location_city": "string ou null",
    "location_region": "string ou null",
    "country": "France",
    "budget_amount": number ou null,
    "budget_currency": "EUR",
    "start_date_est": "YYYY-MM-DD ou null",
    "end_date_est": "YYYY-MM-DD ou null",
    "phase": "string (VIDE si pas BTP)",
    "sector_tags": ["string"],
    "estimated_scale": "Small|Medium|Large|Mega ou null"
  },
  "organizations": [
    {
      "name": "string",
      "org_type": "MOA|MOE|General_Contractor|Subcontractor|Operator|Other",
      "city": "string ou null",
      "region": "string ou null",
      "country": "France",
      "role_in_project": "MOA|MOE|General_Contractor|Subcontractor|Operator|Other",
      "raw_role_label": "string (texte brut de l'article)"
    }
  ],
  "news": {
    "title": "string (titre de l'article)",
    "source_name": "string",
    "source_url": "string",
    "published_at": "ISO 8601 datetime",
    "role_of_news": "annonce_projet|appel_offres|mise_a_jour_budget|retard|livraison|autre"
  }
}
"""


# ============================================================
# USER PROMPT TEMPLATE
# ============================================================

USER_PROMPT_TEMPLATE = """## Article à analyser

**Source** : {source_name}
**URL** : {source_url}
**Date de publication (DATE ANCHOR)** : {published_at}

---

{article_text}

---

RAPPELS IMPORTANTS :
1. Utilise la date de publication ({published_at}) comme référence pour convertir les durées relatives en dates ABSOLUES.
2. Utilise la taxonomie stricte pour org_type et role_in_project (MOA, MOE, General_Contractor, Subcontractor, Operator, Other).
3. Renseigne TOUJOURS estimated_scale (Small, Medium, Large, Mega).
4. Si l'article n'est PAS sur un projet BTP → project.name = "" et phase = "".

Retourne UNIQUEMENT le JSON, sans aucun texte autour."""


# ============================================================
# MAIN EXTRACTION FUNCTION
# ============================================================

async def extract_project_from_article(
    article_text: str,
    source_name: str,
    source_url: str,
    published_at_input: datetime
) -> ProjectExtractionResult:
    """
    Extract structured BTP project data from a news article.

    This function:
    1. Builds the prompt for the LLM with Date Anchor context
    2. Calls OpenAI API with JSON mode
    3. Parses and validates the response via Pydantic
    4. Returns a ProjectExtractionResult

    Args:
        article_text: Full text of the article
        source_name: Name of the news source (e.g., "Le Moniteur")
        source_url: URL of the article
        published_at_input: Publication date (used as DATE ANCHOR)

    Returns:
        ProjectExtractionResult with project, organizations, and news

    Raises:
        ProjectExtractionError: If extraction or parsing fails
    """
    # Validate inputs
    if not article_text or not article_text.strip():
        raise ProjectExtractionError("Article text is empty")

    # Format published_at for the prompt
    published_at_str = published_at_input.strftime("%Y-%m-%d")

    # Build user prompt
    user_prompt = USER_PROMPT_TEMPLATE.format(
        source_name=source_name or "Source inconnue",
        source_url=source_url,
        published_at=published_at_str,
        article_text=article_text[:15000]  # Limit text length
    )

    try:
        # Call OpenAI with JSON mode
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.1,
            max_tokens=2000,
            response_format={"type": "json_object"}
        )

        raw_response = response.choices[0].message.content
        logger.debug(f"Raw LLM response: {raw_response}")

        # Parse JSON response
        return _parse_llm_response(
            raw_response=raw_response,
            source_name=source_name,
            source_url=source_url,
            published_at_str=published_at_str
        )

    except json.JSONDecodeError as e:
        logger.error(f"JSON parsing failed: {e}")
        raise ProjectExtractionError(
            f"Failed to parse LLM response as JSON: {e}",
            raw_response=raw_response if 'raw_response' in locals() else None
        )
    except Exception as e:
        logger.error(f"Extraction failed: {e}")
        raise ProjectExtractionError(f"Extraction failed: {e}")


def _parse_llm_response(
    raw_response: str,
    source_name: str,
    source_url: str,
    published_at_str: str
) -> ProjectExtractionResult:
    """Parse and validate the LLM JSON response."""
    try:
        data = json.loads(raw_response)
    except json.JSONDecodeError as e:
        # Try to clean up the response
        cleaned = raw_response.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError:
            raise ProjectExtractionError(
                f"Invalid JSON response: {e}",
                raw_response=raw_response
            )

    # Extract project
    project_data = data.get("project", {})
    project = ProjectPayload(
        name=project_data.get("name", ""),
        type=project_data.get("type"),
        description_short=project_data.get("description_short"),
        location_city=project_data.get("location_city"),
        location_region=project_data.get("location_region"),
        country=project_data.get("country", "France"),
        budget_amount=project_data.get("budget_amount"),
        budget_currency=project_data.get("budget_currency", "EUR"),
        start_date_est=project_data.get("start_date_est"),
        end_date_est=project_data.get("end_date_est"),
        phase=project_data.get("phase", ""),
        sector_tags=project_data.get("sector_tags", []),
        estimated_scale=project_data.get("estimated_scale")
    )

    # Extract organizations
    organizations = []
    for org_data in data.get("organizations", []):
        if org_data.get("name"):
            org = OrganizationPayload(
                name=org_data.get("name"),
                org_type=org_data.get("org_type", "Other"),
                city=org_data.get("city"),
                region=org_data.get("region"),
                country=org_data.get("country", "France"),
                role_in_project=org_data.get("role_in_project", "Other"),
                raw_role_label=org_data.get("raw_role_label")
            )
            organizations.append(org)

    # Extract news
    news_data = data.get("news", {})
    news = NewsPayload(
        title=news_data.get("title") or project.name,
        source_name=news_data.get("source_name") or source_name,
        source_url=news_data.get("source_url") or source_url,
        published_at=news_data.get("published_at") or published_at_str,
        role_of_news=news_data.get("role_of_news", "annonce_projet")
    )

    return ProjectExtractionResult(
        project=project,
        organizations=organizations,
        news=news
    )


# ============================================================
# HELPER FUNCTION - Check if extraction found a valid BTP project
# ============================================================

def is_valid_btp_project(result: ProjectExtractionResult) -> bool:
    """
    Check if the extraction result contains a valid BTP project.

    Returns False if:
    - project.name is empty
    - project.phase is empty

    This is used to filter out non-BTP articles.
    """
    return bool(result.project.name and result.project.name.strip())
