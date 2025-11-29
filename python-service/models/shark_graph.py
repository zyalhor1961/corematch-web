"""
Shark Hunter - Project Graph Models
====================================

Modèles Pydantic pour le graphe de projets BTP détectés par l'IA.

Architecture du graphe:
    NEWS → détecte → PROJET → implique → ORGANISATION → emploie → PERSONNE

Tables Supabase correspondantes:
    - shark_projects
    - shark_organizations
    - shark_people
    - shark_news_items
    - shark_project_organizations (liaison)
    - shark_organization_people (liaison)
    - shark_project_news (liaison)

Usage:
    from models.shark_graph import SharkProject, SharkOrganization, SharkPerson

    project = SharkProject(
        name="Rénovation Hôtel Martinez",
        type="renovation",
        location_city="Cannes",
        ...
    )
"""

from datetime import date, datetime
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field
from uuid import UUID


# ============================================================
# ENUMS / TYPES
# ============================================================

ProjectType = Literal[
    "construction_neuve",
    "renovation",
    "extension",
    "demolition",
    "infrastructure",
    "amenagement",
    "maintenance",
    "autre"
]

ProjectPhase = Literal[
    "detection",      # Vient d'être détecté
    "etude",          # En phase d'étude/conception
    "appel_offres",   # Appel d'offres en cours
    "attribution",    # Marché attribué
    "travaux",        # Travaux en cours
    "livraison",      # Projet livré
    "abandonne"       # Projet abandonné
]

SharkPriority = Literal["low", "medium", "high", "critical"]

OrgType = Literal[
    "moa",              # Maître d'Ouvrage
    "moe",              # Maître d'Oeuvre
    "entreprise_gros_oeuvre",
    "entreprise_second_oeuvre",
    "promoteur",
    "collectivite",
    "etablissement_public",
    "fonciere",
    "autre"
]

SizeBucket = Literal["tpe", "pme", "eti", "ge"]

PersonSource = Literal[
    "linkedin",
    "article_presse",
    "site_entreprise",
    "annuaire",
    "enrichissement_api",
    "manuel"
]

RoleInProject = Literal[
    "maitrise_ouvrage",
    "maitrise_oeuvre",
    "entreprise_generale",
    "sous_traitant",
    "fournisseur",
    "cotraitant",
    "autre"
]

RoleInOrg = Literal[
    "dg",
    "dga",
    "directeur_travaux",
    "chef_de_projet",
    "conducteur_travaux",
    "responsable_commercial",
    "acheteur",
    "prescripteur",
    "autre"
]

NewsRole = Literal[
    "source",       # News qui a révélé le projet
    "update",       # Mise à jour
    "attribution",  # Annonce d'attribution
    "livraison",    # Annonce de livraison
    "autre"
]


# ============================================================
# MAIN ENTITIES
# ============================================================

class SharkProjectBase(BaseModel):
    """
    Projet BTP détecté par l'IA Shark Hunter.

    Représente un chantier, une rénovation, une infrastructure, etc.
    détecté dans la presse ou les appels d'offres.
    """
    name: str = Field(..., description="Nom du projet")
    type: Optional[ProjectType] = Field(None, description="Type de projet")
    description_short: Optional[str] = Field(None, description="Description courte")

    # Localisation
    location_city: Optional[str] = Field(None, description="Ville")
    location_region: Optional[str] = Field(None, description="Région")
    country: str = Field("FR", description="Code pays ISO")

    # Budget et planning
    budget_amount: Optional[float] = Field(None, description="Montant du budget")
    budget_currency: str = Field("EUR", description="Devise")
    start_date_est: Optional[date] = Field(None, description="Date de début estimée")
    end_date_est: Optional[date] = Field(None, description="Date de fin estimée")

    # Phase et scoring
    phase: ProjectPhase = Field("detection", description="Phase du projet")
    sector_tags: List[str] = Field(default_factory=list, description="Tags sectoriels")
    shark_score: int = Field(0, ge=0, le=100, description="Score d'opportunité (0-100)")
    shark_priority: SharkPriority = Field("medium", description="Priorité")

    # Métadonnées IA
    ai_confidence: Optional[float] = Field(None, ge=0, le=1, description="Confiance IA")
    raw_extraction: Optional[Dict[str, Any]] = Field(None, description="Données brutes")


class SharkProject(SharkProjectBase):
    """Projet avec ID et timestamps (lecture depuis DB)."""
    id: UUID
    tenant_id: UUID  # ID du client SaaS CoreMatch (multi-tenancy)
    ai_extracted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class SharkProjectCreate(SharkProjectBase):
    """Données pour créer un nouveau projet."""
    tenant_id: UUID  # ID du client SaaS CoreMatch (multi-tenancy)


class SharkOrganizationBase(BaseModel):
    """
    Organisation impliquée dans les projets BTP.

    Peut être: MOA (client), MOE (architecte), entreprise de travaux,
    promoteur, collectivité, etc.
    """
    name: str = Field(..., description="Nom de l'organisation")
    org_type: Optional[OrgType] = Field(None, description="Type d'organisation")

    # Coordonnées
    website: Optional[str] = Field(None, description="Site web")
    city: Optional[str] = Field(None, description="Ville")
    region: Optional[str] = Field(None, description="Région")
    country: str = Field("FR", description="Code pays ISO")

    # Taille
    size_bucket: Optional[SizeBucket] = Field(None, description="Taille de l'entreprise")

    # Enrichissement
    linkedin_url: Optional[str] = Field(None, description="URL LinkedIn")
    siren: Optional[str] = Field(None, description="Numéro SIREN")
    siret: Optional[str] = Field(None, description="Numéro SIRET")

    # Métadonnées
    ai_confidence: Optional[float] = Field(None, ge=0, le=1)
    raw_extraction: Optional[Dict[str, Any]] = None


class SharkOrganization(SharkOrganizationBase):
    """Organisation avec ID et timestamps."""
    id: UUID
    tenant_id: UUID  # ID du client SaaS CoreMatch (multi-tenancy)
    created_at: datetime
    updated_at: datetime


class SharkOrganizationCreate(SharkOrganizationBase):
    """Données pour créer une organisation."""
    tenant_id: UUID  # ID du client SaaS CoreMatch (multi-tenancy)


class SharkPersonBase(BaseModel):
    """
    Décideur ou contact identifié dans une organisation.

    Peut être: DG, Directeur Travaux, Chef de Projet, Acheteur, etc.
    """
    full_name: str = Field(..., description="Nom complet")
    title: Optional[str] = Field(None, description="Titre/fonction")

    # Contact
    linkedin_url: Optional[str] = Field(None, description="URL LinkedIn")
    email_guess: Optional[str] = Field(None, description="Email deviné")
    phone: Optional[str] = Field(None, description="Téléphone")

    # Localisation
    city: Optional[str] = None
    region: Optional[str] = None
    country: str = Field("FR")

    # Qualité des données
    source_confidence: Optional[float] = Field(None, ge=0, le=1)
    source_type: Optional[PersonSource] = None

    # Métadonnées
    raw_extraction: Optional[Dict[str, Any]] = None


class SharkPerson(SharkPersonBase):
    """Personne avec ID et timestamps."""
    id: UUID
    tenant_id: UUID  # ID du client SaaS CoreMatch (multi-tenancy)
    created_at: datetime
    updated_at: datetime


class SharkPersonCreate(SharkPersonBase):
    """Données pour créer une personne."""
    tenant_id: UUID  # ID du client SaaS CoreMatch (multi-tenancy)


class SharkNewsItemBase(BaseModel):
    """
    Article de presse source.

    Contient l'article d'où un projet a été détecté.
    Permet la traçabilité et évite les doublons.
    """
    source_url: str = Field(..., description="URL de l'article")
    source_name: Optional[str] = Field(None, description="Nom de la source")

    # Contenu
    title: Optional[str] = Field(None, description="Titre de l'article")
    summary: Optional[str] = Field(None, description="Résumé")
    full_text: Optional[str] = Field(None, description="Texte complet")

    # Temporalité
    published_at: Optional[datetime] = Field(None, description="Date de publication")

    # Classification
    region_hint: Optional[str] = Field(None, description="Région mentionnée")
    category: Optional[str] = Field(None, description="Catégorie")

    # Crawl
    crawl_ref: Optional[str] = Field(None, description="Référence du crawl")
    crawled_at: Optional[datetime] = None

    # Métadonnées
    raw_data: Optional[Dict[str, Any]] = None


class SharkNewsItem(SharkNewsItemBase):
    """News avec ID et timestamps."""
    id: UUID
    tenant_id: UUID  # ID du client SaaS CoreMatch (multi-tenancy)
    created_at: datetime
    updated_at: datetime


class SharkNewsItemCreate(SharkNewsItemBase):
    """Données pour créer une news."""
    tenant_id: UUID  # ID du client SaaS CoreMatch (multi-tenancy)


# ============================================================
# JUNCTION / LIAISON ENTITIES
# ============================================================

class SharkProjectOrganizationBase(BaseModel):
    """
    Liaison entre un projet et une organisation.

    Définit le rôle de l'organisation dans le projet
    (MOA, MOE, entreprise générale, etc.)
    """
    project_id: UUID
    organization_id: UUID
    role_in_project: RoleInProject = Field(..., description="Rôle dans le projet")
    lot_name: Optional[str] = Field(None, description="Nom du lot si applicable")
    metadata: Dict[str, Any] = Field(default_factory=dict)
    ai_confidence: Optional[float] = Field(None, ge=0, le=1)


class SharkProjectOrganization(SharkProjectOrganizationBase):
    """Liaison avec ID et timestamp."""
    id: UUID
    created_at: datetime


class SharkOrganizationPersonBase(BaseModel):
    """
    Liaison entre une organisation et une personne.

    Définit le rôle de la personne dans l'organisation.
    """
    organization_id: UUID
    person_id: UUID
    role_in_org: RoleInOrg = Field(..., description="Rôle dans l'organisation")
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_current: bool = Field(True, description="Poste actuel?")
    ai_confidence: Optional[float] = Field(None, ge=0, le=1)


class SharkOrganizationPerson(SharkOrganizationPersonBase):
    """Liaison avec ID et timestamp."""
    id: UUID
    created_at: datetime


class SharkProjectNewsBase(BaseModel):
    """
    Liaison entre un projet et une news.

    Trace l'origine de l'information sur le projet.
    """
    project_id: UUID
    news_id: UUID
    role_of_news: NewsRole = Field("source", description="Rôle de la news")
    relevant_excerpt: Optional[str] = Field(None, description="Extrait pertinent")


class SharkProjectNews(SharkProjectNewsBase):
    """Liaison avec ID et timestamp."""
    id: UUID
    created_at: datetime


# ============================================================
# AGGREGATED / ENRICHED VIEWS
# ============================================================

class SharkProjectFull(SharkProject):
    """
    Projet enrichi avec toutes ses relations.

    Inclut les organisations impliquées et les news sources.
    """
    organizations: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Organisations liées au projet"
    )
    news_items: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Articles de presse liés"
    )
    people: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Personnes impliquées (via organisations)"
    )


class SharkOrganizationFull(SharkOrganization):
    """
    Organisation enrichie avec ses projets et personnes.
    """
    projects: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Projets où l'organisation est impliquée"
    )
    people: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Personnes de l'organisation"
    )


class SharkPersonFull(SharkPerson):
    """
    Personne enrichie avec ses organisations et projets.
    """
    organizations: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Organisations de la personne"
    )
    projects: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Projets accessibles via les organisations"
    )


# ============================================================
# GRAPH OPERATIONS
# ============================================================

class GraphNode(BaseModel):
    """Noeud générique du graphe pour visualisation."""
    id: str
    type: Literal["project", "organization", "person", "news"]
    label: str
    data: Dict[str, Any] = Field(default_factory=dict)


class GraphEdge(BaseModel):
    """Arête du graphe pour visualisation."""
    source: str
    target: str
    type: str  # "emploie", "implique", "detecte", etc.
    label: Optional[str] = None
    data: Dict[str, Any] = Field(default_factory=dict)


class ProjectGraph(BaseModel):
    """
    Représentation complète du graphe d'un projet.

    Utilisé pour la visualisation et l'analyse.
    """
    nodes: List[GraphNode] = Field(default_factory=list)
    edges: List[GraphEdge] = Field(default_factory=list)
    center_project_id: Optional[str] = None
