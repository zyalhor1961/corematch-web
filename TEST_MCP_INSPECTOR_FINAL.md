# 🧪 Test MCP Inspector - Guide Final

## ✅ Statut : Prêt pour Tests

Tous les problèmes ont été résolus :
- ✅ Logs stdout → stderr (MCP stdio clean)
- ✅ Variables d'environnement configurées
- ✅ API Key fonctionnelle
- ✅ Bug ACCESS_DENIED corrigé (`organization_members.id` → `user_id, role`)

## 🚀 Lancer MCP Inspector

### Méthode 1 : Script Batch (RECOMMANDÉ)

```cmd
.\start-mcp-inspector.bat
```

Le script charge automatiquement toutes les variables d'environnement nécessaires.

### Méthode 2 : Commande Manuelle

```cmd
npx dotenv-cli -e .env.production -- npx @modelcontextprotocol/inspector npx tsx bin/mcp-server.ts
```

## ✅ Vérification du Démarrage

Vous devriez voir dans la console :

```
🚀 Starting Corematch MCP Server...

[MCP Auth] ✅ Authenticated as mcp_api_key:86e4badc-cd84-4113-a768-fbd61804ff48
✅ Corematch MCP Server running
   Waiting for requests via stdio...
```

Et dans MCP Inspector (navigateur) :
- **2 tools** disponibles : `analyze_cv` et `get_candidates`
- **0 prompts**
- **0 resources**

## 🧪 Tests à Effectuer

### Test 1 : get_candidates ✅ PRIORITAIRE

**Objectif** : Lister les candidats du projet

**Tool** : `get_candidates`

**Arguments** :
```json
{
  "projectId": "7ee1d2d9-0896-4a26-9109-a276385a3bc6",
  "limit": 10,
  "status": "all"
}
```

**Résultat Attendu** :
```json
{
  "candidates": [
    {
      "id": "417c3ac3-21d6-499d-bb07-cc776ab4ce45",
      "name": "Marie DUPONT",
      "email": "marie.dupont@example.com",
      "status": "pending",
      "consent_mcp": true
    },
    ...
  ],
  "total": 10,
  "has_more": false
}
```

**Variations à tester** :
```json
// Seulement les analysés
{"projectId": "7ee1d2d9-0896-4a26-9109-a276385a3bc6", "status": "analyzed"}

// Seulement les en attente
{"projectId": "7ee1d2d9-0896-4a26-9109-a276385a3bc6", "status": "pending"}

// Pagination
{"projectId": "7ee1d2d9-0896-4a26-9109-a276385a3bc6", "limit": 5, "offset": 5}
```

---

### Test 2 : analyze_cv

**Objectif** : Analyser un CV candidat vs job spec

**Tool** : `analyze_cv`

**Arguments** :
```json
{
  "candidateId": "417c3ac3-21d6-499d-bb07-cc776ab4ce45",
  "projectId": "7ee1d2d9-0896-4a26-9109-a276385a3bc6",
  "mode": "balanced"
}
```

**Résultat Attendu** :
```json
{
  "analysis": {
    "overall_score": 72,
    "recommendation": "STRONG_MATCH",
    "key_strengths": ["..."],
    "potential_concerns": ["..."],
    "experience_match": { "score": 75, "explanation": "..." },
    "skills_match": { "score": 80, "explanation": "..." },
    "education_match": { "score": 70, "explanation": "..." }
  },
  "cached": false
}
```

**Variations à tester** :
```json
// Mode rapide (moins cher, cache 7j)
{
  "candidateId": "417c3ac3-21d6-499d-bb07-cc776ab4ce45",
  "projectId": "7ee1d2d9-0896-4a26-9109-a276385a3bc6",
  "mode": "fast"
}

// Mode détaillé (plus cher, cache 30j)
{
  "candidateId": "417c3ac3-21d6-499d-bb07-cc776ab4ce45",
  "projectId": "7ee1d2d9-0896-4a26-9109-a276385a3bc6",
  "mode": "detailed"
}

// Test cache : ré-exécuter la même analyse
// → Devrait retourner {"cached": true} et être instantané
```

---

## 🔍 Vérification des Logs

### Logs Normaux (stderr)

Dans la console où MCP Inspector tourne, vous verrez :

**get_candidates** :
```
[get_candidates] Checking access for user 86e4badc-cd84-4113-a768-fbd61804ff48 to project 7ee1d2d9-0896-4a26-9109-a276385a3bc6
[get_candidates] Access check result: true
[get_candidates] Fetching candidates for project 7ee1d2d9-0896-4a26-9109-a276385a3bc6
[get_candidates] Found 10 candidates
```

**analyze_cv** :
```
[analyze_cv] Checking access for user 86e4badc-cd84-4113-a768-fbd61804ff48
[analyze_cv] Access granted
[analyze_cv] Starting CV analysis for candidate 417c3ac3-21d6-499d-bb07-cc776ab4ce45
[analyze_cv] ✅ Analysis complete (overall_score: 72)
```

### Erreurs Possibles

#### ❌ "ACCESS_DENIED: You do not have access to this project"

**Cause** : Le bug devrait être corrigé, mais si ça arrive :

```bash
# Tester l'accès directement
npx dotenv-cli -e .env.production -- npx tsx scripts/test-mcp-access.ts
```

Devrait afficher `✅ ACCESS GRANTED`.

#### ❌ "AUTH_FAILED: Invalid or inactive API key"

**Cause** : Variables d'environnement non chargées

**Solution** : Utiliser `start-mcp-inspector.bat` au lieu de la commande manuelle

#### ❌ "CONSENT_REQUIRED: Candidate has not given MCP consent"

**Cause** : Le candidat n'a pas `consent_mcp = true`

**Solution** :
```sql
UPDATE candidates
SET consent_mcp = true
WHERE id = 'candidate-id-here';
```

#### ❌ "NO_CV: Candidate has no CV uploaded"

**Cause** : Le candidat n'a pas de `cv_file_url`

**Solution** : Utiliser un autre candidat qui a un CV.

---

## 📊 Checklist de Test

### Phase 1 : Validation Basique
- [ ] MCP Inspector démarre sans erreurs
- [ ] Serveur s'authentifie correctement (logs montrent user_id)
- [ ] 2 tools sont listés dans l'interface

### Phase 2 : get_candidates
- [ ] Récupération de tous les candidats (`status: "all"`)
- [ ] Filtre par statut analysé (`status: "analyzed"`)
- [ ] Filtre par statut en attente (`status: "pending"`)
- [ ] Pagination fonctionne (`limit` et `offset`)
- [ ] Champs retournés sont corrects (id, name, email, status, consent_mcp)

### Phase 3 : analyze_cv
- [ ] Analyse en mode `balanced` fonctionne
- [ ] Résultat contient tous les champs attendus
- [ ] Score overall_score entre 0-100
- [ ] Recommendation est valide (STRONG_MATCH, GOOD_MATCH, etc.)
- [ ] Mode `fast` fonctionne
- [ ] Mode `detailed` fonctionne
- [ ] **CACHE** : Ré-analyse retourne `cached: true`

### Phase 4 : Cas Limites
- [ ] Projet inexistant → erreur claire
- [ ] Candidat inexistant → erreur claire
- [ ] Candidat sans consent MCP → erreur `CONSENT_REQUIRED`
- [ ] Candidat sans CV → erreur `NO_CV`

---

## 🐛 Debug si Problèmes

### Script de Test Direct

Si problèmes avec MCP Inspector, tester directement :

```bash
npx dotenv-cli -e .env.production -- npx tsx scripts/test-mcp-access.ts
```

Devrait afficher :
```
✅ API Key verified successfully
✅ Project found
✅ Membership found
✅ ACCESS GRANTED
```

### Vérifier la DB

```bash
# Vérifier API key
npx dotenv-cli -e .env.production -- npx tsx scripts/debug-api-key.ts

# Vérifier projet
npx dotenv-cli -e .env.production -- npx tsx scripts/debug-project-access.ts

# Vérifier membership
npx dotenv-cli -e .env.production -- npx tsx scripts/check-org-membership.ts
```

---

## ✅ Succès Final

Quand tous les tests passent, vous êtes prêt pour :

### Étape Suivante : Intégration Claude Desktop

Éditer le fichier de config Claude Desktop :
- **Windows** : `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS** : `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "corematch": {
      "command": "npx",
      "args": ["tsx", "F:\\corematch\\bin\\mcp-server.ts"],
      "env": {
        "NEXT_PUBLIC_SUPABASE_URL": "https://glexllbywdvlxpbanjmn.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "eyJhbGci...",
        "MCP_AUTH_HEADER": "ApiKey mcp_sk_da36279d0fd737ee9596e9e2865e731220f37ddc7c67d6d4",
        "OPENAI_API_KEY": "sk-proj-...",
        "GEMINI_API_KEY": "AIzaSy...",
        "NODE_ENV": "production"
      }
    }
  }
}
```

Redémarrer Claude Desktop et les tools seront disponibles ! 🎉

---

**Status** : ✅ Prêt pour tests - Bug ACCESS_DENIED corrigé
