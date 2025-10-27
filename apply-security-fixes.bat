@echo off
REM =============================================================================
REM Script de Sécurisation Automatique du Serveur MCP
REM =============================================================================
REM
REM Ce script applique TOUS les fixes de sécurité identifiés :
REM 1. Sauvegarde des fichiers actuels
REM 2. Création de .env.mcp avec nouvelles clés
REM 3. Remplacement du script de démarrage
REM 4. Mise à jour de .gitignore
REM 5. Nettoyage des secrets dans la documentation
REM 6. Vérification finale
REM
REM =============================================================================

setlocal enabledelayedexpansion

echo.
echo ========================================
echo   SECURISATION SERVEUR MCP COREMATCH
echo ========================================
echo.
echo ATTENTION: Ce script va:
echo   - Sauvegarder les fichiers actuels
echo   - Generer de nouvelles cles secretes
echo   - Remplacer le script de demarrage
echo   - Mettre a jour la configuration
echo.
echo Assurez-vous d'avoir:
echo   - Ferme Claude Desktop
echo   - Acces Internet (pour generer les cles)
echo   - Droits d'ecriture dans F:\corematch
echo.
pause

REM =============================================================================
REM ETAPE 1: Verifications prealables
REM =============================================================================

echo.
echo [1/8] Verifications prealables...
echo.

cd /d F:\corematch
if errorlevel 1 (
    echo ERREUR: Impossible d'acceder a F:\corematch
    pause
    exit /b 1
)

REM Verifier que Node.js est disponible
where node >nul 2>&1
if errorlevel 1 (
    echo ERREUR: Node.js non trouve
    pause
    exit /b 1
)

REM Verifier que les fichiers importants existent
if not exist "package.json" (
    echo ERREUR: package.json non trouve
    pause
    exit /b 1
)

if not exist ".env.mcp.example" (
    echo ERREUR: .env.mcp.example non trouve
    echo Creez d'abord le fichier template
    pause
    exit /b 1
)

echo   [OK] Environnement valide
echo.

REM =============================================================================
REM ETAPE 2: Sauvegarde des fichiers actuels
REM =============================================================================

echo [2/8] Sauvegarde des fichiers actuels...
echo.

REM Creer dossier backup avec timestamp
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set BACKUP_DIR=backup_%datetime:~0,8%_%datetime:~8,6%

mkdir "%BACKUP_DIR%" >nul 2>&1

REM Sauvegarder les fichiers importants
if exist "start-mcp-server.bat" (
    copy "start-mcp-server.bat" "%BACKUP_DIR%\start-mcp-server.bat.bak" >nul
    echo   [OK] start-mcp-server.bat sauvegarde
)

if exist ".env.mcp" (
    copy ".env.mcp" "%BACKUP_DIR%\.env.mcp.bak" >nul
    echo   [OK] .env.mcp sauvegarde
)

if exist ".gitignore" (
    copy ".gitignore" "%BACKUP_DIR%\.gitignore.bak" >nul
    echo   [OK] .gitignore sauvegarde
)

echo.
echo   [OK] Sauvegarde dans: %BACKUP_DIR%
echo.

REM =============================================================================
REM ETAPE 3: Generation de nouvelles cles
REM =============================================================================

echo [3/8] Generation de nouvelles cles secretes...
echo.

echo   IMPORTANT: Regeneration des cles requise
echo.
echo   1. Ouvrez: https://supabase.com/dashboard/project/glexllbywdvlxpbanjmn/settings/api
echo   2. Cliquez sur "Regenerate" pour Service Role Key
echo   3. Copiez la nouvelle cle
echo.
echo   Voulez-vous continuer avec la generation MCP API key ?
pause

echo.
echo   Generation MCP API key...
npx tsx scripts/generate-api-key.ts > "%BACKUP_DIR%\new-mcp-key.txt" 2>&1

if errorlevel 1 (
    echo   [ERREUR] Generation echouee
    echo   Consultez %BACKUP_DIR%\new-mcp-key.txt pour details
    pause
    exit /b 1
)

echo   [OK] Nouvelle MCP API key generee
echo   [OK] Details dans: %BACKUP_DIR%\new-mcp-key.txt
echo.

REM =============================================================================
REM ETAPE 4: Creation de .env.mcp
REM =============================================================================

echo [4/8] Creation du fichier .env.mcp securise...
echo.

REM Copier le template
copy ".env.mcp.example" ".env.mcp" >nul

if errorlevel 1 (
    echo   [ERREUR] Impossible de creer .env.mcp
    pause
    exit /b 1
)

echo   [OK] .env.mcp cree depuis le template
echo.
echo   IMPORTANT: Vous devez maintenant editer .env.mcp et remplir:
echo   1. SUPABASE_SERVICE_ROLE_KEY (nouvelle cle generee sur Supabase)
echo   2. MCP_AUTH_HEADER (voir %BACKUP_DIR%\new-mcp-key.txt)
echo   3. OPENAI_API_KEY (votre cle existante)
echo   4. GEMINI_API_KEY (votre cle existante)
echo.
echo   Ouvrir .env.mcp maintenant ?
echo.
choice /C YN /M "Ouvrir avec notepad"
if errorlevel 2 goto skip_edit
if errorlevel 1 (
    notepad .env.mcp
)
:skip_edit

echo.
echo   Avez-vous rempli toutes les cles dans .env.mcp ?
pause

REM Verifier que .env.mcp n'est pas vide
for %%F in (.env.mcp) do set size=%%~zF
if %size% LSS 100 (
    echo   [ERREUR] .env.mcp semble incomplet
    pause
    exit /b 1
)

echo   [OK] .env.mcp configure
echo.

REM =============================================================================
REM ETAPE 5: Remplacement du script de demarrage
REM =============================================================================

echo [5/8] Remplacement du script de demarrage...
echo.

REM Supprimer l'ancien (deja sauvegarde)
if exist "start-mcp-server.bat" (
    del "start-mcp-server.bat" >nul 2>&1
    echo   [OK] Ancien script supprime
)

REM Utiliser le script securise
if exist "start-mcp-server-secure.bat" (
    copy "start-mcp-server-secure.bat" "start-mcp-server.bat" >nul
    echo   [OK] Script securise installe
) else (
    echo   [ERREUR] start-mcp-server-secure.bat non trouve
    pause
    exit /b 1
)

echo.

REM =============================================================================
REM ETAPE 6: Mise a jour de .gitignore
REM =============================================================================

echo [6/8] Protection des secrets dans .gitignore...
echo.

REM Verifier si deja protege
findstr /C:"start-mcp-server.bat" .gitignore >nul 2>&1
if errorlevel 1 (
    echo. >> .gitignore
    echo # MCP Server secrets (NEVER commit these!) >> .gitignore
    echo start-mcp-server.bat >> .gitignore
    echo .env.mcp >> .gitignore
    echo   [OK] .gitignore mis a jour
) else (
    echo   [OK] .gitignore deja protege
)

echo.

REM =============================================================================
REM ETAPE 7: Desactivation du MOCK mode
REM =============================================================================

echo [7/8] Configuration du mode d'execution...
echo.

echo   Voulez-vous desactiver MOCK mode (donnees reelles) ?
echo   - YES: Analyse de vrais CVs (necessite job_spec_config)
echo   - NO:  Garde MOCK mode (donnees de test)
echo.
choice /C YN /M "Desactiver MOCK mode"

if errorlevel 2 (
    echo   [OK] MOCK mode conserve - Mode developpement
    echo.
    echo   ATTENTION: En mode MOCK:
    echo   - analyze_cv retourne des donnees de test
    echo   - get_candidates fonctionne normalement
    echo   - Parfait pour dev/demo, PAS pour production
) else (
    REM Remplacer MCP_MOCK_MODE=true par false dans .env.mcp
    powershell -Command "(Get-Content .env.mcp) -replace 'MCP_MOCK_MODE=true', 'MCP_MOCK_MODE=false' | Set-Content .env.mcp"
    echo   [OK] MOCK mode desactive - Mode production
    echo.
    echo   IMPORTANT: Vous devez avoir au moins un projet
    echo   avec job_spec_config configure pour analyze_cv
)

echo.

REM =============================================================================
REM ETAPE 8: Verification finale
REM =============================================================================

echo [8/8] Verification de la configuration...
echo.

REM Verifier que .env.mcp existe et contient les cles
if not exist ".env.mcp" (
    echo   [ERREUR] .env.mcp manquant
    goto error_end
)

findstr /C:"YOUR_KEY_HERE" .env.mcp >nul 2>&1
if not errorlevel 1 (
    echo   [ERREUR] .env.mcp contient encore des placeholders
    echo   Editez .env.mcp et remplacez toutes les valeurs YOUR_KEY_HERE
    goto error_end
)

REM Verifier que start-mcp-server.bat n'a plus de secrets
findstr /C:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" start-mcp-server.bat >nul 2>&1
if not errorlevel 1 (
    echo   [ERREUR] start-mcp-server.bat contient encore des secrets
    goto error_end
)

REM Verifier .gitignore
findstr /C:"start-mcp-server.bat" .gitignore >nul 2>&1
if errorlevel 1 (
    echo   [ERREUR] .gitignore ne protege pas start-mcp-server.bat
    goto error_end
)

findstr /C:".env.mcp" .gitignore >nul 2>&1
if errorlevel 1 (
    echo   [ERREUR] .gitignore ne protege pas .env.mcp
    goto error_end
)

echo   [OK] .env.mcp configure
echo   [OK] start-mcp-server.bat securise
echo   [OK] .gitignore protege les secrets
echo.

REM =============================================================================
REM SUCCES
REM =============================================================================

echo.
echo ========================================
echo   SECURISATION TERMINEE AVEC SUCCES !
echo ========================================
echo.
echo Fichiers modifies:
echo   - .env.mcp (NOUVEAU - contient vos secrets)
echo   - start-mcp-server.bat (securise)
echo   - .gitignore (protege les secrets)
echo.
echo Sauvegarde dans: %BACKUP_DIR%
echo.
echo PROCHAINES ETAPES:
echo.
echo 1. Verifier .env.mcp (toutes les cles remplies)
echo 2. Mettre a jour Claude Desktop config:
echo    Fichier: %%APPDATA%%\Claude\claude_desktop_config.json
echo    Args: ["/c", "F:\\corematch\\start-mcp-server.bat"]
echo.
echo 3. Redemarrer Claude Desktop
echo.
echo 4. Tester:
echo    - Ouvrir Settings ^> Extensions ^> Developer
echo    - Verifier status "running" pour corematch
echo    - Tester avec: "Quels outils MCP as-tu ?"
echo.
echo 5. IMPORTANT - Ne JAMAIS:
echo    - Committer .env.mcp
echo    - Committer start-mcp-server.bat
echo    - Partager vos cles
echo.

REM Creer un fichier de log
echo Securisation appliquee le %date% %time% > "%BACKUP_DIR%\securisation.log"
echo Backup dans: %BACKUP_DIR% >> "%BACKUP_DIR%\securisation.log"
echo Mode MOCK: >> "%BACKUP_DIR%\securisation.log"
findstr "MCP_MOCK_MODE" .env.mcp >> "%BACKUP_DIR%\securisation.log"

echo Log complet: %BACKUP_DIR%\securisation.log
echo.
pause
exit /b 0

:error_end
echo.
echo ========================================
echo   ERREUR - SECURISATION INCOMPLETE
echo ========================================
echo.
echo Consultez les messages ci-dessus pour details
echo.
echo Pour restaurer:
echo   copy "%BACKUP_DIR%\*.bak" .
echo.
pause
exit /b 1
