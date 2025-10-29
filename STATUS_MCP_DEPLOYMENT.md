# 📊 Status Déploiement MCP Server

**Date** : 2025-10-27
**Version** : Production

---

## ✅ SUCCÈS : Tool `get_candidates`

### Bugs Résolus

#### 1. ACCESS_DENIED - Colonne `organization_members.id` inexistante ✅
**Fichier** : `lib/auth/mcp-auth.ts:315`
**Fix** : Remplacé `.select('id')` par `.select('user_id, role')`
**Doc** : `BUG_FIX_ACCESS_DENIED.md`

#### 2. DATABASE_ERROR - Table `analyses` inexistante ✅
**Fichier** : `lib/mcp/server/tools/get-candidates.ts:120-186`
**Fix** : Utilisation de `candidates.score` et `candidates.evaluation_result` au lieu d'un join avec `analyses`
**Doc** : `BUG_FIX_DATABASE_ERROR.md`

### Résultat

```json
{
  "candidates": [
    {
      "id": "73f0ac1a-a779-4c7e-8f83-5b636f03da2b",
      "name": "Jean Dupont",
      "email": "jean.dupont@email.com",
      "status": "analyzed",
      "analyzed_at": "2025-09-03T21:31:04.479+00:00",
      "consent_mcp": true
    }
    ... (10 candidats total)
  ],
  "total": 10,
  "has_more": false
}
```

✅ **Tool `get_candidates` 100% opérationnel**

---

## ⚠️ BLOQUÉ : Tool `analyze_cv`

### Problème

Le tool `analyze_cv` **ne peut pas être testé** car :

1. **Aucun candidat n'a de CV** dans la base de test
   - `cv_url: NULL` pour tous les 10 candidats
   - Les candidats sont marqués `analyzed` mais n'ont ni score ni `evaluation_result`

2. **Code attend des colonnes inexistantes**
   - Le code cherche `cv_text` et `cv_json` qui n'existent pas
   - Les vraies colonnes sont `cv_url` et `cv_filename`

### Bugs Corrigés (Prévention)

#### 3. DATABASE_ERROR - Table `analyses` inexistante (sauvegarde) ✅
**Fichier** : `lib/mcp/server/tools/analyze-cv.ts:194-212`
**Fix** : Utilisation de `UPDATE candidates` au lieu de `INSERT INTO analyses`

**Avant** :
```typescript
await supabaseAdmin.from('analyses').insert({
  candidate_id: args.candidateId,
  // ...
});
```

**Après** :
```typescript
await supabaseAdmin.from('candidates').update({
  status: 'analyzed',
  score: Math.round(result.final_decision.overall_score_0_to_100),
  evaluation_result: result.final_decision, // JSONB complet
  relevance_months_direct: result.final_decision.relevance_summary?.months_direct ?? 0,
  relevance_months_adjacent: result.final_decision.relevance_summary?.months_adjacent ?? 0,
}).eq('id', args.candidateId);
```

### Bug Non Résolu

#### 4. CV Data Missing - Colonnes `cv_text`/`cv_json` inexistantes ⚠️
**Fichier** : `lib/mcp/server/tools/analyze-cv.ts:134`
**Problème** : Le code cherche `cv_text` et `cv_json` qui n'existent pas dans le schéma

**Code actuel** :
```typescript
const { data: candidate } = await supabaseAdmin
  .from('candidates')
  .select('id, first_name, last_name, cv_text, cv_json')  // ← Colonnes inexistantes
  .eq('id', args.candidateId)
  .single();
```

**Colonnes réelles** :
- `cv_url` (TEXT) - URL du fichier CV
- `cv_filename` (VARCHAR) - Nom du fichier

**Solutions possibles** :

1. **Option A : Adapter le code pour utiliser `cv_url`**
   - Télécharger le fichier depuis `cv_url`
   - Parser le PDF/DOCX
   - Extraire le texte
   - ⚠️  Nécessite implémentation d'un parseur de CV

2. **Option B : Créer des candidats de test avec CVs**
   - Uploader des CVs de test
   - Mettre à jour les candidats existants
   - ⚠️  Nécessite accès à l'upload UI ou création manuelle

3. **Option C : Mode MOCK uniquement**
   - Tester `analyze_cv` uniquement en mode MOCK
   - Ne pas tester en production pour l'instant
   - ✅ Solution temporaire simple

---

## 📊 Récapitulatif Global

| Composant | Statut | Notes |
|-----------|--------|-------|
| API Key Production | ✅ | Générée et fonctionnelle |
| Auth MCP | ✅ | Fonctionne (Bearer + ApiKey) |
| Access Control | ✅ | **CORRIGÉ** (bug organization_members.id) |
| DB Schema - get_candidates | ✅ | **CORRIGÉ** (bug relation analyses) |
| DB Schema - analyze_cv | ✅ | **CORRIGÉ** (bug insert analyses) |
| **Tool get_candidates** | ✅ | **100% OPÉRATIONNEL** |
| **Tool analyze_cv** | ⚠️ | **BLOQUÉ** (pas de CVs dans la DB de test) |
| MCP Inspector | ✅ | Fonctionnel avec get_candidates |
| Claude Desktop | ⏳ | Pas encore configuré |

---

## 🚀 Prochaines Étapes

### Option 1 : Tester analyze_cv en Mode MOCK

Le mode MOCK est déjà implémenté et fonctionne avec des données de test en mémoire.

**Commande** :
```bash
# Définir la variable d'environnement MOCK
set MCP_MOCK_MODE=true

# Lancer MCP Inspector
.\start-mcp-inspector.bat

# Tester analyze_cv
{
  "candidateId": "mock-candidate-1",
  "projectId": "mock-project-1",
  "mode": "balanced"
}
```

### Option 2 : Uploader des CVs de Test

1. Utiliser l'interface web Corematch
2. Uploader des CVs PDF pour les 10 candidats
3. Retester `analyze_cv`

### Option 3 : Créer un Candidat de Test Complet

Créer un script qui :
1. Crée un candidat avec un CV fictif
2. Upload un PDF de test
3. Active `consent_mcp`
4. Teste `analyze_cv`

---

## 📁 Fichiers de Documentation Créés

| Fichier | Description |
|---------|-------------|
| `BUG_FIX_ACCESS_DENIED.md` | Fix bug organization_members.id |
| `BUG_FIX_DATABASE_ERROR.md` | Fix bug table analyses inexistante |
| `TEST_MCP_INSPECTOR_FINAL.md` | Guide de test complet |
| `FIX_AUTH_ERROR.md` | Fix erreur AUTH_FAILED |
| `TEST_PRODUCTION.md` | Guide de test initial |
| `scripts/test-mcp-access.ts` | Test unitaire access control |
| `scripts/test-get-candidates.ts` | Test unitaire get_candidates |
| `scripts/check-cv-data.ts` | Vérification données CV |
| `start-mcp-inspector.bat` | Script de lancement automatique |
| `STATUS_MCP_DEPLOYMENT.md` | **Ce fichier** - Status global |

---

## ✅ Déploiement Partiel Réussi

**get_candidates** est **100% fonctionnel en production** ✅

**analyze_cv** nécessite :
- Soit des CVs uploadés dans la DB
- Soit un parseur de CV depuis `cv_url`
- Soit test en mode MOCK uniquement

**Recommandation** : Utiliser `get_candidates` en production et implémenter l'upload de CVs avant de tester `analyze_cv`.

---

**Status** : ✅ Déploiement partiel réussi - 1/2 tools opérationnels
