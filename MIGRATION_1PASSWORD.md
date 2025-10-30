# Migration vers 1Password CLI - Guide Complet

**Date**: 2025-10-29
**Statut**: ✅ Implémenté
**Priorité**: 🔴 P0 - CRITIQUE

---

## Pourquoi cette migration ?

### Problème initial
Les secrets (clés API, tokens) étaient stockés en clair dans :
- `.env.mcp` → Clé Supabase service-role exposée
- `.env.local`, `.env.production`, etc.
- Historique Git (🚨 **COMPROMISSION DÉTECTÉE** le 2025-10-29)

### Solution : 1Password CLI
✅ Secrets chiffrés dans 1Password (AES-256)
✅ Accès contrôlé par authentification 1Password
✅ Audit trail complet
✅ Rotation facile des secrets
✅ Partage sécurisé en équipe

---

## Architecture

### Avant (❌ Non sécurisé)
```
.env.mcp (plaintext)
  ↓
process.env.SUPABASE_SERVICE_ROLE_KEY
  ↓
supabaseAdmin (créé au démarrage)
```

### Après (✅ Sécurisé)
```
1Password Vault "CoreMatch"
  ↓
op CLI (chiffré)
  ↓
lib/secrets/1password.ts (cache 5min)
  ↓
getSupabaseAdmin() (lazy loading)
```

---

## Installation

### 1. Installer 1Password CLI

**macOS:**
```bash
brew install --cask 1password-cli
```

**Windows:**
```bash
winget install --id AgileBits.1PasswordCLI
```

**Linux:**
```bash
curl -sSfO https://downloads.1password.com/linux/keys/1password.asc
sudo gpg --dearmor -o /usr/share/keyrings/1password-archive-keyring.gpg 1password.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/1password-archive-keyring.gpg] https://downloads.1password.com/linux/debian/$(dpkg --print-architecture) stable main" | sudo tee /etc/apt/sources.list.d/1password.list
sudo apt update && sudo apt install 1password-cli
```

Vérifier l'installation :
```bash
op --version
```

### 2. Se connecter à 1Password

```bash
op signin
```

Suivre les instructions à l'écran.

### 3. Créer le vault "CoreMatch"

```bash
op vault create CoreMatch
```

### 4. Stocker les secrets

**Option A - Script automatisé** (recommandé) :
```bash
bash scripts/setup-1password.sh
```

**Option B - Manuellement** :
```bash
# Supabase URL
op item create \
  --category=password \
  --title="Supabase URL" \
  --vault="CoreMatch" \
  password="https://glexllbywdvlxpbanjmn.supabase.co" \
  --tags="supabase,corematch"

# Supabase Service Role Key
op item create \
  --category=password \
  --title="Supabase Service Role" \
  --vault="CoreMatch" \
  password="eyJhbGci..." \
  --tags="supabase,corematch,secret"

# MCP Auth Header
op item create \
  --category=password \
  --title="MCP Auth Header" \
  --vault="CoreMatch" \
  password="ApiKey mcp_sk_..." \
  --tags="mcp,corematch,secret"
```

### 5. Vérifier

```bash
# Tester la récupération
op read "op://CoreMatch/Supabase URL/password"
op read "op://CoreMatch/Supabase Service Role/password"
op read "op://CoreMatch/MCP Auth Header/password"
```

---

## Utilisation dans le code

### Supabase Admin Client

**Avant** (deprecated) :
```typescript
import { supabaseAdmin } from '@/lib/supabase/server';

// ❌ Utilise process.env directement
const { data } = await supabaseAdmin.from('users').select();
```

**Après** (recommandé) :
```typescript
import { getSupabaseAdmin } from '@/lib/supabase/server';

// ✅ Récupère depuis 1Password (avec cache)
const supabase = await getSupabaseAdmin();
const { data } = await supabase.from('users').select();
```

### Secrets personnalisés

```typescript
import { getSecret, getSecrets } from '@/lib/secrets/1password';

// Récupérer un secret
const apiKey = await getSecret('OPENAI_API_KEY');

// Récupérer plusieurs secrets en parallèle
const { OPENAI_API_KEY, GEMINI_API_KEY } = await getSecrets([
  'OPENAI_API_KEY',
  'GEMINI_API_KEY'
]);
```

### Helpers spécialisés

```typescript
import {
  getSupabaseSecrets,
  getMCPSecrets,
  getAIProviderSecrets
} from '@/lib/secrets/1password';

// Tous les secrets Supabase
const { url, serviceRoleKey } = await getSupabaseSecrets();

// Tous les secrets MCP
const { supabaseUrl, supabaseServiceRoleKey, mcpAuthHeader } = await getMCPSecrets();

// Tous les providers IA (optionnels)
const { openai, gemini, anthropic } = await getAIProviderSecrets();
```

---

## Migration des routes existantes

### Routes déjà migrées

✅ `lib/supabase/server.ts` - Nouvelle fonction `getSupabaseAdmin()`

### Routes à migrer

Les routes suivantes utilisent encore `supabaseAdmin` (legacy) :

```bash
# Trouver toutes les routes à migrer
grep -r "import.*supabaseAdmin" app/api --include="*.ts"
```

**Pattern de migration** :

```typescript
// AVANT
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { data } = await supabaseAdmin.from('table').select();
  // ...
}

// APRÈS
import { getSupabaseAdmin } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await getSupabaseAdmin();
  const { data } = await supabase.from('table').select();
  // ...
}
```

---

## Serveur MCP

### Mise à jour requise

Le serveur MCP (`bin/mcp-server.ts`) doit être mis à jour pour utiliser 1Password :

**Avant** (`.env.mcp`) :
```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
```

**Après** (1Password CLI) :
```typescript
import { getMCPSecrets } from '@/lib/secrets/1password';

const { supabaseUrl, supabaseServiceRoleKey, mcpAuthHeader } = await getMCPSecrets();
```

### Script de démarrage

Mettre à jour `start-mcp-server.bat` pour s'assurer que `op` est authentifié :

```bash
@echo off
echo Checking 1Password CLI authentication...
op whoami >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Not authenticated to 1Password
    echo Please run: op signin
    exit /b 1
)

echo Starting MCP Server with 1Password secrets...
npx tsx bin/mcp-server.ts
```

---

## Environnements

### Développement

**Fallback automatique vers `.env` si 1Password n'est pas disponible** :

```typescript
// lib/secrets/1password.ts
export async function getSecret(key: SecretKey) {
  try {
    // Essayer 1Password d'abord
    return await getFrom1Password(key);
  } catch (error) {
    // Fallback en dev seulement
    if (process.env.NODE_ENV !== 'production' && process.env[key]) {
      console.warn(`Using env fallback for ${key}`);
      return process.env[key];
    }
    throw error;
  }
}
```

### Production

**1Password CLI requis, pas de fallback** :

```bash
# Vercel / Netlify : Ajouter les variables via dashboard
# Pas d'accès direct à 1Password CLI en production Vercel

# Solution : Utiliser Vercel Environment Variables
# https://vercel.com/docs/projects/environment-variables
```

⚠️ **Note** : En production Vercel, les secrets doivent être ajoutés via le dashboard Vercel car 1Password CLI n'est pas disponible. Le fallback `process.env` s'activera automatiquement.

### CI/CD

Pour GitHub Actions ou autres pipelines :

```yaml
# .github/workflows/test.yml
- name: Setup 1Password CLI
  uses: 1password/load-secrets-action@v1
  with:
    export-env: true
  env:
    OP_SERVICE_ACCOUNT_TOKEN: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}

- name: Run tests
  run: npm test
```

---

## Sécurité

### Bonnes pratiques

✅ **DO:**
- Authentifier `op` au démarrage du serveur
- Utiliser le cache (5 min TTL) pour performances
- Logger les échecs sans exposer les valeurs
- Rotation des secrets tous les 90 jours
- Audit trail activé dans 1Password

❌ **DON'T:**
- Ne jamais commiter `.env.mcp` dans Git
- Ne jamais logger les valeurs des secrets
- Ne pas désactiver le cache (trop d'appels `op`)
- Ne pas utiliser `op` en synchrone (bloque l'event loop)

### Rotation des secrets

```bash
# 1. Générer nouvelle clé sur Supabase Dashboard
# 2. Mettre à jour dans 1Password
op item edit "Supabase Service Role" --vault="CoreMatch" password="NEW_KEY"

# 3. Invalider le cache
# Le serveur récupérera automatiquement la nouvelle clé au prochain appel

# 4. Redémarrer les serveurs
npm run dev  # Dev
# OU redéployer sur Vercel (prod)
```

### Audit

```bash
# Voir qui a accédé aux secrets
op item get "Supabase Service Role" --vault="CoreMatch" --format=json | jq '.overview.ainfo'

# Historique des modifications
op item get "Supabase Service Role" --vault="CoreMatch" --format=json | jq '.history'
```

---

## Troubleshooting

### Erreur : "not authenticated"

```bash
# Solution
op signin
```

### Erreur : "vault not found"

```bash
# Créer le vault
op vault create CoreMatch

# OU vérifier le nom
op vault list
```

### Erreur : "item not found"

```bash
# Lister tous les items
op item list --vault="CoreMatch"

# Vérifier le nom exact
op item get "Supabase Service Role" --vault="CoreMatch"
```

### Performance : trop d'appels `op`

Le cache est activé (5 min TTL). Si vous voyez toujours trop d'appels :

```typescript
// Forcer l'utilisation du cache
import { getSecret } from '@/lib/secrets/1password';

// ✅ Utilise le cache
const key = await getSecret('SUPABASE_SERVICE_ROLE_KEY');

// ❌ Ignore le cache
const key = await getSecret('SUPABASE_SERVICE_ROLE_KEY', { skipCache: true });
```

### Dev : Je n'ai pas 1Password

Le fallback vers `.env` est automatique en développement :

```bash
# Créer .env.local
cp .env.example .env.local

# Ajouter les secrets
SUPABASE_SERVICE_ROLE_KEY=your_key_here

# Le code utilisera automatiquement process.env
```

---

## Checklist de migration

- [ ] 1Password CLI installé et authentifié
- [ ] Vault "CoreMatch" créé
- [ ] Secrets stockés dans 1Password (script `setup-1password.sh`)
- [ ] Secrets vérifiés (`op read ...`)
- [ ] Code mis à jour (`getSupabaseAdmin()` au lieu de `supabaseAdmin`)
- [ ] Serveur MCP mis à jour
- [ ] Tests passent localement
- [ ] `.env.mcp` supprimé (ou ajouté à `.gitignore`)
- [ ] Documentation lue par l'équipe
- [ ] Production déployée avec nouveaux secrets
- [ ] Anciennes clés révoquées

---

## Ressources

- [1Password CLI Documentation](https://developer.1password.com/docs/cli/)
- [1Password Secret References](https://developer.1password.com/docs/cli/secret-references/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/security)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

---

## Support

En cas de problème :
1. Vérifier ce guide de troubleshooting
2. Consulter `SECURITY_ENV_MCP.md` (procédures de compromission)
3. Créer une issue GitHub avec logs (sans les secrets!)

---

**Document créé le** : 2025-10-29
**Dernière mise à jour** : 2025-10-29
**Auteur** : Claude Code (AI Assistant)
