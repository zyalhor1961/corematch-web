# Shark Hunter - Project Graph

## Vue d'ensemble

Le **Project Graph** est le modèle de données central de la vision "Shark Hunter" de CoreMatch. Il permet de modéliser les relations entre :

- **Projets BTP** (chantiers, rénovations, infrastructures)
- **Organisations** (MOA, MOE, entreprises de travaux)
- **Personnes** (décideurs, chefs de projet)
- **News** (articles de presse sources)

## Architecture du graphe

```
                    ┌─────────────┐
                    │    NEWS     │
                    │  (source)   │
                    └──────┬──────┘
                           │ détecte
                           ▼
                    ┌─────────────┐
                    │   PROJET    │
                    │   (BTP)     │
                    └──────┬──────┘
                           │ implique
                           ▼
                    ┌─────────────┐
                    │ORGANISATION │
                    │(MOA/MOE/...)│
                    └──────┬──────┘
                           │ emploie
                           ▼
                    ┌─────────────┐
                    │  PERSONNE   │
                    │ (décideur)  │
                    └─────────────┘
```

## Tables Supabase

### Tables principales

| Table | Description |
|-------|-------------|
| `shark_projects` | Projets BTP détectés par l'IA |
| `shark_organizations` | Entreprises/collectivités impliquées |
| `shark_people` | Décideurs et contacts |
| `shark_news_items` | Articles de presse sources |

### Tables de liaison (graphe)

| Table | Relation |
|-------|----------|
| `shark_project_organizations` | Projet ↔ Organisation (+ rôle) |
| `shark_organization_people` | Organisation ↔ Personne (+ rôle) |
| `shark_project_news` | Projet ↔ News (traçabilité) |

## Types et enums

### Types de projets (`shark_projects.type`)
- `construction_neuve`
- `renovation`
- `extension`
- `demolition`
- `infrastructure`
- `amenagement`
- `maintenance`
- `autre`

### Phases de projet (`shark_projects.phase`)
```
detection → etude → appel_offres → attribution → travaux → livraison
                                                         ↘ abandonne
```

### Types d'organisations (`shark_organizations.org_type`)
- `moa` - Maître d'Ouvrage (client final)
- `moe` - Maître d'Oeuvre (architecte, BET)
- `entreprise_gros_oeuvre`
- `entreprise_second_oeuvre`
- `promoteur`
- `collectivite`
- `etablissement_public`
- `fonciere`
- `autre`

### Rôles dans un projet (`shark_project_organizations.role_in_project`)
- `maitrise_ouvrage`
- `maitrise_oeuvre`
- `entreprise_generale`
- `sous_traitant`
- `fournisseur`
- `cotraitant`
- `autre`

### Rôles dans une organisation (`shark_organization_people.role_in_org`)
- `dg` - Directeur Général
- `dga` - Directeur Général Adjoint
- `directeur_travaux`
- `chef_de_projet`
- `conducteur_travaux`
- `responsable_commercial`
- `acheteur`
- `prescripteur`
- `autre`

## Modèles Python

Les modèles Pydantic sont définis dans `python-service/models/shark_graph.py` :

```python
from models.shark_graph import (
    SharkProject,
    SharkOrganization,
    SharkPerson,
    SharkNewsItem,
    SharkProjectFull,  # Projet enrichi avec relations
    ProjectGraph,      # Pour visualisation
)
```

## Exemples d'utilisation

### Créer un projet avec ses relations

```python
from models import SharkProjectCreate, SharkOrganizationCreate

# 1. Créer le projet
project = SharkProjectCreate(
    tenant_id=user_tenant_id,  # ID du client SaaS CoreMatch
    name="Rénovation Hôtel Martinez",
    type="renovation",
    location_city="Cannes",
    location_region="PACA",
    budget_amount=15_000_000,
    phase="etude",
    sector_tags=["hotel", "luxe", "tertiaire"],
    shark_score=85,
    shark_priority="high"
)

# 2. Créer l'organisation BTP (MOA)
moa = SharkOrganizationCreate(
    tenant_id=user_tenant_id,  # Même tenant
    name="Groupe Barrière",
    org_type="moa",
    city="Paris",
    size_bucket="ge"
)

# 3. Lier projet ↔ organisation
link = SharkProjectOrganizationBase(
    project_id=project_id,
    organization_id=moa_id,
    role_in_project="maitrise_ouvrage"
)
```

### Requêter le graphe

```sql
-- Tous les projets d'un tenant avec leurs organisations
SELECT * FROM shark_project_full
WHERE tenant_id = 'xxx';

-- Personnes impliquées dans un projet
SELECT p.*, op.role_in_org, o.name as org_name
FROM shark_people p
JOIN shark_organization_people op ON op.person_id = p.id
JOIN shark_organizations o ON o.id = op.organization_id
JOIN shark_project_organizations po ON po.organization_id = o.id
WHERE po.project_id = 'xxx';
```

## Scoring Shark

Chaque projet a un `shark_score` (0-100) et une `shark_priority` qui seront calculés par l'IA en fonction de :

- Pertinence avec l'offre de l'utilisateur
- Budget du projet
- Phase (timing)
- Accessibilité des décideurs
- Historique de succès sur projets similaires

## Roadmap

1. **Phase 1** (actuelle) : Schéma et modèles ✅
2. **Phase 2** : Agents IA pour extraction depuis news
3. **Phase 3** : Scoring et prioritisation automatique
4. **Phase 4** : UI Graph Viewer + Shark Moves

## Notes techniques

- Préfixe `shark_` pour éviter conflit avec tables existantes
- **`tenant_id`** = ID du client SaaS CoreMatch (multi-tenancy), PAS une org BTP
- RLS activé sur toutes les tables via `user_belongs_to_tenant()`
- Vue `shark_project_full` pour requêtes enrichies
- Indexes optimisés pour recherche par location/type/phase
