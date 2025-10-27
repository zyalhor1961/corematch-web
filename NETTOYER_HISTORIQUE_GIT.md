# ⚠️ Nettoyage Historique Git - SECRETS EXPOSÉS

**Date**: 2025-10-27
**Priorité**: 🔴 **CRITIQUE** - À faire après régénération JWT
**Durée**: 1-2 heures
**Risque**: ⚠️ **TRÈS ÉLEVÉ** - Opération destructive et irréversible

---

## 🚨 ATTENTION - OPÉRATION DANGEREUSE

Ce guide explique comment **supprimer définitivement** les secrets de l'historique Git.

**⚠️ RISQUES** :
- ❌ **Réé criture complète** de l'historique Git
- ❌ **Force push** requis (écrase distant)
- ❌ **Collaborateurs** doivent re-cloner le repo
- ❌ **Branches** peuvent être cassées
- ❌ **Pull requests** ouverts invalides
- ❌ **Pas de rollback** possible

**✅ QUAND LE FAIRE** :
- ✅ Après avoir **régénéré** le JWT Supabase
- ✅ Quand **personne d'autre** ne travaille sur le repo
- ✅ Après avoir **prévenu toute l'équipe**
- ✅ Si vous avez **sauvegardé** le repo
- ✅ Si vous comprenez **tous les risques**

**❌ NE PAS FAIRE SI** :
- ❌ D'autres personnes ont des branches ouvertes
- ❌ Le repo est public (clés déjà exposées publiquement)
- ❌ Vous n'êtes pas sûr de ce que vous faites
- ❌ C'est urgent (prenez le temps de préparer)

---

## 🎯 Secrets à Supprimer

### Commits Compromis

```bash
# Trouver les commits avec secrets
cd F:\corematch
git log --all --source --full-history -S"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" --oneline
```

**Résultat attendu** (actuellement) :
```
5d31542 - feat: Major platform improvements
f976d47 - security: Remove hardcoded secrets
646144c - feat: Two-pass invoice processing
cb91b20 - Fix CV upload storage
```

### Fichiers à Nettoyer

- `start-mcp-server.bat` (clés en clair)
- `MCP_SERVER_READY.md` (contenait clés)
- Potentiellement d'autres `.md`

---

## 🛠️ MÉTHODE 1 : BFG Repo-Cleaner (Recommandé)

**BFG** est plus rapide et sûr que `git filter-branch`.

### Étape 1 : Sauvegarder

```bash
# 1. Clone miroir comme backup
cd F:\
git clone --mirror F:\corematch corematch-backup.git

# 2. Créer archive complète
cd F:\corematch
git archive --format=zip --output=../corematch-backup-$(date +%Y%m%d).zip HEAD

# 3. Exporter toutes les branches
git bundle create ../corematch-full-backup.bundle --all
```

**Vérifier le backup** :
```bash
# Tester que le bundle fonctionne
git clone ../corematch-full-backup.bundle test-restore
cd test-restore
git log --oneline | head -5
cd ..
rm -rf test-restore
```

### Étape 2 : Installer BFG

**Windows** :
```powershell
# Télécharger BFG
# https://rtyley.github.io/bfg-repo-cleaner/

# Ou via scoop :
scoop install bfg

# Vérifier installation
bfg --version
```

### Étape 3 : Créer Fichier de Secrets

Créer `secrets.txt` avec les clés à supprimer :

```bash
cat > secrets.txt << 'EOF'
***REDACTED_SUPABASE_SERVICE_ROLE_KEY***
***REDACTED_MCP_API_KEY***
EOF
```

### Étape 4 : Nettoyer avec BFG

```bash
# 1. Clone miroir pour nettoyage
cd F:\
git clone --mirror F:\corematch corematch-clean.git

# 2. Nettoyer avec BFG
cd F:\
bfg --replace-text secrets.txt corematch-clean.git

# 3. Expurger refs
cd corematch-clean.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 4. Vérifier que secrets sont partis
git log --all --source --full-history -S"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" --oneline
# Résultat attendu : rien
```

### Étape 5 : Tester le Repo Nettoyé

```bash
# 1. Clone le repo nettoyé
cd F:\
git clone corematch-clean.git corematch-test

# 2. Vérifier fonctionnalité
cd corematch-test
npm install
npm run build

# 3. Chercher secrets (ne doit rien trouver)
grep -r "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" .
grep -r "mcp_sk_da36279d" .

# Si OK, continuer. Sinon, recommencer.
```

### Étape 6 : Remplacer le Repo Original

```bash
# 1. Sauvegarder travail actuel
cd F:\corematch
git stash push -m "Before history rewrite"

# 2. Ajouter remote du repo nettoyé
git remote add clean F:\corematch-clean.git

# 3. Fetch le repo nettoyé
git fetch clean

# 4. Reset sur la branche nettoyée
git reset --hard clean/main

# 5. Vérifier
git log --oneline | head -10
```

### Étape 7 : Force Push

**⚠️ POINT DE NON-RETOUR** :

```bash
# 1. Prévenir TOUTE l'équipe AVANT !
# 2. Vérifier que personne ne travaille

# 3. Force push
git push origin main --force

# 4. Force push toutes les branches
git push origin --all --force

# 5. Force push tous les tags
git push origin --tags --force
```

### Étape 8 : Notifier l'Équipe

**Message à envoyer** :

```
🚨 HISTORIQUE GIT RÉÉCRIT - ACTION REQUISE 🚨

L'historique Git de corematch a été réécrit pour supprimer des secrets exposés.

📋 Action requise pour CHAQUE développeur :

1. Sauvegarder votre travail en cours :
   cd F:\corematch
   git stash push -m "Before force pull"

2. Supprimer votre repo local :
   cd F:\
   rm -rf corematch

3. Re-cloner le repo :
   git clone https://github.com/votre-org/corematch.git
   cd corematch

4. Restaurer votre travail :
   git stash pop

⚠️ NE PAS faire de merge/pull simple, ça ne marchera pas !

Questions ? Contactez [VOTRE NOM]
```

---

## 🛠️ MÉTHODE 2 : git filter-repo (Alternative)

`git-filter-repo` est plus puissant que BFG mais plus complexe.

### Installation

```bash
# Windows
pip install git-filter-repo

# Vérifier
git filter-repo --version
```

### Utilisation

```bash
# 1. Clone fresh
cd F:\
git clone F:\corematch corematch-filter
cd corematch-filter

# 2. Créer script de remplacement
cat > replace-secrets.txt << 'EOF'
***REDACTED_SUPABASE_SERVICE_ROLE_KEY***==>***REDACTED_SUPABASE_KEY***
***REDACTED_MCP_API_KEY***==>***REDACTED_MCP_KEY***
EOF

# 3. Filtrer l'historique
git filter-repo --replace-text replace-secrets.txt

# 4. Vérifier
git log --all -S"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" --oneline
# Doit être vide
```

---

## 🛠️ MÉTHODE 3 : Nouveau Repo (Plus Sûr)

Si vous n'êtes pas à l'aise avec la réécriture d'historique :

### Option : Créer Nouveau Repo

```bash
# 1. Créer nouveau repo sur GitHub/GitLab
# Nom : corematch-v2

# 2. Copier état actuel
cd F:\corematch
git archive --format=tar HEAD | (cd /tmp && tar -xf -)

# 3. Créer nouveau repo Git
cd /tmp
mv corematch corematch-v2
cd corematch-v2
git init
git add .
git commit -m "Initial commit - clean history

Previous repo had compromised secrets in history.
This is a fresh start with clean history.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 4. Push vers nouveau remote
git remote add origin https://github.com/votre-org/corematch-v2.git
git push -u origin main

# 5. Archiver ancien repo
# Sur GitHub : Settings → Danger Zone → Archive this repository
```

**Avantages** :
- ✅ Pas de réécriture d'historique
- ✅ Pas de force push
- ✅ Historique propre dès le départ
- ✅ Ancien repo archivé (référence)

**Inconvénients** :
- ❌ Perte de l'historique ancien
- ❌ Pull requests perdues
- ❌ Issues à migrer

---

## ✅ Vérification Post-Nettoyage

### 1. Chercher Secrets Restants

```bash
cd F:\corematch

# Chercher dans tous les commits
git log --all --source --full-history -S"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" --oneline
# Doit être VIDE

# Chercher dans tous les fichiers actuels
grep -r "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" .
grep -r "mcp_sk_da36279d" .
# Doit être VIDE (sauf .env.mcp.backup si existe)
```

### 2. Vérifier Taille Repo

```bash
# Avant nettoyage
du -sh .git
# Ex: 150M

# Après nettoyage (devrait être plus petit)
du -sh .git
# Ex: 80M
```

### 3. Tester Fonctionnalité

```bash
# Build
npm run build

# Tests
npm test

# Lancer app
npm run dev

# Lancer MCP
npx tsx bin/start-with-env.ts
```

---

## 🚨 En Cas de Problème

### Problème : Repo cassé après nettoyage

**Solution - Rollback** :
```bash
# 1. Supprimer repo cassé
cd F:\
rm -rf corematch

# 2. Restaurer depuis bundle backup
git clone corematch-full-backup.bundle corematch
cd corematch

# 3. Reconnecter au remote
git remote add origin https://github.com/votre-org/corematch.git

# 4. Re-planifier le nettoyage avec plus de préparation
```

### Problème : Collaborateurs ont des conflits

**Solution** :
```bash
# Pour chaque collaborateur :

# 1. Sauvegarder travail
git stash push -m "Before force pull"

# 2. Fetch nouveau historique
git fetch origin

# 3. Reset hard sur nouvelle branche
git reset --hard origin/main

# 4. Appliquer travail sauvegardé
git stash pop

# 5. Résoudre conflits si nécessaire
```

### Problème : Branches perdues

**Solution** :
```bash
# Les branches sont dans le backup
cd F:\
git clone corematch-full-backup.bundle temp-restore
cd temp-restore

# Lister toutes les branches
git branch -a

# Cherry-pick les commits perdus
git log feature/ma-branche --oneline
# Noter les hash des commits

cd F:\corematch
git cherry-pick HASH1 HASH2 HASH3
```

---

## 📊 Impact Estimation

| Aspect | Impact |
|--------|--------|
| **Downtime** | 0 (repo accessible) |
| **Collaborateurs** | Doivent re-cloner |
| **CI/CD** | Peut nécessiter rebuild |
| **Pull Requests** | À re-créer si ouverts |
| **Issues** | Inchangées |
| **Taille repo** | Réduite (~30-50%) |
| **Sécurité** | Secrets effacés ✅ |

---

## 🎯 Checklist Complète

### Avant Nettoyage
- [ ] Clés Supabase **RÉGÉNÉRÉES** (JWT Secret)
- [ ] Backup complet créé (bundle + archive)
- [ ] Backup testé et fonctionnel
- [ ] Équipe prévenue (date/heure planifiées)
- [ ] Personne ne travaille sur le repo
- [ ] Pull requests fermées ou mergées

### Pendant Nettoyage
- [ ] BFG/filter-repo installé
- [ ] Secrets listés dans `secrets.txt`
- [ ] Nettoyage effectué sur clone miroir
- [ ] Repo nettoyé testé (build + run)
- [ ] Secrets vérifiés absents (grep)

### Après Nettoyage
- [ ] Force push réussi
- [ ] Collaborateurs notifiés
- [ ] Collaborateurs ont re-cloné
- [ ] CI/CD fonctionne
- [ ] App fonctionne en production
- [ ] Ancien backup archivé (garder 6 mois)

---

## 📚 Ressources

**BFG Repo-Cleaner** :
- Site : https://rtyley.github.io/bfg-repo-cleaner/
- Docs : https://rtyley.github.io/bfg-repo-cleaner/#usage

**git-filter-repo** :
- Repo : https://github.com/newren/git-filter-repo
- Man page : https://htmlpreview.github.io/?https://github.com/newren/git-filter-repo/blob/docs/html/git-filter-repo.html

**GitHub - Removing sensitive data** :
- https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository

---

## ⏰ Timeline Recommandée

**J-7** : Annoncer le nettoyage à l'équipe
**J-3** : Créer backup complet
**J-1** : Tester procédure sur clone local
**J-Day 18h** : Nettoyage (hors heures de travail)
**J+1 9h** : Vérifier que tout fonctionne
**J+7** : Archiver anciens backups

---

**Créé le** : 2025-10-27
**Auteur** : Claude Code
**Status** : ⚠️ Guide uniquement - NE PAS exécuter sans préparation

**🔴 RAPPEL : Cette opération est IRRÉVERSIBLE 🔴**
**⚠️ Régénérer JWT Supabase AVANT de nettoyer Git ⚠️**
