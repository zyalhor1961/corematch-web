# Shark Hunter - Architecture Technique

## Vue d'ensemble

**CoreMatch Shark Hunter** est un module de détection et suivi de projets BTP (Bâtiment et Travaux Publics).
Il analyse la presse spécialisée et les appels d'offres pour créer un graphe de relations :
- **Projets** → Organisations → Personnes
- **News** → Projets (traçabilité)

### Vision produit

> "Waze pour le commercial BTP" - Navigation prédictive vers les opportunités.

## Phases de développement

| Phase | Description | Status |
|-------|-------------|--------|
| **Phase 1** | Architecture PostgreSQL + Backend FastAPI | ✅ Done |
| **Phase 2** | Agents IA (ProjectExtractor, Ingestion) | ✅ Done |
| **Phase 3** | Lead Sourcing + Navigation IA | Planned |
| **Phase 4** | Scoring 360 (shark_score) | Planned |

---

## 1. Schéma de données (PostgreSQL)

### Tables principales

```
shark_projects          # Projets BTP détectés
shark_organizations     # Entreprises/Collectivités impliquées
shark_people            # Décideurs/Contacts (PII - RGPD)
shark_news_items        # Articles de presse sources
```

### Tables de liaison (graphe)

```
shark_project_organizations   # Projet ↔ Organisation (avec rôle)
shark_organization_people     # Organisation ↔ Personne (avec rôle)
shark_project_news            # Projet ↔ News (traçabilité)
```

### Vues consolidées

```sql
shark_project_full       -- Projet + organizations[] + news_items[]
shark_organization_full  -- Organisation + projects[] + people[]
```

---

## 2. Multi-tenant

### Mécanisme

Toutes les tables shark_* contiennent une colonne `tenant_id` :

```sql
tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE
```

- `organizations` = table des clients SaaS CoreMatch (tenants)
- `shark_organizations` = organisations BTP détectées dans les articles

### RLS (Row Level Security)

```sql
CREATE POLICY "shark_projects_tenant_select" ON shark_projects
    FOR SELECT USING (user_belongs_to_tenant(tenant_id));
```

Fonction helper :

```sql
CREATE FUNCTION user_belongs_to_tenant(target_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_id = target_tenant_id
        AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 3. Taxonomie des rôles

### Organisation Type (`org_type`)

| Valeur | Description |
|--------|-------------|
| `MOA` | Maître d'Ouvrage (client/donneur d'ordre) |
| `MOE` | Maître d'Oeuvre (architecte, BET) |
| `General_Contractor` | Entreprise Générale (mandataire) |
| `Subcontractor` | Sous-traitant |
| `Operator` | Exploitant (Tisséo, SNCF...) |
| `Other` | Autre |

### Rôle dans projet (`role_in_project`)

Mêmes valeurs que `org_type`.

### Phase projet (`phase`)

```
detection → etude → appel_offres → attribution → travaux → livraison
                                                           ↓
                                                       abandonne
```

### Échelle estimée (`estimated_scale`)

| Valeur | Budget indicatif | Exemple |
|--------|------------------|---------|
| `Small` | < 5M€ | Rénovation légère, local commercial |
| `Medium` | 5-30M€ | Collège, gymnase, petit immeuble |
| `Large` | 30-100M€ | Hôpital, ZAC, grand ensemble |
| `Mega` | > 100M€ | Métro, tramway, LGV |

---

## 4. API Backend (FastAPI)

### Endpoints disponibles

#### Projects

```
GET  /shark/projects/{tenant_id}                    # Liste paginée
GET  /shark/projects/{tenant_id}/{project_id}       # Détail complet
GET  /shark/projects/{tenant_id}/{project_id}/organizations
GET  /shark/projects/{tenant_id}/{project_id}/news
```

#### Organizations

```
GET  /shark/organizations/{tenant_id}                    # Liste paginée
GET  /shark/organizations/{tenant_id}/{organization_id}  # Détail complet
GET  /shark/organizations/{tenant_id}/{organization_id}/people
```

#### Statistics

```
GET  /shark/stats/{tenant_id}                       # Agrégats pour dashboard
```

#### Ingestion (Phase 2)

```
POST /shark/ingest         # Ingérer un article
POST /shark/ingest/batch   # Ingérer plusieurs articles
POST /shark/extract        # Extraire sans ingérer
GET  /shark/status         # Vérifier disponibilité
```

### Filtres disponibles

```
?phase=travaux
?type=renovation
?location_city=Toulouse
?estimated_scale=Large
?shark_priority=high
?min_shark_score=50
?search=metro
?order_by=created_at&order_desc=true
?page=1&page_size=20
```

---

## 5. Service Python

### Structure

```
python-service/
├── services/
│   ├── shark_graph_service.py   # Requêtes SQL centralisées
│   └── shark_ingestion.py       # Ingestion avec déduplication
├── agents/
│   └── project_extractor.py     # Agent LLM extraction
└── prompts/
    └── project_extractor.yaml   # Prompt avec Date Anchor
```

### Utilisation

```python
from services.shark_graph_service import SharkGraphService, ProjectFilters

service = SharkGraphService()

# Liste paginée
result = await service.list_projects(
    tenant_id="xxx-xxx",
    filters=ProjectFilters(phase="travaux", page=1)
)

# Détail complet
project = await service.get_project_full(tenant_id, project_id)

# Statistiques
stats = await service.get_tenant_stats(tenant_id)
```

---

## 6. Ingestion (Phase 2)

### Flux

```
Article (texte)
    → ProjectExtractor (LLM)
    → ExtractionResult {project, organizations[], news}
    → SharkIngestionService
        → find_or_create_project (déduplication pg_trgm)
        → upsert_organizations
        → link_project_organization (avec raw_role_label)
        → upsert_news_item
        → link_project_news
    → IngestionResult {project_id, is_duplicate}
```

### Déduplication

1. Normalisation du nom (`normalize_project_name`)
   - Lowercase
   - Suppression accents (unaccent)
   - Suppression articles français (le, la, de, du...)

2. Recherche par similarité (`find_similar_project`)
   - Extension `pg_trgm`
   - Index GIN sur `normalized_name`
   - Seuil par défaut : 0.6

### Date Anchor

Le prompt utilise la date de publication comme ancre temporelle :

```
"au printemps prochain" (pub: 2024-10-15) → "2025-03-01"
"fin 2027" → "2027-12-31"
"dans 18 mois" → "2026-04-15"
```

---

## 7. RGPD Compliance

### Données sensibles (PII)

La table `shark_people` contient des données personnelles :

| Colonne | Type | Note |
|---------|------|------|
| `full_name` | TEXT | PII |
| `email_guess` | TEXT | PII - Email deviné |
| `phone` | TEXT | PII |
| `linkedin_url` | TEXT | PII (publique) |

### Commentaires SQL

```sql
COMMENT ON TABLE shark_people IS
    'Contient des données personnelles (PII). '
    'RGPD: Consentement requis pour traitement commercial.';

COMMENT ON COLUMN shark_people.email_guess IS
    'PII SENSIBLE: Email potentiellement reconstitué. '
    'RGPD: Donnée personnelle - consentement requis.';
```

### Future : Privacy Airlock

Dans les phases futures, cette table sera protégée par un mécanisme Privacy Airlock :
- Accès contrôlé aux PII
- Audit trail des consultations
- Pseudonymisation possible

---

## 8. Performance

### Indexes critiques

```sql
-- Pour la vue shark_project_full
CREATE INDEX idx_shark_po_project_org ON shark_project_organizations(project_id, organization_id);
CREATE INDEX idx_shark_pn_project_news ON shark_project_news(project_id, news_id);

-- Pour les requêtes fréquentes
CREATE INDEX idx_shark_projects_tenant_phase ON shark_projects(tenant_id, phase);
CREATE INDEX idx_shark_projects_tenant_score ON shark_projects(tenant_id, shark_score DESC);

-- Pour la déduplication
CREATE INDEX idx_shark_projects_name_trgm ON shark_projects USING gin (normalized_name gin_trgm_ops);
```

### Avertissement vue

```sql
COMMENT ON VIEW shark_project_full IS
    'ATTENTION PERFORMANCE: json_agg sur grandes volumétries. '
    'Si requêtes > 500ms sur > 10k projets, prévoir matérialisation '
    '(CREATE MATERIALIZED VIEW + REFRESH CONCURRENTLY).';
```

---

## 9. Migrations

| Fichier | Description |
|---------|-------------|
| `20251129100000_shark_project_graph.sql` | Création initiale du graphe |
| `20251129110000_shark_rename_org_to_tenant.sql` | Renommage org_id → tenant_id |
| `20251129120000_shark_estimated_scale.sql` | estimated_scale + déduplication |
| `20251129130000_shark_phase1_consolidation.sql` | RGPD + indexes + vue consolidée |

---

## 10. Phases futures

### Phase 3 - Lead Sourcing

- Intégration avec CRM existant
- Matching automatique projet ↔ offre commerciale
- Alertes sur nouveaux projets correspondant aux critères

### Phase 4 - Scoring 360

- Calcul automatique de `shark_score` (0-100)
- Critères : budget, phase, correspondance métier, accessibilité décideur
- Priorisation `shark_priority` : low, medium, high, critical

---

## Contact

Pour questions techniques sur Shark Hunter, contacter l'équipe CoreMatch.
