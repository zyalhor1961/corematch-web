# 🚨 ATTENTION : SÉCURITÉ CRITIQUE

**Date**: 2025-10-27
**Priorité**: 🔴 URGENT - À LIRE AVANT TOUT USAGE

---

## ⚠️ ÉTAT ACTUEL DU SERVEUR MCP

Le serveur MCP **fonctionne** mais contient des **vulnérabilités critiques** :

### 🔴 Problèmes Identifiés

1. **Secrets Exposés** :
   - `start-mcp-server.bat` contient service-role key en clair
   - MCP API key visible dans le code
   - Ces fichiers sont dans le repo Git = **COMPROMIS**

2. **Bypass de Sécurité Actif** :
   - `MCP_MOCK_MODE=true` désactive TOUTES les vérifications
   - Aucun contrôle RGPD réel
   - Aucune vérification d'accès

3. **Privilèges Excessifs** :
   - `supabaseAdmin` utilisé partout = bypass RLS complet
   - Accès total à TOUTES les données
   - Aucune limitation par organisation/projet

4. **Exposition de Données Personnelles** :
   - Logs contiennent noms, emails, IDs
   - Réponses contiennent PII non masqué
   - Violation potentielle RGPD

5. **CVs Non Protégés** :
   - URLs possiblement publiques
   - Pas de signature/expiration

---

## 🛡️ SOLUTIONS DISPONIBLES

J'ai créé tous les fichiers nécessaires :

| Fichier | Description | Status |
|---------|-------------|--------|
| `.env.mcp.example` | Template pour secrets | ✅ Créé |
| `start-mcp-server-secure.bat` | Script sécurisé | ✅ Créé |
| `.gitignore` | Protège les secrets | ✅ Mis à jour |
| `auth-middleware.ts` | Bypass bloqué en prod | ✅ Corrigé |

---

## ✅ APPLIQUER LES FIXES - 3 OPTIONS

### Option A : Script Automatique (Recommandé)

```cmd
cd F:\corematch
apply-security-fixes.bat
```

Ce script va :
1. Créer `.env.mcp` depuis le template
2. Vous demander de régénérer les clés
3. Remplacer l'ancien script
4. Mettre à jour Claude Desktop
5. Tester que tout fonctionne

⏱️ **Temps** : 10 minutes

### Option B : Manuel Guidé

Suivre le guide : `APPLY_SECURITY_FIXES_NOW.md`

⏱️ **Temps** : 30 minutes

### Option C : Désactiver Temporairement

Si vous n'avez pas le temps maintenant :

```cmd
# Dans Claude Desktop
Settings → Extensions → Developer → corematch → Stop
```

**NE PAS utiliser** le serveur avant correction !

---

## 🚫 À NE PAS FAIRE

❌ **NE PAS** utiliser avec données réelles avant fixes
❌ **NE PAS** commit `start-mcp-server.bat` avec secrets
❌ **NE PAS** partager le repo tant que secrets dedans
❌ **NE PAS** laisser `MCP_MOCK_MODE=true` en production
❌ **NE PAS** ignorer ces avertissements

---

## ✅ CHECKLIST SÉCURITÉ

Avant d'utiliser en production :

- [ ] Secrets déplacés dans `.env.mcp` (NON versionné)
- [ ] Toutes les clés RÉGÉNÉRÉES (anciennes = compromises)
- [ ] `.gitignore` protège `.env.mcp` et `start-mcp-server.bat`
- [ ] `MCP_MOCK_MODE` désactivé ou retiré
- [ ] Bypass test-user bloqué en production
- [ ] PII masqué dans logs et réponses
- [ ] Documentation nettoyée (pas de secrets)
- [ ] Test avec données réelles réussi
- [ ] Audit de sécurité complet effectué

---

## 📞 BESOIN D'AIDE ?

1. **Lire** : `SECURITY_FIXES_URGENT.md` (détails complets)
2. **Appliquer** : `APPLY_SECURITY_FIXES_NOW.md` (guide pas à pas)
3. **Vérifier** : `apply-security-fixes.bat` (script automatique - à créer)

---

## 🎯 PROCHAINES ÉTAPES

**MAINTENANT** :
1. Arrêter le serveur MCP
2. Régénérer TOUTES les clés
3. Appliquer les fixes
4. Tester
5. Valider la sécurité

**AVANT PRODUCTION** :
1. Remplacer `supabaseAdmin` par client avec RLS
2. Implémenter URLs signées pour CVs
3. Masquer PII partout
4. Audit de sécurité externe
5. Tests de pénétration

---

**⚠️ Ce fichier doit rester en haut du repo jusqu'à résolution complète ⚠️**

---

**Créé le** : 2025-10-27
**Mis à jour** : 2025-10-27
**Priorité** : 🔴 CRITIQUE
