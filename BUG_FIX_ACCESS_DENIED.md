# 🐛 BUG FIX: ACCESS_DENIED Error

## Statut
✅ **RÉSOLU** - 2025-10-27

## Symptômes

Erreur lors de l'utilisation de MCP Inspector avec le tool `get_candidates` :
```
MCP error -32600: ACCESS_DENIED: You do not have access to this project
```

## Cause Racine

**Erreur SQL dans `lib/auth/mcp-auth.ts:315`**

Le code tentait de sélectionner une colonne `id` qui **n'existe pas** dans la table `organization_members` :

```typescript
// ❌ CODE BUGUÉ
const { data: membership } = await supabaseAdmin
  .from('organization_members')
  .select('id')  // ← Cette colonne n'existe pas !
  .eq('org_id', project.org_id)
  .eq('user_id', authUser.id)
  .maybeSingle();
```

### Pourquoi ça causait ACCESS_DENIED ?

1. La requête SQL retournait une **erreur silencieuse** :
   ```
   code: '42703'
   message: 'column organization_members.id does not exist'
   ```

2. Le code vérifiait `if (membershipError)` et retournait `false`

3. L'accès était refusé même si le membership existait réellement !

### Structure réelle de la table

La table `organization_members` utilise une **clé composite** :

| Colonne | Type | Clé |
|---------|------|-----|
| org_id | uuid | PK (composite) |
| user_id | uuid | PK (composite) |
| role | text | |
| invited_email | text | |
| created_at | timestamp | |

**Pas de colonne `id` auto-incrémentée !**

## Solution

**Changement dans `lib/auth/mcp-auth.ts:315`** :

```typescript
// ✅ CODE CORRIGÉ
const { data: membership } = await supabaseAdmin
  .from('organization_members')
  .select('user_id, role')  // ← Colonnes qui existent
  .eq('org_id', project.org_id)
  .eq('user_id', authUser.id)
  .maybeSingle();
```

Alternative : utiliser `select('*')` fonctionne aussi.

## Vérification

### Script de test créé

**Fichier** : `scripts/test-mcp-access.ts`

Ce script simule exactement le flux d'authentification et teste :
1. Validation de l'API key
2. Récupération du projet
3. Vérification du membership organisation
4. Appel de `verifyMCPProjectAccess()`

### Résultat avant fix

```
❌ ACCESS DENIED
[verifyMCPProjectAccess] Membership check error: {
  code: '42703',
  message: 'column organization_members.id does not exist'
}
```

### Résultat après fix

```
✅ ACCESS GRANTED
[verifyMCPProjectAccess] Case 2 (org): membership=true
```

## Impact

Ce bug **bloquait complètement** l'utilisation du serveur MCP avec :
- Projets basés sur les organisations (nouvelle architecture)
- API keys sans restriction d'org_id/project_id

Le bug n'affectait PAS :
- Projets avec `created_by` défini (ancienne architecture)
- API keys avec `org_id` ou `project_id` spécifique

## Leçons Apprises

### 1. Toujours vérifier la structure des tables
Avant de faire un `.select()`, vérifier les colonnes disponibles dans la DB.

### 2. Améliorer les logs d'erreur DB
Le code loggait l'erreur mais continuait silencieusement :
```typescript
if (membershipError) {
  console.error('[verifyMCPProjectAccess] Membership check error:', membershipError);
  return false; // ← On retourne false sans plus d'info au client
}
```

### 3. Tests end-to-end nécessaires
Ce bug n'aurait pas été détecté en dev car :
- Mode MOCK utilisé (pas de vraie DB)
- Pas de tests e2e sur l'auth organisation

## Fichiers Modifiés

### `lib/auth/mcp-auth.ts`
```diff
- .select('id')
+ .select('user_id, role')
```

### Nouveaux fichiers créés

1. **`scripts/test-mcp-access.ts`** - Script de test de bout en bout
2. **`BUG_FIX_ACCESS_DENIED.md`** - Cette documentation

## Prochaines Étapes

Maintenant que l'accès fonctionne :

1. ✅ Tester `get_candidates` dans MCP Inspector
2. ⏳ Tester `analyze_cv` dans MCP Inspector
3. ⏳ Intégrer avec Claude Desktop
4. ⏳ Tests e2e en conditions réelles

## Commande pour Tester

```bash
# Test unitaire de l'accès
npx dotenv-cli -e .env.production -- npx tsx scripts/test-mcp-access.ts

# Lancer MCP Inspector
.\start-mcp-inspector.bat

# Tester get_candidates
{
  "projectId": "7ee1d2d9-0896-4a26-9109-a276385a3bc6",
  "limit": 10
}
```

---

**Status Final** : ✅ Bug corrigé et vérifié - Prêt pour tests MCP Inspector
