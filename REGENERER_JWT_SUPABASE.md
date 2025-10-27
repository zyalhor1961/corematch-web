# 🔥 Régénération JWT Secret Supabase - CRITIQUE

**Date**: 2025-10-27
**Priorité**: 🔴 **URGENT** - Clé compromise dans historique Git
**Durée**: 30 minutes
**Risque**: ⚠️ **ÉLEVÉ** - Va temporairement casser l'application

---

## 🚨 POURQUOI C'EST NÉCESSAIRE

La clé **SUPABASE_SERVICE_ROLE_KEY** est **COMPROMISE** :

```
Commits compromis dans Git :
- 5d31542 (feat: Major platform improvements)
- f976d47 (security: Remove hardcoded secrets)
- 646144c (feat: Two-pass invoice processing)
- cb91b20 (Fix CV upload storage)
```

**Impact si non régénéré** :
- ❌ N'importe qui avec accès au repo peut lire la clé
- ❌ Accès complet à TOUTES vos données Supabase
- ❌ Bypass de TOUTES les règles RLS
- ❌ Création/suppression de données sans limite

---

## ⚠️ CE QUI VA CASSER (Temporairement)

En régénérant le JWT Secret, **TOUTES** les clés Supabase changent :

| Système | Impact | Durée |
|---------|--------|-------|
| **Application Web** | ❌ Arrêt complet | ~5-10 min |
| **Serveur MCP** | ❌ Arrêt complet | ~2 min |
| **Scripts/Crons** | ❌ Échouent | Jusqu'à MAJ |
| **Auth utilisateurs** | ⚠️ Déconnexion | Reconnexion requise |

---

## 🛠️ PRÉPARATION

### 1. Timing Optimal

**Meilleur moment** :
- ✅ Hors heures de travail (soirée/weekend)
- ✅ Quand aucun utilisateur actif
- ✅ Après avoir prévenu l'équipe

**Éviter** :
- ❌ Heures de pointe
- ❌ Pendant une démo client
- ❌ Si vous n'avez pas 30 min devant vous

### 2. Sauvegardes

```bash
# 1. Commit l'état actuel
cd F:\corematch
git add -A
git commit -m "backup: Before JWT regeneration"

# 2. Sauvegarder les clés actuelles
echo "=== BACKUP KEYS $(date) ===" > backup-keys.txt
echo "SUPABASE_SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.mcp)" >> backup-keys.txt
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env.local)" >> backup-keys.txt

# 3. Sauvegarder .env files
cp .env.mcp .env.mcp.backup
cp .env.local .env.local.backup
```

---

## 📝 ÉTAPES DE RÉGÉNÉRATION

### Étape 1 : Arrêter Tous les Services

```bash
# 1. Arrêter application web (si en dev)
# Ctrl+C dans le terminal npm run dev

# 2. Arrêter Claude Desktop
# → Clic-droit sur icône → Quit

# 3. Noter l'heure de début
echo "Début: $(date)" >> regeneration.log
```

### Étape 2 : Régénérer le JWT Secret

1. **Ouvrir Supabase Dashboard**
   ```
   https://supabase.com/dashboard/project/glexllbywdvlxpbanjmn/settings/api
   ```

2. **Section "JWT Settings"**
   - Cliquer sur **"Generate new JWT secret"**
   - ⚠️ **CONFIRMER** (warning rouge apparaît)
   - ⏳ Attendre ~30 secondes (régénération)

3. **Confirmer la régénération**
   - La page va recharger automatiquement
   - Nouvelles clés apparaissent

### Étape 3 : Copier les NOUVELLES Clés

Dans Supabase Dashboard, **COPIER** :

1. **anon (public) key**
   Commence par : `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

2. **service_role (secret) key**
   Commence par : `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

**⚠️ NE PAS FERMER** la page avant d'avoir copié !

### Étape 4 : Mettre à Jour `.env.mcp` (MCP Server)

```bash
# Ouvrir .env.mcp
notepad F:\corematch\.env.mcp

# Remplacer :
SUPABASE_SERVICE_ROLE_KEY=eyJ...NOUVELLE_CLE_ICI...
```

**Vérifier** :
```bash
# La clé doit être différente de l'ancienne
cat .env.mcp | grep SUPABASE_SERVICE_ROLE_KEY
```

### Étape 5 : Mettre à Jour `.env.local` (App Web)

```bash
# Ouvrir .env.local
notepad F:\corematch\.env.local

# Remplacer :
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...NOUVELLE_CLE_ICI...
SUPABASE_SERVICE_ROLE_KEY=eyJ...NOUVELLE_CLE_ICI...
```

**Vérifier** :
```bash
cat .env.local | grep SUPABASE
```

### Étape 6 : Tester le Serveur MCP

```bash
cd F:\corematch

# Test rapide (5 sec)
timeout 5 npx tsx bin/start-with-env.ts

# Résultat attendu :
# [MCP Start] Environment loaded from .env.mcp ✅
# 🚀 Starting Corematch MCP Server...
# ✅ Corematch MCP Server running
```

**Si échec** :
- Vérifier que la clé est bien copiée
- Pas d'espaces avant/après
- Clé complète (pas tronquée)

### Étape 7 : Tester l'Application Web

```bash
# Lancer en dev
npm run dev

# Ouvrir navigateur
http://localhost:3000

# Tester :
# 1. Login (auth fonctionne ?)
# 2. Dashboard (données chargées ?)
# 3. Créer candidat (BDD accessible ?)
```

**Si échec** :
- Ouvrir console (F12)
- Chercher erreurs "401 Unauthorized" ou "Invalid JWT"
- Revérifier les clés dans `.env.local`

### Étape 8 : Relancer Claude Desktop

```bash
# 1. Ouvrir Claude Desktop

# 2. Settings → Extensions → Developer

# 3. Vérifier "corematch" status = "running" (bleu)

# 4. Tester :
# "Peux-tu me donner la liste des candidats du projet 037e7639..."
```

### Étape 9 : Commit les Changements

```bash
# NE PAS commit .env.mcp ou .env.local !
# Mais commit le log de l'opération

echo "Régénération JWT Supabase terminée: $(date)" >> regeneration.log
git add regeneration.log
git commit -m "security: JWT Supabase regenerated after compromise

- Ancienne service-role key compromise (historique Git)
- Nouvelle clé générée et installée
- .env.mcp et .env.local mis à jour
- Serveur MCP testé : ✅
- Application web testée : ✅

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## ✅ CHECKLIST DE VÉRIFICATION

Après régénération, **TOUT** doit fonctionner :

### Serveur MCP
- [ ] `npx tsx bin/start-with-env.ts` démarre sans erreur
- [ ] Claude Desktop status = "running"
- [ ] Tool `get_candidates` fonctionne
- [ ] Tool `analyze_cv` fonctionne (MOCK mode)

### Application Web
- [ ] `npm run dev` démarre
- [ ] Login fonctionne
- [ ] Dashboard charge les projets
- [ ] Création de candidat fonctionne
- [ ] Upload de CV fonctionne

### Utilisateurs
- [ ] Prévenir l'équipe de se reconnecter
- [ ] Tester avec un compte réel

---

## 🚨 EN CAS DE PROBLÈME

### Problème : "Invalid JWT" dans l'app web

**Cause** : Mauvaise clé `anon` ou `service_role`

**Solution** :
```bash
# 1. Revérifier les clés sur Supabase
# 2. Re-copier exactement
# 3. Vérifier pas d'espaces/retours ligne
# 4. Relancer npm run dev
```

### Problème : MCP Server ne démarre pas

**Cause** : Mauvaise clé `service_role` dans `.env.mcp`

**Solution** :
```bash
# 1. Vérifier .env.mcp
cat .env.mcp | grep SUPABASE_SERVICE_ROLE_KEY

# 2. Comparer avec Supabase dashboard
# 3. Re-copier si différent
# 4. Retester
```

### Problème : Users déconnectés ne peuvent pas se reconnecter

**Cause** : Cache JWT côté client

**Solution** :
```bash
# 1. Vider cache navigateur (Ctrl+Shift+Delete)
# 2. Ou mode incognito
# 3. Retenter login
```

### Rollback d'Urgence

Si **RIEN** ne fonctionne après 15 min :

```bash
# 1. Restaurer anciennes clés
cp .env.mcp.backup .env.mcp
cp .env.local.backup .env.local

# 2. Relancer serveurs
npm run dev
# Redémarrer Claude Desktop

# 3. Tester
# Si ça marche → Reporter régénération à plus tard
# Si ça marche pas → Les anciennes clés sont aussi cassées ⚠️
```

**Si rollback échoue aussi** :
→ Régénérer NOUVEAU JWT sur Supabase (2ème fois)
→ Recommencer les étapes 2-8

---

## 📊 Temps Estimés

| Étape | Durée | Cumulé |
|-------|-------|--------|
| Préparation | 5 min | 5 min |
| Régénération Supabase | 2 min | 7 min |
| Mise à jour .env | 3 min | 10 min |
| Tests MCP | 2 min | 12 min |
| Tests App Web | 5 min | 17 min |
| Tests Claude Desktop | 3 min | 20 min |
| Commit + doc | 5 min | 25 min |
| **Total** | **25 min** | |

**Avec problèmes** : +15-30 min

---

## 📝 Notes Importantes

### Ce qui NE change PAS

✅ **Données en base** : Intactes
✅ **Users existants** : Comptes OK (juste déconnectés)
✅ **RLS policies** : Inchangées
✅ **Storage buckets** : Accès OK

### Ce qui change

❌ **Toutes les clés API** : anon + service_role
❌ **Sessions JWT** : Invalidées
❌ **Tokens refresh** : Invalides

### Pourquoi on DOIT le faire

🔴 **Risque actuel** : N'importe qui avec historique Git a :
- Accès complet lecture/écriture BDD
- Bypass de toutes les règles métier
- Possibilité de voler/supprimer données
- Création de comptes admin

🟢 **Après régénération** :
- Anciennes clés invalides = accès bloqué
- Historique Git devient inutile
- Sécurité restaurée

---

## 🔗 Liens Utiles

**Supabase Dashboard** :
- API Settings : https://supabase.com/dashboard/project/glexllbywdvlxpbanjmn/settings/api
- Auth : https://supabase.com/dashboard/project/glexllbywdvlxpbanjmn/auth/users

**Documentation** :
- Supabase JWT : https://supabase.com/docs/guides/auth/jwts
- Regeneration : https://supabase.com/docs/guides/platform/regenerate-api-keys

---

**Créé le** : 2025-10-27
**Testé** : Non (PROD uniquement)
**Auteur** : Claude Code

**⚠️ À FAIRE DÈS QUE POSSIBLE ⚠️**
