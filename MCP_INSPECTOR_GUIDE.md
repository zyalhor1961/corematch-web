# 🔍 Guide MCP Inspector - Test du Serveur Corematch

**MCP Inspector** est un outil de debugging interactif pour tester les serveurs MCP.

---

## 🚀 Démarrage Rapide

### Étape 1: Lancer MCP Inspector

```bash
npx @modelcontextprotocol/inspector npx tsx bin/test-mcp-server.ts
```

**Ce qui se passe**:
1. MCP Inspector démarre un serveur web local
2. Il lance votre serveur MCP Corematch en arrière-plan
3. Il connecte les deux via stdio

**Output attendu**:
```
MCP Inspector running at http://localhost:5173
Server started successfully
```

### Étape 2: Ouvrir l'interface web

Ouvrir votre navigateur sur: **http://localhost:5173**

Vous verrez l'interface MCP Inspector avec:
- Liste des tools disponibles (gauche)
- Console d'exécution (centre)
- Logs du serveur (droite)

---

## 🧪 Tests à Effectuer

### Test 1: Lister les Tools Disponibles

**Action**: L'interface affiche automatiquement les tools disponibles

**Tools attendus**:
1. ✅ `analyze_cv` - Analyser un CV contre un JobSpec
2. ✅ `get_candidates` - Lister les candidats d'un projet

### Test 2: Tool `get_candidates`

**Objectif**: Tester la liste des candidats

**Dans MCP Inspector**:
1. Cliquer sur le tool `get_candidates`
2. Remplir les paramètres:
   ```json
   {
     "projectId": "test-project-123",
     "limit": 10,
     "status": "all"
   }
   ```
3. Cliquer "Execute"

**Résultat attendu** (avec vraie DB):
```json
{
  "candidates": [
    {
      "id": "candidate-123",
      "name": "John Doe",
      "email": "john@example.com",
      "status": "analyzed",
      "score": 85,
      "recommendation": "YES",
      "consent_mcp": true
    }
  ],
  "total": 1,
  "has_more": false
}
```

**Avec DB de test** (env vars de test):
```json
{
  "error": "DATABASE_ERROR: relation \"candidates\" does not exist"
}
```
(Normal si pas de vraie DB connectée)

### Test 3: Tool `analyze_cv`

**Objectif**: Tester l'analyse complète d'un CV

**Dans MCP Inspector**:
1. Cliquer sur le tool `analyze_cv`
2. Remplir les paramètres:
   ```json
   {
     "candidateId": "candidate-123",
     "projectId": "project-456",
     "mode": "balanced"
   }
   ```
3. Cliquer "Execute"

**Résultat attendu** (avec vraie DB):
```json
{
  "recommendation": "YES",
  "score": 85.5,
  "strengths": ["React", "Node.js", "TypeScript"],
  "weaknesses": ["AWS", "Docker"],
  "cost_usd": 0.045,
  "duration_ms": 12500,
  "from_cache": false,
  "context_snapshot": {
    "engine": "corematch-mcp",
    "providers_used": ["openai", "gemini"],
    "consensus_level": "strong",
    "pii_masking_level": "partial"
  }
}
```

### Test 4: Gestion d'Erreurs

**Test 4.1: Candidate introuvable**
```json
{
  "candidateId": "non-existent-id",
  "projectId": "project-456",
  "mode": "balanced"
}
```

**Erreur attendue**:
```json
{
  "error": "CANDIDATE_NOT_FOUND: Candidate non-existent-id not found"
}
```

**Test 4.2: Consent MCP non accordé**
```json
{
  "candidateId": "candidate-no-consent",
  "projectId": "project-456",
  "mode": "balanced"
}
```

**Erreur attendue**:
```json
{
  "error": "ERROR_CONSENT_REQUIRED: Candidate has not granted MCP consent"
}
```

**Test 4.3: Accès projet refusé**
```json
{
  "candidateId": "candidate-123",
  "projectId": "unauthorized-project",
  "mode": "balanced"
}
```

**Erreur attendue**:
```json
{
  "error": "ACCESS_DENIED: You do not have access to this project"
}
```

---

## 🔧 Tests Avancés

### Test Cache

**Objectif**: Vérifier que le cache fonctionne

**Étapes**:
1. Exécuter `analyze_cv` avec mêmes paramètres 2 fois
2. Comparer `from_cache` et `duration_ms`

**Résultat attendu**:
- 1ère exécution: `from_cache: false`, `duration_ms: 12000`
- 2ème exécution: `from_cache: true`, `duration_ms: 50`

### Test Modes d'Analyse

**Objectif**: Comparer eco/balanced/premium

**Paramètres**:
```json
// Mode eco
{ "candidateId": "...", "projectId": "...", "mode": "eco" }

// Mode balanced
{ "candidateId": "...", "projectId": "...", "mode": "balanced" }

// Mode premium
{ "candidateId": "...", "projectId": "...", "mode": "premium" }
```

**Résultat attendu**:
- Eco: 1 provider, coût ~$0.02, durée ~5s
- Balanced: 2-3 providers, coût ~$0.04, durée ~10s
- Premium: 3 providers + arbiter, coût ~$0.06, durée ~15s

### Test Logs Serveur

**Objectif**: Vérifier les logs détaillés

**Dans MCP Inspector**:
1. Panneau "Server Logs" (droite)
2. Exécuter un tool
3. Observer les logs en temps réel

**Logs attendus**:
```
📞 Tool call: analyze_cv
   Args: {"candidateId":"...","projectId":"..."}

✅ Auth: mcp_api_key:user-123

🔒 Checking RGPD compliance...
✅ RGPD: Consent=true, Masking=partial

📄 Fetching candidate and project data...
✅ Candidate: John Doe
✅ Project: Senior Developer

🎬 Starting analysis orchestration...
...
✅ Analysis completed
```

---

## 🐛 Troubleshooting

### Erreur: "Connection refused"

**Symptôme**:
```
Error: Connection to server failed
```

**Solution**:
1. Vérifier que le serveur démarre sans erreur
2. Vérifier les env vars (SUPABASE_URL, etc.)
3. Relancer MCP Inspector

### Erreur: "Tool not found"

**Symptôme**:
```
Unknown tool: analyze_cv
```

**Solution**:
1. Rafraîchir la page du navigateur
2. Vérifier que le serveur a bien démarré
3. Vérifier les logs serveur

### Erreur: "AUTH_REQUIRED"

**Symptôme**:
```
AUTH_REQUIRED: Missing Authorization header
```

**Solution**:
Configurer l'env var `MCP_AUTH_HEADER` dans `bin/test-mcp-server.ts`:
```typescript
process.env.MCP_AUTH_HEADER = 'ApiKey mcp_sk_test123456789';
```

### Performance: Serveur lent

**Symptôme**: Réponses > 30s

**Causes possibles**:
1. Providers IA timeout (vérifier API keys)
2. DB Supabase lente (vérifier connexion)
3. Cache désactivé

**Solution**:
1. Vérifier logs serveur pour identifier le goulot
2. Utiliser mode "eco" pour tests rapides
3. Activer cache (défaut: activé)

---

## 📊 Métriques à Surveiller

### Performance

| Métrique | Eco | Balanced | Premium |
|----------|-----|----------|---------|
| **Durée** | 3-5s | 8-12s | 15-20s |
| **Coût** | $0.01-0.02 | $0.03-0.05 | $0.05-0.08 |
| **Providers** | 1 | 2-3 | 3 + arbiter |

### Cache

| Métrique | Valeur attendue |
|----------|-----------------|
| **Hit rate** | > 70% (après warmup) |
| **Durée cache hit** | < 100ms |
| **TTL** | 1 heure |

### Erreurs

| Type | Taux acceptable |
|------|-----------------|
| **AUTH_REQUIRED** | 0% (config correcte) |
| **CANDIDATE_NOT_FOUND** | Variable (dépend requêtes) |
| **DATABASE_ERROR** | < 1% |
| **TIMEOUT** | < 5% |

---

## 🎯 Checklist Tests

Avant de déclarer le serveur MCP prêt pour production:

- [ ] ✅ Tool `get_candidates` fonctionne
- [ ] ✅ Tool `analyze_cv` fonctionne
- [ ] ✅ Auth middleware valide tokens
- [ ] ✅ Erreurs gérées correctement
- [ ] ✅ Cache hit/miss fonctionne
- [ ] ✅ Modes eco/balanced/premium donnent résultats différents
- [ ] ✅ Logs serveur détaillés et utiles
- [ ] ✅ Context snapshot inclus dans résultats
- [ ] ✅ RGPD consent vérifié
- [ ] ✅ Performance acceptable (< 20s mode premium)

---

## 🚀 Commandes Utiles

```bash
# Lancer MCP Inspector
npx @modelcontextprotocol/inspector npx tsx bin/test-mcp-server.ts

# Lancer avec vraies env vars
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=xxx \
npx @modelcontextprotocol/inspector npm run mcp:server

# Tester avec curl (avancé)
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | npm run mcp:server

# Logs uniquement
npm run mcp:server 2>&1 | tee mcp-server.log
```

---

## 📚 Ressources

- **MCP Inspector Docs**: https://github.com/modelcontextprotocol/inspector
- **MCP Spec**: https://modelcontextprotocol.io
- **Corematch MCP Guide**: `MCP_SERVER_GUIDE.md`
- **Test Results**: `MCP_SERVER_TEST_RESULTS.md`

---

**Auteur**: Claude Code
**Date**: 2025-01-26
**Version**: 1.0.0
