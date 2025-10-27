# 🔒 Sécurisation du Serveur MCP - Mode d'Emploi

**Date**: 2025-10-27
**Temps estimé**: 30 minutes
**Difficulté**: Facile (automatisé)

---

## 📋 Pré-requis

Avant de commencer, assurez-vous de avoir :

- [ ] Claude Desktop fermé complètement
- [ ] Accès Internet (pour générer les clés)
- [ ] Accès à votre dashboard Supabase
- [ ] Droits d'écriture dans `F:\corematch`
- [ ] Node.js installé

---

## 🚀 Méthode Rapide : Script Automatique

### Étape 1 : Lancer le Script

```cmd
cd F:\corematch
apply-security-fixes.bat
```

### Étape 2 : Suivre les Instructions

Le script va :

1. **Vérifier** l'environnement
2. **Sauvegarder** les fichiers actuels dans `backup_[DATE]`
3. **Générer** une nouvelle MCP API key
4. **Vous demander** de régénérer la Supabase Service Role Key
5. **Créer** `.env.mcp` depuis le template
6. **Ouvrir** `.env.mcp` pour que vous remplissiez les clés
7. **Remplacer** l'ancien script de démarrage
8. **Mettre à jour** `.gitignore`
9. **Vérifier** que tout est correct

### Étape 3 : Remplir .env.mcp

Quand Notepad s'ouvre avec `.env.mcp`, remplissez :

```env
NEXT_PUBLIC_SUPABASE_URL=https://glexllbywdvlxpbanjmn.supabase.co

# NOUVELLE clé de Supabase (régénérée sur le dashboard)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...

# NOUVELLE clé MCP (voir backup_*/new-mcp-key.txt)
MCP_AUTH_HEADER=ApiKey mcp_sk_...

# Mode MOCK ou production
MCP_MOCK_MODE=true

# Vos clés existantes
OPENAI_API_KEY=sk-proj-...
GEMINI_API_KEY=AIza...

NODE_ENV=production
```

### Étape 4 : Mettre à Jour Claude Desktop

Éditer : `%APPDATA%\Claude\claude_desktop_config.json`

Vérifier que ça ressemble à :
```json
{
  "mcpServers": {
    "corematch": {
      "command": "cmd.exe",
      "args": [
        "/c",
        "F:\\corematch\\start-mcp-server.bat"
      ]
    }
  }
}
```

### Étape 5 : Tester

1. **Relancer Claude Desktop**
2. **Settings** → **Extensions** → **Developer**
3. Vérifier status **"running"** pour corematch
4. Ouvrir une conversation et tester :
   > Quels outils MCP as-tu ?

---

## 🔍 Vérifier la Sécurité

### Audit Automatique

```cmd
npx tsx scripts/audit-security.ts
```

**Résultat attendu** :
```
✅ Passed:   8
⚠️  Warnings: 3
❌ Failed:   0

🎉 AUDIT PASSÉ - Serveur MCP sécurisé!
```

### Checklist Manuelle

- [ ] `.env.mcp` existe et contient vos clés
- [ ] `.env.mcp` est dans `.gitignore`
- [ ] `start-mcp-server.bat` ne contient PLUS de secrets
- [ ] Claude Desktop status = "running"
- [ ] Test tool fonctionne
- [ ] Aucun secret dans `git status`

---

## 📊 Que Faire si l'Audit Échoue ?

### Problème : .env.mcp contient "YOUR_KEY_HERE"

**Solution** :
```cmd
notepad .env.mcp
# Remplacer tous les YOUR_KEY_HERE par vos vraies clés
```

### Problème : start-mcp-server.bat contient des secrets

**Solution** :
```cmd
copy start-mcp-server-secure.bat start-mcp-server.bat
```

### Problème : .gitignore ne protège pas les secrets

**Solution** :
```cmd
echo .env.mcp >> .gitignore
echo start-mcp-server.bat >> .gitignore
```

### Problème : Bypass test-user non protégé

**Solution** : Le fix est déjà dans `lib/mcp/server/middleware/auth-middleware.ts`

Vérifier que le code contient :
```typescript
if (process.env.NODE_ENV === 'production') {
  throw new Error('AUTH_FAILED: Test API keys not allowed in production');
}
```

---

## 🔄 Rollback si Problème

Si quelque chose ne marche pas :

```cmd
cd F:\corematch

# Trouver votre backup (ex: backup_20250127_143000)
dir backup_*

# Restaurer
copy backup_20250127_143000\*.bak .
```

---

## 🎯 Niveaux de Sécurité

### Niveau 1 : Développement (Actuel après script)
✅ Secrets dans `.env.mcp` (non versionné)
✅ `.gitignore` protège les secrets
✅ Bypass test-user bloqué en production
⚠️ `MCP_MOCK_MODE=true` (données de test)
⚠️ `supabaseAdmin` (service-role) utilisé

**Usage** : Développement, tests, démos

### Niveau 2 : Staging (Recommandé avant production)
✅ Tout du Niveau 1
✅ `MCP_MOCK_MODE=false`
✅ PII masqué dans logs
✅ PII masqué dans réponses
⚠️ `supabaseAdmin` (service-role) utilisé

**Usage** : Tests avec données réelles, pré-production

### Niveau 3 : Production (Objectif final)
✅ Tout du Niveau 2
✅ Client Supabase avec RLS (pas service-role)
✅ URLs signées pour CVs
✅ Audit de sécurité externe
✅ Monitoring et alertes

**Usage** : Production avec données clients réelles

---

## 📚 Fichiers de Sécurité

| Fichier | Description | Versionné ? |
|---------|-------------|-------------|
| `.env.mcp.example` | Template (sans secrets) | ✅ OUI |
| `.env.mcp` | Vos secrets | ❌ NON (gitignore) |
| `start-mcp-server.bat` | Script de démarrage | ❌ NON (gitignore) |
| `start-mcp-server-secure.bat` | Template sécurisé | ✅ OUI |
| `apply-security-fixes.bat` | Script d'automatisation | ✅ OUI |
| `scripts/audit-security.ts` | Audit automatique | ✅ OUI |

---

## ⚡ Commandes Rapides

### Appliquer les fixes
```cmd
apply-security-fixes.bat
```

### Auditer la sécurité
```cmd
npx tsx scripts/audit-security.ts
```

### Tester le serveur
```cmd
start-mcp-server.bat
```

### Régénérer MCP API key
```cmd
npx tsx scripts/generate-api-key.ts
```

### Vérifier Git status (aucun secret !)
```cmd
git status
```

---

## 🚨 Urgence : Secret Exposé

Si vous avez accidentellement commité un secret :

### 1. Révoquer Immédiatement

**Supabase** :
- https://supabase.com/dashboard/project/glexllbywdvlxpbanjmn/settings/api
- Régénérer Service Role Key

**MCP** :
```cmd
npx tsx scripts/generate-api-key.ts
```

### 2. Supprimer de Git

```cmd
# Supprimer du dernier commit
git rm --cached .env.mcp start-mcp-server.bat
git commit --amend -m "Remove secrets"

# Si déjà pushé
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch start-mcp-server.bat .env.mcp" \
  --prune-empty --tag-name-filter cat -- --all

git push origin --force --all
```

### 3. Mettre à Jour .gitignore

```cmd
echo .env.mcp >> .gitignore
echo start-mcp-server.bat >> .gitignore
git add .gitignore
git commit -m "Protect secrets in gitignore"
```

### 4. Considérer les Secrets Compromis

- Changer **TOUS** les mots de passe d'admin
- Vérifier les logs d'accès Supabase
- Monitorer pour activité suspecte

---

## 💡 Bonnes Pratiques

### ✅ À FAIRE

- Utiliser `.env.mcp` pour TOUS les secrets
- Régénérer les clés tous les 90 jours
- Auditer régulièrement avec `audit-security.ts`
- Tester en local avant de déployer
- Maintenir la documentation à jour

### ❌ À NE JAMAIS FAIRE

- Commiter `.env.mcp` ou `start-mcp-server.bat`
- Partager vos clés par email/Slack
- Utiliser les mêmes clés en dev et prod
- Ignorer les warnings de l'audit
- Désactiver les vérifications de sécurité

---

## 📞 Support

**En cas de problème** :

1. **Consulter** : `SECURITY_FIXES_URGENT.md` (détails techniques)
2. **Auditer** : `npx tsx scripts/audit-security.ts`
3. **Rollback** : Restaurer depuis `backup_*/`
4. **Demander aide** : Ouvrir une issue (SANS partager vos secrets!)

---

**🔒 La sécurité est un processus continu, pas un état final ! 🔒**

---

**Créé le** : 2025-10-27
**Dernière mise à jour** : 2025-10-27
