# 🚨 Security Fixes - URGENT

**Date**: 2025-10-27
**Status**: ❌ CRITIQUE - Action Immédiate Requise

---

## 🔴 Problèmes Critiques Identifiés

### 1. **Secrets en Clair dans le Code** - CRITIQUE 🔴
**Fichiers concernés** :
- `start-mcp-server.bat` - Contient service-role key, MCP API key
- `MCP_SERVER_READY.md` - Documente les secrets
- `GUIDE_INTEGRATION_CLAUDE_DESKTOP.md` - Affiche les secrets

**Risque** :
- ✅ Service-role key = **accès TOTAL à la base de données** (bypass RLS)
- ✅ MCP API key compromise = accès non autorisé au serveur
- ✅ Ces secrets sont dans le repo Git = **considérés comme compromis**

**Impact** :
- Attaquant peut lire/modifier/supprimer TOUTES les données
- Attaquant peut créer/supprimer des projets, candidats
- Attaquant peut bypasser tous les contrôles d'accès

---

### 2. **Bypass test-user en Production** - CRITIQUE 🔴
**Fichier** : `lib/mcp/server/middleware/auth-middleware.ts:36`

```typescript
// DANGER: Bypass actif en production!
if (apiKey.startsWith('mcp_sk_test')) {
  return {
    id: 'test-user-123',
    type: 'api_key',
    scopes: ['cv:read', 'cv:analyze'],
    org_id: undefined,
    project_id: undefined,
  };
}
```

**Risque** :
- N'importe qui avec `mcp_sk_test` a un accès complet
- Aucune vérification d'organisation ou projet
- Service-role client = privilèges totaux

---

### 3. **Usage de service-role Partout** - ÉLEVÉ 🟠
**Fichiers** :
- `lib/mcp/server/tools/analyze-cv.ts:116`
- `lib/mcp/server/tools/get-candidates.ts:82`

**Risque** :
- Tous les tools utilisent `supabaseAdmin` (service-role)
- Aucune limite basée sur l'organisation/projet
- Escalation de privilèges facile

---

### 4. **Logs Exposent PII** - ÉLEVÉ 🟠
**Fichiers** :
- `lib/mcp/server/tools/analyze-cv.ts:161`
- `lib/mcp/server/tools/get-candidates.ts:61`

```typescript
console.error(`✅ Candidate: ${candidate.first_name} ${candidate.last_name}`);
```

**Risque** :
- Claude Desktop affiche les logs MCP
- Noms, emails exposés dans l'historique de chat
- Violation RGPD potentielle

---

### 5. **Tool Responses Contiennent PII** - ÉLEVÉ 🟠
**Fichiers** :
- `get_candidates` retourne `name` + `email`
- `analyze_cv` retourne recommandations non masquées

**Risque** :
- Claude reçoit des données personnelles non nécessaires
- Violation du principe de minimisation (RGPD)
- Stockage potentiel dans les logs d'Anthropic

---

### 6. **CVs Téléchargeables Sans Protection** - MOYEN 🟡
**Fichier** : `lib/mcp/server/utils/cv-parser.ts:17`

```typescript
const response = await fetch(cvUrl);
```

**Risque** :
- Si `cv_url` n'est pas signé → n'importe qui peut télécharger
- Besoin de URLs signées avec expiration

---

## 🛠️ Plan de Correction - Priorité 1 (IMMÉDIAT)

### Fix 1.1 : Rotation des Secrets (NOW)

**Actions** :
1. **Générer une nouvelle Service Role Key** :
   ```
   1. Aller sur https://supabase.com/dashboard/project/[PROJECT]/settings/api
   2. Section "Service Role Key"
   3. Cliquer "Regenerate"
   4. Copier la nouvelle clé
   ```

2. **Générer une nouvelle MCP API Key** :
   ```bash
   npx tsx scripts/generate-api-key.ts
   # Copier la nouvelle clé générée
   ```

3. **Supprimer les anciennes clés du repo** :
   ```bash
   # Ajouter au .gitignore
   echo "start-mcp-server.bat" >> .gitignore
   echo ".env.mcp" >> .gitignore

   # Supprimer de l'historique Git (si déjà commité)
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch start-mcp-server.bat" \
     --prune-empty --tag-name-filter cat -- --all
   ```

### Fix 1.2 : Charger Secrets depuis Variables d'Environnement

**Créer** : `.env.mcp` (NON versionné)
```env
SUPABASE_URL=https://glexllbywdvlxpbanjmn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=[NOUVELLE_CLE_GENEREE]
MCP_API_KEY=[NOUVELLE_CLE_GENEREE]
MCP_MOCK_MODE=true
OPENAI_API_KEY=[VOTRE_CLE]
GEMINI_API_KEY=[VOTRE_CLE]
```

**Modifier** : `start-mcp-server.bat`
```batch
@echo off
cd /d F:\corematch

REM Charger les variables depuis .env.mcp
for /f "tokens=1,2 delims==" %%a in (.env.mcp) do set %%a=%%b

REM Lancer le serveur
"C:\Program Files\nodejs\npx.cmd" tsx bin/mcp-server.ts
```

**OU utiliser dotenv directement** :
```batch
@echo off
cd /d F:\corematch
"C:\Program Files\nodejs\npx.cmd" dotenv -e .env.mcp tsx bin/mcp-server.ts
```

### Fix 1.3 : Nettoyer la Documentation

**Supprimer tous les secrets de** :
- `MCP_SERVER_READY.md`
- `GUIDE_INTEGRATION_CLAUDE_DESKTOP.md`
- `MCP_INTEGRATION_SUCCESS.md`

Remplacer par :
```markdown
## Configuration

1. Copier `.env.mcp.example` vers `.env.mcp`
2. Remplir avec vos propres clés
3. NE JAMAIS commit `.env.mcp`
```

---

## 🛠️ Fix 2 : Supprimer le Bypass test-user (IMMÉDIAT)

**Fichier** : `lib/mcp/server/middleware/auth-middleware.ts`

```typescript
// AVANT (DANGEREUX):
if (apiKey.startsWith('mcp_sk_test')) {
  return { id: 'test-user-123', ... };
}

// APRÈS (SÉCURISÉ):
if (apiKey.startsWith('mcp_sk_test')) {
  // Bypass UNIQUEMENT en développement
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('AUTH_FAILED: Test keys not allowed in production');
  }
  return { id: 'test-user-123', ... };
}
```

**OU mieux - Supprimer complètement** :
```typescript
// Supprimer le bloc test-user entièrement
// Créer de vraies API keys pour les tests
```

---

## 🛠️ Fix 3 : Client Supabase Restreint (PRIORITÉ 2)

### Option A : RLS + anon key (Recommandé)

**Créer** : `lib/supabase/mcp-client.ts`
```typescript
import { createClient } from '@supabase/supabase-js';

// Client avec anon key (respecte RLS)
export const supabaseMCP = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // Pas service-role!
);
```

**Modifier les tools pour utiliser** `supabaseMCP` + RLS policies :
```typescript
// Dans get-candidates.ts
import { supabaseMCP } from '../../../supabase/mcp-client';

// Authentifier avec le userId de l'API key
const { data, error } = await supabaseMCP
  .from('candidates')
  .select('*')
  .eq('project_id', args.projectId)
  // RLS vérifie automatiquement l'accès via userId
```

**Avantage** :
- Respecte les RLS policies existantes
- Pas de privilèges excessifs
- Audit trail correct

### Option B : Service-role avec filtre manuel

Si RLS compliqué, au minimum :
```typescript
// Vérifier l'accès AVANT toute requête
const hasAccess = await verifyMCPProjectAccess(authUser, args.projectId);
if (!hasAccess) {
  throw new Error('ACCESS_DENIED');
}

// Puis requête avec service-role MAIS limitée
const { data } = await supabaseAdmin
  .from('candidates')
  .select('*')
  .eq('project_id', args.projectId) // Limiter au projet autorisé
  .eq('org_id', authUser.org_id); // Limiter à l'org
```

---

## 🛠️ Fix 4 : Supprimer PII des Logs (IMMÉDIAT)

**Fichier** : `lib/mcp/server/tools/analyze-cv.ts`

```typescript
// AVANT:
console.error(`✅ Candidate: ${candidate.first_name} ${candidate.last_name}`);

// APRÈS:
console.error(`✅ Candidate: ${candidate.id} (PII redacted)`);
```

**Fichier** : `lib/mcp/server/tools/get-candidates.ts`

```typescript
// AVANT:
console.error(`✅ Found ${candidates.length} candidates`);
candidates.forEach(c => {
  console.error(`   - ${c.first_name} ${c.last_name} (${c.email})`);
});

// APRÈS:
console.error(`✅ Found ${candidates.length} candidates`);
console.error(`   (PII logging disabled for privacy)`);
```

---

## 🛠️ Fix 5 : Masquer PII dans les Réponses (PRIORITÉ 2)

### Option A : Ne Retourner Que les IDs

**get_candidates** :
```typescript
return {
  id: candidate.id,
  // NE PAS retourner name ou email
  status: candidate.status,
  score: candidate.score,
  recommendation: candidate.recommendation,
  analyzed_at: candidate.analyzed_at,
};
```

Claude peut ensuite demander plus de détails si nécessaire :
> "Quels sont les détails du candidat candidate-123 ?"

### Option B : Masquage Partiel

```typescript
import { maskPII } from '../../security/pii-masking';

return {
  id: candidate.id,
  name: maskPII(candidate.first_name, 'partial'), // "M****"
  email: maskPII(candidate.email, 'partial'),    // "m***@example.com"
  status: candidate.status,
  score: candidate.score,
};
```

---

## 🛠️ Fix 6 : URLs Signées pour CVs (PRIORITÉ 3)

**Fichier** : `lib/mcp/server/utils/cv-parser.ts`

```typescript
async function getSignedCVUrl(cvUrl: string): Promise<string> {
  // Si c'est une URL Supabase Storage
  if (cvUrl.includes('supabase.co/storage')) {
    const path = extractStoragePath(cvUrl);

    // Créer une URL signée avec expiration 60s
    const { data, error } = await supabaseAdmin.storage
      .from('cvs')
      .createSignedUrl(path, 60); // 60 secondes

    if (error) throw error;
    return data.signedUrl;
  }

  // URL externe - vérifier qu'elle est autorisée
  return cvUrl;
}

export async function parseCVFromURL(cvUrl: string): Promise<string> {
  const signedUrl = await getSignedCVUrl(cvUrl);
  const response = await fetch(signedUrl);
  // ...
}
```

---

## ✅ Checklist de Sécurisation

### Immédiat (Aujourd'hui)
- [ ] Régénérer Service Role Key
- [ ] Régénérer MCP API Key
- [ ] Créer `.env.mcp` avec nouvelles clés
- [ ] Modifier `start-mcp-server.bat` pour charger `.env.mcp`
- [ ] Ajouter `.env.mcp` au `.gitignore`
- [ ] Supprimer secrets de la documentation
- [ ] Supprimer ou protéger bypass test-user
- [ ] Redémarrer serveur MCP avec nouvelles clés

### Cette Semaine
- [ ] Implémenter Fix 4 (supprimer PII des logs)
- [ ] Implémenter Fix 5 (masquer PII dans réponses)
- [ ] Créer `.env.mcp.example` (template sans secrets)
- [ ] Tester que tout fonctionne

### Semaine Prochaine
- [ ] Implémenter Fix 3 (client Supabase restreint)
- [ ] Implémenter Fix 6 (URLs signées pour CVs)
- [ ] Audit de sécurité complet
- [ ] Documentation sécurité mise à jour

---

## 📝 Template .env.mcp.example

Créer ce fichier (PEUT être commité) :
```env
# Supabase Configuration
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY_HERE

# MCP Configuration
MCP_API_KEY=YOUR_MCP_API_KEY_HERE
MCP_MOCK_MODE=true

# AI Provider Keys
OPENAI_API_KEY=YOUR_OPENAI_KEY_HERE
GEMINI_API_KEY=YOUR_GEMINI_KEY_HERE

# Environment
NODE_ENV=production
```

---

## 🚨 Actions Immédiates - Ordre de Priorité

1. **STOP** : Ne plus partager/commiter les fichiers avec secrets
2. **ROTATE** : Régénérer toutes les clés compromise
3. **ISOLATE** : Déplacer secrets dans `.env.mcp` (non versionné)
4. **CLEAN** : Supprimer secrets de la doc et Git history
5. **PROTECT** : Supprimer bypass test-user
6. **REDACT** : Masquer PII dans logs et réponses
7. **RESTRICT** : Limiter les privilèges (RLS ou filtres manuels)
8. **SECURE** : URLs signées pour CVs

---

## 📞 Aide pour Appliquer les Fixes

Voulez-vous que je :
1. ✅ **Crée tous les fichiers de fix** (`.env.mcp.example`, scripts, etc.) ?
2. ✅ **Applique les modifications de code** pour supprimer PII ?
3. ✅ **Guide étape par étape** pour la rotation des secrets ?
4. ✅ **Crée un script d'audit** pour vérifier que tout est sécurisé ?

**IMPORTANT** : Ces fixes doivent être appliqués **AVANT** d'utiliser le serveur MCP en production avec de vraies données !

---

**Fait avec ❤️ et 🔒 Sécurité en Tête**
**2025-10-27**
