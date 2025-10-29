# 🚨 APPLIQUER LES FIXES DE SÉCURITÉ - MAINTENANT

**Date**: 2025-10-27
**Status**: ❌ SERVEUR ACTUELLEMENT VULNÉRABLE

---

## ⚠️ SITUATION ACTUELLE

Le serveur MCP fonctionne MAIS :
- ❌ Secrets en clair dans `start-mcp-server.bat`
- ❌ `MCP_MOCK_MODE=true` bypass toute sécurité
- ❌ `supabaseAdmin` (service-role) utilisé partout
- ❌ PII dans logs et réponses
- ❌ CVs potentiellement non protégés

**AUCUNE donnée réelle ne devrait passer par ce serveur avant correction !**

---

## ✅ PLAN D'ACTION - 30 MINUTES

### Étape 1 : Arrêter le Serveur (NOW)

Dans Claude Desktop :
1. Settings → Extensions → Developer → Local MCP servers
2. Trouver "corematch"
3. Cliquer "Stop" ou fermer Claude Desktop

### Étape 2 : Créer .env.mcp avec Nouvelles Clés (10 min)

```cmd
cd F:\corematch
copy .env.mcp.example .env.mcp
```

Puis éditer `.env.mcp` et remplir avec de **NOUVELLES** clés :

1. **Régénérer Supabase Service Role Key** :
   - https://supabase.com/dashboard/project/glexllbywdvlxpbanjmn/settings/api
   - Copier la nouvelle clé dans `.env.mcp`

2. **Régénérer MCP API Key** :
   ```cmd
   npx tsx scripts/generate-api-key.ts
   ```
   - Copier la clé générée dans `.env.mcp`

3. **Vérifier les autres clés** (OpenAI, Gemini)

### Étape 3 : Mettre à Jour .gitignore (1 min)

```cmd
echo .env.mcp >> .gitignore
echo start-mcp-server.bat >> .gitignore
```

### Étape 4 : Remplacer le Script de Démarrage (1 min)

```cmd
# Renommer l'ancien (pour backup)
ren start-mcp-server.bat start-mcp-server.bat.OLD

# Utiliser le nouveau
ren start-mcp-server-secure.bat start-mcp-server.bat
```

### Étape 5 : Désactiver MOCK Mode (1 min)

Éditer `.env.mcp` :
```env
MCP_MOCK_MODE=false
```

### Étape 6 : Protéger le Bypass test-user (DÉJÀ FAIT ✅)

Le fix a été appliqué dans `lib/mcp/server/middleware/auth-middleware.ts` :
- Test keys bloquées si `NODE_ENV=production`

### Étape 7 : Masquer PII dans Logs (5 min)

Je vais créer un script pour appliquer automatiquement.

### Étape 8 : Mettre à Jour Claude Desktop Config (2 min)

Le fichier devrait déjà pointer vers `start-mcp-server.bat` - vérifie juste.

### Étape 9 : Redémarrer et Tester (5 min)

1. Relancer Claude Desktop
2. Vérifier que le serveur démarre (status = running)
3. Tester avec un projet qui a `job_spec_config`

### Étape 10 : Nettoyer le Repo (5 min)

```cmd
# Supprimer les secrets de la documentation
# (je vais créer un script pour ça)
```

---

## 🔧 Scripts Automatiques

Je vais créer :
1. `apply-security-fixes.bat` - Applique tous les fixes automatiquement
2. `clean-pii-logs.ts` - Supprime PII des logs
3. `audit-security.ts` - Vérifie que tout est sécurisé

---

## ⚡ COMMANDE RAPIDE

Si vous voulez tout faire d'un coup :

```cmd
cd F:\corematch

# 1. Créer .env.mcp
copy .env.mcp.example .env.mcp
# PUIS éditer .env.mcp manuellement

# 2. Protéger
echo .env.mcp >> .gitignore
echo start-mcp-server.bat >> .gitignore

# 3. Utiliser le script sécurisé
ren start-mcp-server.bat start-mcp-server.bat.OLD
ren start-mcp-server-secure.bat start-mcp-server.bat

# 4. Mettre à jour Claude Desktop config (déjà bon normalement)

# 5. Redémarrer Claude Desktop
```

---

## 📋 Checklist de Vérification

Avant de considérer le serveur sécurisé :

- [ ] `.env.mcp` créé avec NOUVELLES clés
- [ ] `.env.mcp` dans .gitignore
- [ ] `start-mcp-server.bat` ne contient PLUS de secrets
- [ ] `MCP_MOCK_MODE=false` (ou retiré complètement)
- [ ] `NODE_ENV=production` dans `.env.mcp`
- [ ] Bypass test-user bloqué en production
- [ ] PII supprimé des logs
- [ ] PII masqué dans les réponses
- [ ] Documentation nettoyée (pas de secrets)
- [ ] Ancien `start-mcp-server.bat` sauvegardé puis supprimé du Git
- [ ] Test avec données réelles réussi

---

## 🚨 CE QUI RESTE À FAIRE (PRIORITÉ 2)

Ces fixes sont **moins urgents** mais doivent être faits avant production réelle :

### 1. Client Supabase Restreint

Remplacer `supabaseAdmin` par un client avec RLS :

```typescript
// lib/supabase/mcp-client.ts
import { createClient } from '@supabase/supabase-js';

export const supabaseMCP = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // PAS service-role!
);
```

### 2. URLs Signées pour CVs

```typescript
async function getSignedCVUrl(cvUrl: string): Promise<string> {
  if (cvUrl.includes('supabase.co/storage')) {
    const path = extractStoragePath(cvUrl);
    const { data } = await supabaseAdmin.storage
      .from('cvs')
      .createSignedUrl(path, 60); // 60 secondes
    return data.signedUrl;
  }
  return cvUrl;
}
```

### 3. Masquage PII dans Réponses

Actuellement `get_candidates` retourne :
```typescript
{
  name: "Jean Dupont",      // ❌ PII exposé
  email: "jean@example.com" // ❌ PII exposé
}
```

Devrait retourner :
```typescript
{
  id: "candidate-123",      // ✅ OK
  initials: "J.D.",         // ✅ Masqué
  status: "analyzed",       // ✅ OK
  score: 85                 // ✅ OK
}
```

---

## 💡 VOULEZ-VOUS QUE JE :

1. ✅ **Crée un script automatique** qui applique tous les fixes ?
2. ✅ **Applique les modifications de code** pour masquer PII partout ?
3. ✅ **Crée un audit de sécurité** pour vérifier que tout est OK ?
4. ✅ **Nettoie toute la documentation** pour retirer les secrets ?

Dites-moi et je le fais immédiatement ! 🚀
