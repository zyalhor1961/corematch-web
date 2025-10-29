# 🚨 INCIDENT DE SÉCURITÉ - ACTION IMMÉDIATE REQUISE

**Date**: 2025-10-29
**Gravité**: 🔴 CRITIQUE
**Statut**: ⏳ EN COURS - ATTENTE RÉVOCATION

---

## 📋 Résumé

GitHub Secret Scanning a détecté une **Supabase Service Role Key** compromise dans l'historique Git public du dépôt `zyalhor1961/corematch-web`.

**Clé compromise**:
```
**REDACTED_SUPABASE_KEY**
```

**Risque**: ⚠️ Accès administrateur complet à la base de données Supabase, bypass RLS, lecture/écriture toutes tables.

---

## 🔍 Étendue de la compromission

### Commits affectés
1. **6c02b9d** - `security: Proxy Corematch + Guides de sécurité critique`
   - Fichier: `NETTOYER_HISTORIQUE_GIT.md:252` (guide contenant la vraie clé comme exemple)
2. **f976d47** - `security: Remove files with hardcoded Supabase secrets`
3. **646144c** - `feat: Two-pass invoice processing for accurate boundary detection`

### Fichiers concernés (avant nettoyage)
- ✅ **SUPPRIMÉ**: `NETTOYER_HISTORIQUE_GIT.md`
- ✅ **SUPPRIMÉ**: `start-mcp-server.bat.backup`
- ✅ **SUPPRIMÉ**: `VERIFIER_MCP_CLAUDE_DESKTOP.md`
- ✅ **SUPPRIMÉ**: `FIX_AUTH_ERROR.md`
- ✅ **SUPPRIMÉ**: `TEST_PRODUCTION.md`
- ✅ **SUPPRIMÉ**: `DEPLOYMENT_SUMMARY.md`
- ✅ **SUPPRIMÉ**: `DEPLOY_NOW.md`
- ✅ **SUPPRIMÉ**: `scripts/test-analyze-cv-mock.ts`
- ✅ **SUPPRIMÉ**: `start-mcp-inspector-mock.bat`
- ✅ **SUPPRIMÉ**: `start-mcp-inspector.bat`
- ✅ **SUPPRIMÉ**: Backups `backup_manual_20251027_193909/`
- ✅ **SUPPRIMÉ**: Backups `backup_20251027_192955/`
- ⏳ **À METTRE À JOUR**: `.env.mcp` (après régénération)

---

## ✅ Actions déjà complétées

1. ✅ **Suppression fichiers compromis** du working directory (12 fichiers)
2. ✅ **Installation git-filter-repo** (outil de nettoyage d'historique)
3. ✅ **Création fichier de remplacement** (`replace-secrets.txt`)
4. ✅ **Documentation de la procédure** (ce fichier)

---

## 🚨 ACTIONS URGENTES À FAIRE MAINTENANT

### 1️⃣ RÉVOQUER LA CLÉ COMPROMISE (⏱️ 5 minutes)

**URL**: https://supabase.com/dashboard/project/glexllbywdvlxpbanjmn/settings/api

**Étapes**:
1. Se connecter au dashboard Supabase
2. Aller sur **Settings** → **API**
3. Section **"service_role key"**
4. Cliquer sur **"Regenerate"** ou **"Reset"**
5. ⚠️ **COPIER LA NOUVELLE CLÉ** immédiatement (elle ne sera plus visible après)
6. ⚠️ **RÉVOQUER L'ANCIENNE** (confirmer la suppression)

**Note**: Après régénération, le serveur MCP cessera de fonctionner jusqu'à mise à jour de `.env.mcp`.

---

### 2️⃣ AUDIT DES ACCÈS SUPABASE (⏱️ 10 minutes)

Vérifier s'il y a eu des accès suspects pendant la période de compromission :

**SQL à exécuter dans Supabase SQL Editor** :
```sql
-- Vérifier les accès API suspects dans les dernières 24h
SELECT
  created_at,
  ip_address,
  path,
  status,
  user_id
FROM
  auth.audit_log_entries
WHERE
  created_at > NOW() - INTERVAL '24 hours'
ORDER BY
  created_at DESC
LIMIT 100;

-- Vérifier les modifications suspectes dans organization_members
SELECT
  id,
  org_id,
  user_id,
  role,
  created_at,
  updated_at
FROM
  organization_members
WHERE
  updated_at > NOW() - INTERVAL '24 hours'
  OR created_at > NOW() - INTERVAL '24 hours'
ORDER BY
  updated_at DESC;

-- Vérifier les nouveaux projets suspects
SELECT
  id,
  name,
  org_id,
  created_by,
  created_at
FROM
  projects
WHERE
  created_at > NOW() - INTERVAL '24 hours'
ORDER BY
  created_at DESC;

-- Vérifier les nouveaux candidats suspects
SELECT
  id,
  project_id,
  first_name,
  last_name,
  email,
  created_at
FROM
  candidates
WHERE
  created_at > NOW() - INTERVAL '24 hours'
ORDER BY
  created_at DESC;
```

**Que rechercher**:
- Accès API depuis des IPs inconnues
- Nouveaux membres ajoutés à des organisations
- Projets créés par des users inconnus
- Modifications de rôles (role upgrade vers admin/owner)
- Exports massifs de données (candidates)

**Si activité suspecte détectée**:
1. Noter les user_id / org_id concernés
2. Révoquer immédiatement les comptes compromis
3. Notifier les organisations affectées
4. Considérer une restauration depuis backup

---

### 3️⃣ METTRE À JOUR .env.mcp (⏱️ 2 minutes)

**APRÈS avoir régénéré la clé** :

```bash
# Ouvrir .env.mcp
notepad F:\corematch\.env.mcp

# Remplacer l'ancienne clé par la NOUVELLE clé Supabase service-role
# Ligne 3 : SUPABASE_SERVICE_ROLE_KEY=<NOUVELLE_CLÉ_ICI>
```

**Vérification**:
```bash
# Vérifier que l'ancienne clé n'existe plus
grep -c "**REDACTED_SUPABASE_KEY**" F:\corematch\.env.mcp
# Doit retourner : 0
```

---

### 4️⃣ NETTOYER L'HISTORIQUE GIT (⏱️ 15 minutes)

⚠️ **ATTENTION**: Cette opération va réécrire tout l'historique Git. **Sauvegarde requise**.

**Sauvegarde préventive**:
```bash
cd F:\
cp -r corematch corematch-backup-$(date +%Y%m%d-%H%M%S)
```

**Nettoyage avec git-filter-repo**:
```bash
cd F:\corematch

# Vérifier que tous les remotes sont configurés
git remote -v

# Nettoyer l'historique (remplace toutes occurrences dans TOUS les commits)
git filter-repo --replace-text replace-secrets.txt --force

# Vérifier que les secrets ont été supprimés
git log --all -S"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" --oneline
# Doit retourner : (vide)

# Vérifier que les fichiers ont été supprimés de l'historique
git log --all --full-history -- NETTOYER_HISTORIQUE_GIT.md
# Devrait montrer les commits où le fichier a été supprimé
```

**Restaurer les remotes** (git-filter-repo les supprime) :
```bash
git remote add origin https://github.com/zyalhor1961/corematch-web.git
```

---

### 5️⃣ FORCE PUSH (⏱️ 5 minutes)

⚠️ **DANGER**: Force push réécrit l'historique sur GitHub. **Coordination équipe requise**.

**Avant de force push**:
1. ✅ Vérifier que la nouvelle clé est dans `.env.mcp`
2. ✅ Vérifier que l'ancienne clé n'existe plus dans le code
3. ✅ Vérifier que l'ancienne clé a été révoquée sur Supabase
4. ✅ Notifier l'équipe (si applicable)

**Exécution**:
```bash
cd F:\corematch

# Force push (réécrit l'historique sur GitHub)
git push origin main --force --all

# Force push des tags également
git push origin --force --tags

# Vérifier sur GitHub que les secrets ont disparu
# Attendre 5-10 minutes que GitHub Secret Scanning re-scanne
```

---

### 6️⃣ REDÉMARRER SERVEUR MCP (⏱️ 2 minutes)

**Après avoir mis à jour `.env.mcp`** :

```bash
# Arrêter tous les serveurs MCP en cours
taskkill /F /IM node.exe /FI "WINDOWTITLE eq MCP*"

# Redémarrer avec nouvelle clé
cd F:\corematch
npx tsx bin/mcp-server.ts

# Vérifier que le serveur démarre sans erreur
# Devrait afficher : "🚀 MCP Server listening on stdio"
```

**Tester l'accès** :
```bash
# Test get-candidates (doit fonctionner avec nouvelle clé)
npx tsx scripts/test-get-candidates.ts

# Test analyze-cv (doit fonctionner avec nouvelle clé)
npx tsx scripts/test-analyze-cv-access.ts
```

---

## 📊 Timeline de la compromission

| Date/Heure | Événement |
|------------|-----------|
| **27 Oct 2025 20:14** | Commit `6c02b9d` : Clé exposée dans `NETTOYER_HISTORIQUE_GIT.md` |
| **29 Oct 2025 XX:XX** | GitHub Secret Scanning détecte la clé compromise |
| **29 Oct 2025 XX:XX** | ✅ Suppression des fichiers compromis du working directory |
| **29 Oct 2025 XX:XX** | ⏳ **EN ATTENTE** : Révocation clé Supabase |
| **29 Oct 2025 XX:XX** | ⏳ **EN ATTENTE** : Audit accès suspects |
| **29 Oct 2025 XX:XX** | ⏳ **EN ATTENTE** : Nettoyage historique Git |
| **29 Oct 2025 XX:XX** | ⏳ **EN ATTENTE** : Force push |

**Durée d'exposition estimée**: ~2 jours (27 Oct → 29 Oct)

---

## ✅ Checklist de résolution

- [ ] **1. Révocation clé Supabase** (Dashboard → API → Regenerate)
- [ ] **2. Copie nouvelle clé** (noter dans gestionnaire de mots de passe)
- [ ] **3. Audit accès Supabase** (SQL queries ci-dessus)
- [ ] **4. Mise à jour `.env.mcp`** (remplacer ancienne clé)
- [ ] **5. Vérification suppression** (grep retourne 0)
- [ ] **6. Sauvegarde repo** (cp -r corematch corematch-backup-...)
- [ ] **7. Nettoyage Git** (git filter-repo --replace-text)
- [ ] **8. Vérification historique** (git log -S"..." retourne vide)
- [ ] **9. Restauration remote** (git remote add origin...)
- [ ] **10. Force push** (git push --force --all)
- [ ] **11. Vérification GitHub** (secrets disparus de l'historique)
- [ ] **12. Redémarrage MCP** (npx tsx bin/mcp-server.ts)
- [ ] **13. Tests fonctionnels** (get-candidates, analyze-cv)
- [ ] **14. Résolution alertes GitHub** (Resolve alerts sur dashboard)
- [ ] **15. Post-mortem** (documenter leçons apprises)

---

## 🔐 Prévention future

### Mesures immédiates (P0)
1. ✅ **Chiffrer disque** : Activer BitLocker sur C: et F:
2. ✅ **Gestionnaire secrets** : Migrer vers Windows Credential Manager ou 1Password
3. ✅ **Pre-commit hook** : Installer git-secrets pour bloquer commits avec secrets
4. ✅ **Rotation secrets** : Planifier rotation tous les 90 jours

### Mesures à moyen terme (P1)
1. **Migration proxy MCP** : Utiliser `/api/mcp-proxy` au lieu de service-role direct
2. **RLS complet** : Activer RLS sur toutes les tables
3. **Monitoring** : Alertes Supabase pour accès API suspects
4. **Documentation équipe** : Partager procédure avec tous les devs

### Mesures à long terme (P2)
1. **Audit externe** : Pentest de l'infrastructure
2. **Compliance** : Vérification RGPD/OWASP
3. **Formation** : Sécurité pour toute l'équipe

---

## 📞 Contacts d'urgence

- **Supabase Support** : https://supabase.com/dashboard/support
- **GitHub Security** : https://github.com/zyalhor1961/corematch-web/security

---

## 📚 Références

- **Procédure complète** : `SECURITY_ENV_MCP.md` (section "Que faire en cas de compromission")
- **OWASP Secrets Management** : https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- **git-filter-repo docs** : https://github.com/newren/git-filter-repo
- **Supabase Security** : https://supabase.com/docs/guides/platform/security

---

**Document créé le** : 2025-10-29
**Dernière mise à jour** : 2025-10-29
**Statut actuel** : 🔴 CRITIQUE - RÉVOCATION REQUISE
**Prochaine action** : ⏳ Attente révocation clé Supabase par l'utilisateur
