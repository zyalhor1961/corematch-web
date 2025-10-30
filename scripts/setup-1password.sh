#!/bin/bash

################################################################################
# Script de Setup 1Password CLI pour CoreMatch
################################################################################
#
# Ce script vous guide pour stocker tous les secrets CoreMatch dans 1Password
# de manière sécurisée.
#
# Prérequis:
# 1. 1Password CLI installé (https://developer.1password.com/docs/cli/get-started/)
# 2. Authentifié : `op signin`
# 3. Vault "CoreMatch" créé dans 1Password
#
# Utilisation:
#   bash scripts/setup-1password.sh
#
################################################################################

set -e  # Exit on error

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "═══════════════════════════════════════════════════════════════"
echo "🔐 Setup 1Password CLI pour CoreMatch"
echo "═══════════════════════════════════════════════════════════════"
echo ""

################################################################################
# 1. Vérifications
################################################################################

echo "📋 Étape 1/5 : Vérifications préalables..."
echo ""

# Vérifier si op est installé
if ! command -v op &> /dev/null; then
    echo -e "${RED}❌ ERREUR : 1Password CLI n'est pas installé${NC}"
    echo ""
    echo "Installez-le depuis : https://developer.1password.com/docs/cli/get-started/"
    echo ""
    echo "macOS:"
    echo "  brew install --cask 1password-cli"
    echo ""
    echo "Windows:"
    echo "  winget install --id AgileBits.1PasswordCLI"
    echo ""
    exit 1
fi
echo -e "${GREEN}✅ 1Password CLI installé${NC}"

# Vérifier si authentifié
if ! op whoami &> /dev/null; then
    echo -e "${RED}❌ ERREUR : Non authentifié${NC}"
    echo ""
    echo "Connectez-vous d'abord :"
    echo "  op signin"
    echo ""
    exit 1
fi
echo -e "${GREEN}✅ Authentifié : $(op whoami)${NC}"

# Vérifier si vault CoreMatch existe
if ! op vault list | grep -q "CoreMatch"; then
    echo -e "${YELLOW}⚠️  Vault 'CoreMatch' n'existe pas${NC}"
    echo ""
    read -p "Voulez-vous le créer maintenant ? (oui/non) : " -r
    if [[ $REPLY =~ ^(oui|OUI|yes|YES)$ ]]; then
        op vault create CoreMatch
        echo -e "${GREEN}✅ Vault 'CoreMatch' créé${NC}"
    else
        echo -e "${RED}❌ Opération annulée${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Vault 'CoreMatch' existe${NC}"
fi

echo ""

################################################################################
# 2. Stocker les secrets Supabase
################################################################################

echo "═══════════════════════════════════════════════════════════════"
echo "🗄️  Étape 2/5 : Secrets Supabase"
echo "═══════════════════════════════════════════════════════════════"
echo ""

echo "Supabase URL (ex: https://xxxxx.supabase.co)"
read -p "URL: " -r SUPABASE_URL
echo ""

echo "Supabase Service Role Key (clé admin - SENSIBLE!)"
echo "Trouvez-la sur: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api"
read -sp "Service Role Key: " -r SUPABASE_SERVICE_ROLE_KEY
echo ""
echo ""

# Créer les items dans 1Password
echo "Création des items dans 1Password..."

# Supabase URL
op item create \
  --category=password \
  --title="Supabase URL" \
  --vault="CoreMatch" \
  password="$SUPABASE_URL" \
  --tags="supabase,corematch" \
  > /dev/null 2>&1 || op item edit "Supabase URL" --vault="CoreMatch" password="$SUPABASE_URL"

# Supabase Service Role Key
op item create \
  --category=password \
  --title="Supabase Service Role" \
  --vault="CoreMatch" \
  password="$SUPABASE_SERVICE_ROLE_KEY" \
  --tags="supabase,corematch,secret" \
  > /dev/null 2>&1 || op item edit "Supabase Service Role" --vault="CoreMatch" password="$SUPABASE_SERVICE_ROLE_KEY"

echo -e "${GREEN}✅ Secrets Supabase stockés${NC}"

# Vérifier
echo ""
echo "Vérification..."
RETRIEVED_URL=$(op item get "Supabase URL" --vault="CoreMatch" --fields password 2>/dev/null)
if [ "$RETRIEVED_URL" == "$SUPABASE_URL" ]; then
    echo -e "${GREEN}✅ Supabase URL vérifié${NC}"
else
    echo -e "${RED}❌ Erreur de vérification Supabase URL${NC}"
fi

echo ""

################################################################################
# 3. Stocker les secrets MCP
################################################################################

echo "═══════════════════════════════════════════════════════════════"
echo "🔧 Étape 3/5 : Secrets MCP"
echo "═══════════════════════════════════════════════════════════════"
echo ""

echo "MCP Auth Header (ex: ApiKey mcp_sk_xxxxx)"
read -sp "MCP Auth Header: " -r MCP_AUTH_HEADER
echo ""
echo ""

# Créer l'item MCP
op item create \
  --category=password \
  --title="MCP Auth Header" \
  --vault="CoreMatch" \
  password="$MCP_AUTH_HEADER" \
  --tags="mcp,corematch,secret" \
  > /dev/null 2>&1 || op item edit "MCP Auth Header" --vault="CoreMatch" password="$MCP_AUTH_HEADER"

echo -e "${GREEN}✅ Secret MCP stocké${NC}"
echo ""

################################################################################
# 4. Stocker les clés IA (optionnel)
################################################################################

echo "═══════════════════════════════════════════════════════════════"
echo "🤖 Étape 4/5 : Clés API IA (optionnel)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

echo "Ces clés sont optionnelles selon vos providers IA utilisés."
echo ""

# OpenAI
read -p "Avez-vous une clé OpenAI ? (oui/non) : " -r
if [[ $REPLY =~ ^(oui|OUI|yes|YES)$ ]]; then
    read -sp "OpenAI API Key: " -r OPENAI_API_KEY
    echo ""

    op item create \
      --category=password \
      --title="OpenAI API Key" \
      --vault="CoreMatch" \
      password="$OPENAI_API_KEY" \
      --tags="openai,ai,corematch,secret" \
      > /dev/null 2>&1 || op item edit "OpenAI API Key" --vault="CoreMatch" password="$OPENAI_API_KEY"

    echo -e "${GREEN}✅ Clé OpenAI stockée${NC}"
fi

# Gemini
echo ""
read -p "Avez-vous une clé Gemini (Google) ? (oui/non) : " -r
if [[ $REPLY =~ ^(oui|OUI|yes|YES)$ ]]; then
    read -sp "Gemini API Key: " -r GEMINI_API_KEY
    echo ""

    op item create \
      --category=password \
      --title="Gemini API Key" \
      --vault="CoreMatch" \
      password="$GEMINI_API_KEY" \
      --tags="gemini,google,ai,corematch,secret" \
      > /dev/null 2>&1 || op item edit "Gemini API Key" --vault="CoreMatch" password="$GEMINI_API_KEY"

    echo -e "${GREEN}✅ Clé Gemini stockée${NC}"
fi

# Anthropic
echo ""
read -p "Avez-vous une clé Anthropic (Claude) ? (oui/non) : " -r
if [[ $REPLY =~ ^(oui|OUI|yes|YES)$ ]]; then
    read -sp "Anthropic API Key: " -r ANTHROPIC_API_KEY
    echo ""

    op item create \
      --category=password \
      --title="Anthropic API Key" \
      --vault="CoreMatch" \
      password="$ANTHROPIC_API_KEY" \
      --tags="anthropic,claude,ai,corematch,secret" \
      > /dev/null 2>&1 || op item edit "Anthropic API Key" --vault="CoreMatch" password="$ANTHROPIC_API_KEY"

    echo -e "${GREEN}✅ Clé Anthropic stockée${NC}"
fi

echo ""

################################################################################
# 5. Vérification complète
################################################################################

echo "═══════════════════════════════════════════════════════════════"
echo "✅ Étape 5/5 : Vérification complète"
echo "═══════════════════════════════════════════════════════════════"
echo ""

echo "Secrets stockés dans le vault 'CoreMatch' :"
echo ""
op item list --vault="CoreMatch" --categories=password --tags=corematch

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "🎉 Setup terminé!"
echo "═══════════════════════════════════════════════════════════════"
echo ""

echo "Références 1Password pour votre application :"
echo ""
echo -e "${BLUE}Supabase URL:${NC}"
echo "  op://CoreMatch/Supabase URL/password"
echo ""
echo -e "${BLUE}Supabase Service Role:${NC}"
echo "  op://CoreMatch/Supabase Service Role/password"
echo ""
echo -e "${BLUE}MCP Auth Header:${NC}"
echo "  op://CoreMatch/MCP Auth Header/password"
echo ""

echo "Pour tester la récupération :"
echo ""
echo -e "${GREEN}  op read 'op://CoreMatch/Supabase URL/password'${NC}"
echo ""

echo "Prochaines étapes :"
echo "1. Supprimer les .env* avec secrets en clair (sauf .env.example)"
echo "2. Redémarrer le serveur MCP : npx tsx bin/mcp-server.ts"
echo "3. Tester l'application"
echo ""
