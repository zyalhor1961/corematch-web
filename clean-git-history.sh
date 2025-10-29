#!/bin/bash

################################################################################
# Script de nettoyage d'historique Git - Suppression secrets Supabase
################################################################################
#
# Ce script nettoie l'historique Git pour supprimer TOUTES les occurrences
# de la clé Supabase service-role compromise.
#
# ⚠️ ATTENTION : Cette opération est DESTRUCTIVE et réécrit l'historique Git.
#
# Prérequis :
# 1. La nouvelle clé Supabase doit être générée
# 2. .env.mcp doit être mis à jour avec la nouvelle clé
# 3. L'ancienne clé doit être révoquée sur Supabase
#
# Utilisation :
#   bash clean-git-history.sh
#
################################################################################

set -e  # Exit on error

echo "═══════════════════════════════════════════════════════════════"
echo "🚨 NETTOYAGE HISTORIQUE GIT - SUPPRESSION SECRETS SUPABASE"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variables
REPO_PATH="/f/corematch"
BACKUP_PATH="/f/corematch-backup-$(date +%Y%m%d-%H%M%S)"
REPLACE_FILE="replace-secrets.txt"
OLD_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsZXhsbGJ5d2R2bHhwYmFuam1uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjQxNTI4NCwiZXhwIjoyMDcxOTkxMjg0fQ.7nnnTWg974XtP704A-5FNSKglMK1iMLOmN0BQz9Pdok"

################################################################################
# 1. Vérifications préalables
################################################################################

echo "📋 Étape 1/8 : Vérifications préalables..."
echo ""

# Vérifier que replace-secrets.txt existe
if [ ! -f "$REPO_PATH/$REPLACE_FILE" ]; then
    echo -e "${RED}❌ ERREUR : Fichier $REPLACE_FILE introuvable${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Fichier $REPLACE_FILE trouvé${NC}"

# Vérifier que .env.mcp ne contient plus l'ancienne clé
if grep -q "$OLD_KEY" "$REPO_PATH/.env.mcp" 2>/dev/null; then
    echo -e "${RED}❌ ERREUR : .env.mcp contient encore l'ancienne clé compromise${NC}"
    echo -e "${YELLOW}⚠️  Veuillez d'abord mettre à jour .env.mcp avec la NOUVELLE clé Supabase${NC}"
    exit 1
fi
echo -e "${GREEN}✅ .env.mcp ne contient plus l'ancienne clé${NC}"

# Vérifier que git-filter-repo est installé
if ! python -m git_filter_repo --version &>/dev/null; then
    echo -e "${RED}❌ ERREUR : git-filter-repo n'est pas installé${NC}"
    echo -e "${YELLOW}⚠️  Installez-le avec : python -m pip install git-filter-repo${NC}"
    exit 1
fi
echo -e "${GREEN}✅ git-filter-repo installé${NC}"

# Vérifier qu'on est dans un repo git
cd "$REPO_PATH"
if [ ! -d ".git" ]; then
    echo -e "${RED}❌ ERREUR : Pas un dépôt Git${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Dépôt Git valide${NC}"

echo ""
echo -e "${YELLOW}⚠️  AVERTISSEMENT :${NC}"
echo "   Cette opération va RÉÉCRIRE tout l'historique Git."
echo "   Tous les commit SHAs vont changer."
echo "   Une sauvegarde sera créée dans : $BACKUP_PATH"
echo ""
read -p "Voulez-vous continuer ? (oui/non) : " -r
echo ""
if [[ ! $REPLY =~ ^(oui|OUI|yes|YES)$ ]]; then
    echo "❌ Opération annulée par l'utilisateur"
    exit 0
fi

################################################################################
# 2. Sauvegarde
################################################################################

echo "═══════════════════════════════════════════════════════════════"
echo "📦 Étape 2/8 : Création sauvegarde..."
echo "═══════════════════════════════════════════════════════════════"
echo ""

echo "Copie de $REPO_PATH vers $BACKUP_PATH..."
cp -r "$REPO_PATH" "$BACKUP_PATH"

if [ -d "$BACKUP_PATH" ]; then
    echo -e "${GREEN}✅ Sauvegarde créée : $BACKUP_PATH${NC}"
else
    echo -e "${RED}❌ ERREUR : Échec création sauvegarde${NC}"
    exit 1
fi

################################################################################
# 3. Sauvegarder les remotes
################################################################################

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "🔗 Étape 3/8 : Sauvegarde configuration remotes..."
echo "═══════════════════════════════════════════════════════════════"
echo ""

git remote -v > "$REPO_PATH/.git-remotes-backup.txt"
echo -e "${GREEN}✅ Remotes sauvegardés dans .git-remotes-backup.txt${NC}"

################################################################################
# 4. Nettoyage historique Git
################################################################################

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "🧹 Étape 4/8 : Nettoyage historique Git..."
echo "═══════════════════════════════════════════════════════════════"
echo ""

echo "⏳ Exécution de git-filter-repo (peut prendre 1-5 minutes)..."
python -m git_filter_repo --replace-text "$REPLACE_FILE" --force

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Historique nettoyé avec succès${NC}"
else
    echo -e "${RED}❌ ERREUR lors du nettoyage${NC}"
    exit 1
fi

################################################################################
# 5. Vérification suppression secrets
################################################################################

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "🔍 Étape 5/8 : Vérification suppression secrets..."
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Vérifier dans l'historique Git
COMMITS_WITH_SECRET=$(git log --all -S"$OLD_KEY" --oneline | wc -l)

if [ "$COMMITS_WITH_SECRET" -eq 0 ]; then
    echo -e "${GREEN}✅ Aucun commit ne contient plus la clé compromise${NC}"
else
    echo -e "${RED}❌ ATTENTION : $COMMITS_WITH_SECRET commits contiennent encore la clé${NC}"
    echo "Commits concernés :"
    git log --all -S"$OLD_KEY" --oneline
    exit 1
fi

# Vérifier dans les fichiers actuels
FILES_WITH_SECRET=$(grep -r "$OLD_KEY" . --exclude-dir=.git --exclude-dir=node_modules --exclude="*.txt" --exclude="*.sh" 2>/dev/null | wc -l)

if [ "$FILES_WITH_SECRET" -eq 0 ]; then
    echo -e "${GREEN}✅ Aucun fichier ne contient plus la clé compromise${NC}"
else
    echo -e "${RED}❌ ATTENTION : $FILES_WITH_SECRET fichiers contiennent encore la clé${NC}"
    grep -r "$OLD_KEY" . --exclude-dir=.git --exclude-dir=node_modules --exclude="*.txt" --exclude="*.sh" 2>/dev/null
    exit 1
fi

################################################################################
# 6. Restauration remotes
################################################################################

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "🔗 Étape 6/8 : Restauration remotes..."
echo "═══════════════════════════════════════════════════════════════"
echo ""

# git-filter-repo supprime les remotes par sécurité, on doit les restaurer
git remote add origin https://github.com/zyalhor1961/corematch-web.git
echo -e "${GREEN}✅ Remote 'origin' restauré${NC}"

git remote -v

################################################################################
# 7. Commit des suppressions
################################################################################

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "💾 Étape 7/8 : Commit des fichiers supprimés..."
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Ajouter les suppressions et le document d'incident
git add -A
git add INCIDENT_SECURITE_URGENT.md 2>/dev/null || true
git add replace-secrets.txt 2>/dev/null || true

git commit -m "security: Supprimer fichiers contenant clés Supabase compromises

- Suppression NETTOYER_HISTORIQUE_GIT.md (contenait clé service-role)
- Suppression scripts/test-analyze-cv-mock.ts
- Suppression start-mcp-server.bat.backup
- Suppression fichiers markdown avec secrets
- Suppression backups compromis
- Ajout INCIDENT_SECURITE_URGENT.md (procédure complète)
- Nettoyage historique Git avec git-filter-repo

🔒 Clé compromise révoquée et remplacée
📋 Voir INCIDENT_SECURITE_URGENT.md pour détails

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Commit créé${NC}"
else
    echo -e "${YELLOW}⚠️  Pas de changements à commiter${NC}"
fi

################################################################################
# 8. Instructions force push
################################################################################

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "🚀 Étape 8/8 : Force push requis..."
echo "═══════════════════════════════════════════════════════════════"
echo ""

echo -e "${YELLOW}⚠️  IMPORTANT :${NC}"
echo ""
echo "L'historique Git a été nettoyé LOCALEMENT."
echo "Pour nettoyer l'historique sur GitHub, vous devez faire un FORCE PUSH."
echo ""
echo -e "${RED}⚠️  DANGER :${NC}"
echo "   - Le force push va RÉÉCRIRE l'historique sur GitHub"
echo "   - Tous les collaborateurs devront re-cloner le repo"
echo "   - Les PRs ouvertes seront affectées"
echo ""
echo "Commandes à exécuter :"
echo ""
echo -e "${GREEN}   git push origin main --force --all${NC}"
echo -e "${GREEN}   git push origin --force --tags${NC}"
echo ""
echo "Après le force push :"
echo "1. Attendre 5-10 minutes que GitHub Secret Scanning re-scanne"
echo "2. Vérifier sur https://github.com/zyalhor1961/corematch-web/security"
echo "3. Résoudre les alertes manuellement si nécessaires"
echo ""
read -p "Voulez-vous exécuter le force push MAINTENANT ? (oui/non) : " -r
echo ""

if [[ $REPLY =~ ^(oui|OUI|yes|YES)$ ]]; then
    echo "🚀 Exécution force push..."
    echo ""

    git push origin main --force --all

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Force push réussi${NC}"
        echo ""
        echo "Pushing tags..."
        git push origin --force --tags || echo -e "${YELLOW}⚠️  Pas de tags à pusher${NC}"
    else
        echo -e "${RED}❌ ERREUR lors du force push${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  Force push non exécuté${NC}"
    echo "Exécutez manuellement quand vous êtes prêt :"
    echo "   git push origin main --force --all"
    echo "   git push origin --force --tags"
fi

################################################################################
# Résumé final
################################################################################

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ NETTOYAGE TERMINÉ"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Résumé :"
echo "  ✅ Sauvegarde créée : $BACKUP_PATH"
echo "  ✅ Historique Git nettoyé (git-filter-repo)"
echo "  ✅ Secrets supprimés de TOUS les commits"
echo "  ✅ Remotes restaurés"
echo "  ✅ Commit de nettoyage créé"
echo ""
echo "Prochaines étapes :"
echo "  1. Vérifier GitHub Security Alerts (5-10 min après force push)"
echo "  2. Résoudre manuellement les alertes sur GitHub"
echo "  3. Redémarrer serveur MCP avec nouvelle clé"
echo "  4. Tester fonctionnalités (get-candidates, analyze-cv)"
echo ""
echo "Documentation complète :"
echo "  📄 INCIDENT_SECURITE_URGENT.md"
echo "  📄 SECURITY_ENV_MCP.md"
echo ""
echo -e "${GREEN}🎉 Nettoyage réussi !${NC}"
