# ⚠️ Incompatibilités Schéma DB - analyze_cv

**Date** : 2025-10-27
**Statut** : 🚧 **BLOQUANT pour analyze_cv en production**

---

## 📊 Résumé

Le tool `analyze_cv` a été développé en supposant un schéma DB différent de celui en production. Il y a **5 incompatibilités critiques** qui empêchent son fonctionnement.

---

## 🐛 Incompatibilités Détectées

### 1. Candidat : cv_text n'existe pas

**Code attend** :
```typescript
const { data: candidate } = await supabaseAdmin
  .from('candidates')
  .select('id, first_name, last_name, cv_text, cv_json')
```

**Schéma réel** :
```sql
-- Table candidates
cv_url VARCHAR(255)        -- URL du fichier PDF/DOCX
cv_filename VARCHAR(255)   -- Nom du fichier
```

**Impact** : ❌ Le CV n'est pas disponible en texte pour l'analyse

---

### 2. Candidat : cv_json n'existe pas

**Code attend** : `cv_json` (JSONB avec CV parsé)

**Schéma réel** : Cette colonne n'existe pas

**Impact** : ❌ Pas de format JSON structuré du CV

---

### 3. Projet : title n'existe pas

**Code attend** :
```typescript
.select('id, title, job_spec')
```

**Schéma réel** :
```sql
-- Table projects
name VARCHAR(255)  -- ← La vraie colonne
```

**Impact** : ✅ **CORRIGÉ** - Remplacé `title` par `name`

---

### 4. Projet : job_spec n'existe pas

**Code attend** : `job_spec` (type JobSpec)

**Schéma réel** :
```sql
-- Table projects
job_spec_config JSONB  -- Config au format déterministe
```

**Impact** : ⚠️ **Formats différents** - Nécessite adaptation

---

### 5. Table analyses n'existe pas

**Code essayait** :
```typescript
await supabaseAdmin.from('analyses').insert({...})
```

**Schéma réel** : Pas de table `analyses`, les résultats sont stockés dans `candidates` :
```sql
-- Table candidates (colonnes d'analyse)
status VARCHAR(50)                 -- 'analyzed', 'pending', etc.
score INTEGER                      -- Score global (ancien format)
explanation TEXT                   -- Explication (ancien format)
evaluation_result JSONB            -- Résultat complet (nouveau format)
relevance_months_direct INTEGER    -- Mois d'expérience directe
relevance_months_adjacent INTEGER  -- Mois d'expérience adjacente
```

**Impact** : ✅ **CORRIGÉ** - Utilise UPDATE candidates au lieu de INSERT analyses

---

## 📋 État des Corrections

| Problème | Statut | Fichier | Ligne |
|----------|--------|---------|-------|
| `cv_text` manquant | ❌ **NON RÉSOLU** | analyze-cv.ts | 134 |
| `cv_json` manquant | ❌ **NON RÉSOLU** | analyze-cv.ts | 134 |
| `project.title` | ✅ **CORRIGÉ** | analyze-cv.ts | 156 |
| `project.job_spec` | ⚠️ **PARTIELLEMENT** | analyze-cv.ts | 180 |
| Table `analyses` | ✅ **CORRIGÉ** | analyze-cv.ts | 195-212 |

---

## 🚧 Problème Principal : Parsing de CV Manquant

Le code `analyze_cv` appelle :
```typescript
const result = await orchestrateAnalysis(
  candidate.cv_text,  // ← N'EXISTE PAS !
  project.job_spec,   // ← FORMAT DIFFÉRENT !
  {...}
);
```

**Ce qui manque** :
1. **Parser de CV** : Télécharger `cv_url` → Extraire texte du PDF/DOCX
2. **Adaptateur JobSpec** : Convertir `job_spec_config` → `JobSpec`

---

## ✅ Solutions Possibles

### Option 1 : Mode MOCK (IMMÉDIAT) ✅

**Avantage** : Fonctionne immédiatement, aucune modification nécessaire

**Comment** :
```bash
# Définir la variable d'environnement
set MCP_MOCK_MODE=true

# Lancer MCP Inspector
.\start-mcp-inspector.bat

# Tester avec données fictives
{
  "candidateId": "mock-candidate-1",
  "projectId": "mock-project-1",
  "mode": "balanced"
}
```

**Limites** : Données fictives, pas de test avec vraie DB

---

### Option 2 : Implémenter Parser de CV (LONG TERME)

**Étapes** :
1. Créer une fonction `parseCVFromURL(cv_url: string)` qui :
   - Télécharge le fichier depuis `cv_url`
   - Détecte le type (PDF/DOCX/TXT)
   - Extrait le texte
   - Retourne le texte parsé

2. Créer une migration pour ajouter `cv_text` (optionnel) :
   ```sql
   ALTER TABLE candidates ADD COLUMN cv_text TEXT;
   ```

3. Modifier `analyze_cv` pour utiliser le parser :
   ```typescript
   let cvText: string;
   if (candidate.cv_text) {
     cvText = candidate.cv_text;
   } else if (candidate.cv_url) {
     cvText = await parseCVFromURL(candidate.cv_url);
   } else {
     throw new Error('CV_MISSING');
   }
   ```

**Temps estimé** : 2-4 heures

**Dépendances** :
- `pdf-parse` pour PDFs
- `mammoth` pour DOCX
- Gestion erreurs parsing

---

### Option 3 : Adaptateur pour Schéma Actuel (MOYEN TERME)

**Étapes** :
1. Créer un adaptateur `loadCandidateCV()` qui retourne un objet compatible
2. Créer un adaptateur `loadProjectJobSpec()` qui convertit `job_spec_config` → `JobSpec`
3. Modifier `analyze_cv` pour utiliser ces adaptateurs

**Temps estimé** : 1-2 heures

**Avantage** : Réutilise l'infrastructure existante

---

### Option 4 : Upload de CVs de Test (COURT TERME)

**Étapes** :
1. Utiliser l'interface web Corematch
2. Uploader des CVs PDF pour les candidats de test
3. Vérifier que `cv_url` est rempli
4. **Toujours bloqué** car `cv_text` n'existe pas

**Conclusion** : ❌ Ne résout pas le problème, il faut quand même le parser

---

## 🎯 Recommandation

### Pour Tester Maintenant : **Option 1 (Mode MOCK)**

C'est la seule option qui fonctionne **immédiatement** sans modification.

### Pour Production : **Option 2 (Parser de CV)**

Implémenter le parsing de CV est **indispensable** pour utiliser `analyze_cv` en production.

---

## 📝 Commandes de Test

### Test en Mode MOCK (Fonctionne)

```cmd
REM Définir la variable
set MCP_MOCK_MODE=true

REM Lancer MCP Inspector
.\start-mcp-inspector.bat

REM Dans MCP Inspector, tester :
{
  "candidateId": "mock-candidate-1",
  "projectId": "mock-project-1",
  "mode": "balanced"
}
```

### Test en Production (Bloqué)

```cmd
REM Lancer normalement
.\start-mcp-inspector.bat

REM Dans MCP Inspector, tester :
{
  "candidateId": "06b6f7dd-efef-4071-b684-33fe155a7532",
  "projectId": "037e7639-3d42-45f1-86c2-1f21a72fb96a",
  "mode": "balanced"
}

REM Erreur attendue :
REM "CV_MISSING" ou erreur dans orchestrateAnalysis
```

---

## 📊 Récapitulatif Final

| Tool | Statut Production | Statut MOCK | Bloquant |
|------|------------------|-------------|----------|
| **get_candidates** | ✅ **100% OPÉRATIONNEL** | ✅ Fonctionne | Non |
| **analyze_cv** | ❌ **BLOQUÉ** (schéma incompatible) | ✅ Fonctionne | Oui |

---

## 🛠️ Prochaines Étapes Recommandées

1. **Court terme** : Tester `analyze_cv` en mode MOCK pour valider la logique
2. **Moyen terme** : Implémenter parser de CV (Option 2)
3. **Long terme** : Synchroniser le code MCP avec le schéma DB de production

---

**Status** : 🚧 analyze_cv nécessite parsing de CV pour fonctionner en production

📄 **Voir aussi** :
- `STATUS_MCP_DEPLOYMENT.md` - Status global du déploiement
- `BUG_FIX_DATABASE_ERROR.md` - Fix table analyses
- `BUG_FIX_ACCESS_DENIED.md` - Fix access control
