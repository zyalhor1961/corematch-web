# 🎯 Guide d'Intégration Claude Desktop

**Date**: 2025-10-27
**Status**: Prêt pour installation

---

## 📋 Étape 1 : Copier le Fichier de Configuration

### Option A : Copie Manuelle (Recommandé)

1. **Ouvrir l'Explorateur Windows** et naviguer vers :
   ```
   %APPDATA%\Claude
   ```

   💡 **Astuce** : Coller `%APPDATA%\Claude` directement dans la barre d'adresse de l'Explorateur

2. **Vérifier si le fichier existe déjà** :
   - Si `claude_desktop_config.json` existe → **faire une sauvegarde**
   - Renommer l'ancien fichier en `claude_desktop_config.json.backup`

3. **Copier le nouveau fichier** :
   - Depuis : `F:\corematch\claude_desktop_config.json`
   - Vers : `%APPDATA%\Claude\claude_desktop_config.json`

### Option B : Copie via Ligne de Commande

```cmd
REM Créer le dossier si nécessaire
mkdir "%APPDATA%\Claude" 2>nul

REM Sauvegarder l'ancien fichier si existant
if exist "%APPDATA%\Claude\claude_desktop_config.json" (
    copy "%APPDATA%\Claude\claude_desktop_config.json" "%APPDATA%\Claude\claude_desktop_config.json.backup"
)

REM Copier le nouveau fichier
copy "F:\corematch\claude_desktop_config.json" "%APPDATA%\Claude\claude_desktop_config.json"

REM Vérifier
type "%APPDATA%\Claude\claude_desktop_config.json"
```

---

## 🔄 Étape 2 : Redémarrer Claude Desktop

### Fermer Complètement Claude Desktop

**IMPORTANT** : Claude Desktop doit être **complètement fermé**, pas seulement minimisé.

1. **Fermer la fenêtre principale**

2. **Vérifier dans la barre des tâches** (system tray) :
   - Si l'icône Claude est présente → **Clic droit** → **Quitter**

3. **Vérifier que le processus est terminé** :
   ```cmd
   tasklist | findstr Claude
   ```

   Si un processus apparaît :
   ```cmd
   taskkill /F /IM "Claude.exe"
   ```

### Relancer Claude Desktop

1. **Lancer Claude Desktop** normalement
2. **Attendre 5-10 secondes** que le serveur MCP démarre

---

## ✅ Étape 3 : Vérifier l'Intégration

### Vérification Visuelle

Dans Claude Desktop, cherchez :

1. **Icône ou indication de serveur MCP** :
   - Peut apparaître dans les paramètres
   - Ou dans l'interface principale
   - Cherchez "corematch" ou "MCP"

2. **Menu des outils disponibles** :
   - `get_candidates` devrait être listé
   - `analyze_cv` devrait être listé

### Vérification dans les Logs

**Ouvrir les logs Claude Desktop** :

```cmd
REM Logs MCP (si disponibles)
type "%APPDATA%\Claude\logs\mcp.log"

REM Ou logs généraux
dir "%APPDATA%\Claude\logs"
```

**Ce que vous devriez voir** :
```
[mcp] Server "corematch" started
[mcp] Tools available: get_candidates, analyze_cv
```

---

## 🧪 Étape 4 : Tester les Tools

### Test 1 : `get_candidates` (Production)

Dans Claude Desktop, **démarrer une nouvelle conversation** et taper :

> Peux-tu me donner la liste des candidats du projet **037e7639-3d42-45f1-86c2-1f21a72fb96a** ?

**Comportement attendu** :
- Claude devrait détecter le besoin d'utiliser `get_candidates`
- Afficher "Using tool: get_candidates..."
- Retourner la liste de 10 candidats

**Résultat attendu** :
```
✅ 10 candidats trouvés pour ce projet :

1. [Nom] - Status: analyzed - Score: 75
2. [Nom] - Status: pending
...
```

### Test 2 : `analyze_cv` (MODE MOCK)

Dans la **même conversation**, taper :

> Analyse le CV du candidat **mock-candidate-1** pour le projet **mock-project-1** en mode **balanced**.

**Comportement attendu** :
- Claude devrait détecter le besoin d'utiliser `analyze_cv`
- Afficher "Using tool: analyze_cv..."
- Retourner l'analyse complète

**Résultat attendu** :
```
✅ Analyse terminée !

**Score**: 82.5/100
**Recommandation**: YES - Candidat fortement recommandé

**Forces** (5) :
• React (5 ans)
• TypeScript (3 ans)
• Node.js (4 ans)
• Architecture microservices
• Tests unitaires

**Faiblesses** (3) :
• AWS (seulement 1 an)
• Docker (débutant)
• Kubernetes (non mentionné)

**Métadonnées** :
• Coût: $0.042
• Durée: 8.2s
• Providers: openai, gemini
• Consensus: medium
```

### Test 3 : Conversation Naturelle

Essayez une conversation plus naturelle :

> Je cherche à recruter un développeur React senior. Est-ce que tu peux regarder les candidats du projet 037e7639-3d42-45f1-86c2-1f21a72fb96a et me dire s'il y en a des bons ?

Claude devrait :
1. Utiliser `get_candidates` pour récupérer la liste
2. Analyser les scores existants
3. Vous donner une recommandation

---

## 🐛 Dépannage

### Problème : "Server failed to start"

**Solution** :
1. Vérifier que Node.js est installé :
   ```cmd
   node --version
   npm --version
   ```

2. Vérifier que les dépendances sont installées :
   ```cmd
   cd F:\corematch
   npm install
   ```

3. Tester manuellement le serveur :
   ```cmd
   F:\corematch\start-mcp-inspector-mock.bat
   ```

### Problème : "Tool execution failed"

**Vérifier les variables d'environnement** dans le fichier config :

```json
{
  "mcpServers": {
    "corematch": {
      "command": "cmd.exe",
      "args": [
        "/c",
        "cd /d F:\\corematch && set NEXT_PUBLIC_SUPABASE_URL=... && ..."
      ]
    }
  }
}
```

**Points de vigilance** :
- ✅ Chemin `F:\corematch` correct
- ✅ Variables d'environnement bien définies
- ✅ `MCP_MOCK_MODE=true` présent

### Problème : "No tools available"

**Causes possibles** :

1. **Le serveur n'a pas démarré** :
   - Vérifier les logs Claude Desktop
   - Redémarrer Claude Desktop

2. **Erreur dans le JSON de config** :
   - Vérifier la syntaxe JSON (pas de virgule en trop, guillemets corrects)
   - Utiliser un validateur JSON : https://jsonlint.com/

3. **Chemin incorrect** :
   - Vérifier que `F:\corematch` existe
   - Vérifier que `F:\corematch\bin\mcp-server.ts` existe

### Problème : "AUTH_FAILED"

**Solution** :
- Vérifier que `MCP_AUTH_HEADER` est bien dans la commande
- Vérifier que la clé API est correcte (commence par `mcp_sk_`)

### Problème : "ACCESS_DENIED"

**En MODE MOCK** :
- Vérifier que `MCP_MOCK_MODE=true` est bien dans la commande
- Utiliser les IDs de test : `mock-candidate-1` et `mock-project-1`

**En mode production** :
- Vérifier que l'utilisateur a accès au projet
- Vérifier que le projet existe

---

## 📊 Configuration Détaillée

### Structure du Fichier de Configuration

```json
{
  "mcpServers": {
    "corematch": {                    // Nom du serveur (personnalisable)
      "command": "cmd.exe",            // Shell Windows
      "args": [
        "/c",                          // Exécuter la commande puis quitter
        "cd /d F:\\corematch &&        // Changer de répertoire
         set NEXT_PUBLIC_SUPABASE_URL=... && // Variables d'environnement
         set SUPABASE_SERVICE_ROLE_KEY=... &&
         set MCP_AUTH_HEADER=... &&
         set MCP_MOCK_MODE=true &&
         npx tsx bin/mcp-server.ts"    // Lancer le serveur
      ]
    }
  }
}
```

### Variables d'Environnement Requises

| Variable | Valeur | Usage |
|----------|--------|-------|
| **NEXT_PUBLIC_SUPABASE_URL** | `https://glexllbywdvlxpbanjmn.supabase.co` | Connexion DB |
| **SUPABASE_SERVICE_ROLE_KEY** | `eyJhbGci...` | Auth DB (service_role) |
| **MCP_AUTH_HEADER** | `ApiKey mcp_sk_...` | Auth MCP server |
| **MCP_MOCK_MODE** | `true` | Mode test (bypass job_spec_config) |

### Mode Production vs MODE MOCK

**MODE MOCK** (actuel) :
```cmd
set MCP_MOCK_MODE=true
```
- ✅ Utilisable immédiatement
- ✅ Données de test structurées
- ❌ Ne lit pas les vrais CVs

**Mode Production** :
```cmd
REM Retirer cette ligne :
REM set MCP_MOCK_MODE=true
```
- ✅ Lit les vrais CVs depuis Supabase
- ❌ Nécessite que les projets aient `job_spec_config` configuré

---

## 🎯 Prochaines Étapes Après Intégration

### 1. Tester en MODE MOCK (Actuel)

Utiliser les IDs de test :
- `candidateId: mock-candidate-1`
- `projectId: mock-project-1`

### 2. Migrer vers Production

**Pour analyser de vrais CVs** :

1. **Via l'interface web Corematch** :
   - Ouvrir un projet
   - Configurer le Job Spec en format structuré
   - Sauvegarder

2. **Modifier la configuration Claude Desktop** :
   - Retirer `set MCP_MOCK_MODE=true`
   - Redémarrer Claude Desktop

3. **Tester avec des IDs réels** :
   - Utiliser des candidateId et projectId de production

### 3. Créer des Shortcuts

**Exemple de prompts utiles à sauvegarder** :

```
# Template 1 : Liste des candidats
Donne-moi la liste des candidats du projet [PROJECT_ID]

# Template 2 : Analyse CV
Analyse le CV du candidat [CANDIDATE_ID] pour le projet [PROJECT_ID] en mode balanced

# Template 3 : Comparaison
Compare les candidats du projet [PROJECT_ID] et recommande les 3 meilleurs
```

---

## ✅ Checklist de Validation

Avant de considérer l'intégration réussie :

- [ ] Fichier `claude_desktop_config.json` copié dans `%APPDATA%\Claude`
- [ ] Claude Desktop redémarré complètement
- [ ] Serveur "corematch" visible dans Claude Desktop
- [ ] Tool `get_candidates` fonctionne avec un projet réel
- [ ] Tool `analyze_cv` fonctionne en MODE MOCK
- [ ] Claude répond correctement aux conversations naturelles
- [ ] Logs ne montrent pas d'erreurs critiques

---

## 📞 Support

### En cas de problème :

1. **Tester manuellement** :
   ```cmd
   F:\corematch\start-mcp-inspector-mock.bat
   ```

2. **Vérifier les logs** :
   ```cmd
   type "%APPDATA%\Claude\logs\*.log"
   ```

3. **Réinitialiser** :
   - Supprimer `%APPDATA%\Claude\claude_desktop_config.json`
   - Redémarrer Claude Desktop
   - Recommencer l'installation

---

**Fait avec ❤️ par Claude Code**
**2025-10-27**
