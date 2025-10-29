@echo off
REM Script d'installation de la configuration Claude Desktop

echo.
echo ========================================
echo   Installation Claude Desktop Config
echo ========================================
echo.

REM Créer le dossier si nécessaire
echo [1/4] Création du dossier Claude...
if not exist "%APPDATA%\Claude" (
    mkdir "%APPDATA%\Claude"
    echo   ✅ Dossier créé
) else (
    echo   ✅ Dossier existe déjà
)
echo.

REM Sauvegarder l'ancien fichier si existant
echo [2/4] Sauvegarde de l'ancienne configuration...
if exist "%APPDATA%\Claude\claude_desktop_config.json" (
    copy "%APPDATA%\Claude\claude_desktop_config.json" "%APPDATA%\Claude\claude_desktop_config.json.backup" >nul
    echo   ✅ Sauvegarde créée: claude_desktop_config.json.backup
) else (
    echo   ℹ️  Pas de configuration existante
)
echo.

REM Copier le nouveau fichier
echo [3/4] Installation de la nouvelle configuration...
copy "F:\corematch\claude_desktop_config.json" "%APPDATA%\Claude\claude_desktop_config.json" >nul
if %errorlevel% equ 0 (
    echo   ✅ Configuration installée avec succès!
) else (
    echo   ❌ Erreur lors de la copie
    pause
    exit /b 1
)
echo.

REM Vérifier le contenu
echo [4/4] Vérification...
type "%APPDATA%\Claude\claude_desktop_config.json"
echo.

echo ========================================
echo   ✅ INSTALLATION TERMINÉE!
echo ========================================
echo.
echo 📍 Fichier installé dans:
echo    %APPDATA%\Claude\claude_desktop_config.json
echo.
echo 🔄 PROCHAINES ÉTAPES:
echo.
echo 1. Fermer COMPLÈTEMENT Claude Desktop
echo    (vérifier dans la barre des tâches)
echo.
echo 2. Relancer Claude Desktop
echo.
echo 3. Tester avec ces commandes:
echo    "Liste les candidats du projet 037e7639-3d42-45f1-86c2-1f21a72fb96a"
echo    "Analyse le CV mock-candidate-1 pour mock-project-1"
echo.

pause
