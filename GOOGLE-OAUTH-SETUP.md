# 🔐 Configuration Google OAuth pour CoreMatch

## 🚨 Problème Identifié

**Erreur**: `{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}`

**Cause**: Le provider Google OAuth n'est pas activé dans Supabase.

## 🛠️ Solution Complète

### Étape 1 : Configuration Google Cloud Console

#### 1.1 Création du Projet Google
1. Aller sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créer un nouveau projet ou sélectionner un projet existant
3. Nommer le projet : "CoreMatch OAuth"

#### 1.2 Activation de l'API Google
1. Dans le menu, aller à **APIs & Services** → **Library**
2. Rechercher "Google+ API" ou "Google Identity"
3. Cliquer sur **Enable**

#### 1.3 Configuration OAuth 2.0
1. Aller à **APIs & Services** → **Credentials**
2. Cliquer **Create Credentials** → **OAuth 2.0 Client ID**
3. Si c'est la première fois, configurer l'écran de consentement OAuth :
   - **User Type** : External
   - **App name** : CoreMatch
   - **User support email** : Votre email
   - **Developer contact** : Votre email

#### 1.4 Création des Identifiants OAuth
1. **Application type** : Web application
2. **Name** : CoreMatch OAuth Client
3. **Authorized JavaScript origins** :
   ```
   http://localhost:3000
   https://corematch-*.vercel.app
   https://glexllbywdvlxpbanjmn.supabase.co
   ```
4. **Authorized redirect URIs** :
   ```
   http://localhost:3000/auth/callback
   https://corematch-*.vercel.app/auth/callback
   https://glexllbywdvlxpbanjmn.supabase.co/auth/v1/callback
   ```

#### 1.5 Récupération des Clés
- ✅ **Client ID** : `123456789-abcdef.apps.googleusercontent.com`
- ✅ **Client Secret** : `GOCSPX-abcdef123456`

### Étape 2 : Configuration Supabase

#### 2.1 Accès au Dashboard Supabase
1. Aller sur [supabase.com](https://supabase.com)
2. Se connecter au projet CoreMatch
3. Aller dans **Authentication** → **Providers**

#### 2.2 Activation Google OAuth
1. Trouver **Google** dans la liste des providers
2. Activer le toggle **Enable sign in with Google**
3. Renseigner les informations :
   ```
   Client ID (for OAuth): [Client ID from Google Console]
   Client Secret (for OAuth): [Client Secret from Google Console]
   ```
4. **Authorized Client IDs** : Laisser vide (optionnel)
5. Cliquer **Save**

#### 2.3 Configuration de l'URL de Redirection
Dans Supabase, vérifier que l'URL de redirection est :
```
https://glexllbywdvlxpbanjmn.supabase.co/auth/v1/callback
```

### Étape 3 : Configuration des Variables d'Environnement (Optionnel)

Si vous voulez stocker les clés dans l'environnement :

#### 3.1 Fichier .env.local
```env
# Google OAuth (optionnel - géré par Supabase)
GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdef123456
```

#### 3.2 Variables Vercel (Production)
```bash
vercel env add GOOGLE_CLIENT_ID
vercel env add GOOGLE_CLIENT_SECRET
```

### Étape 4 : Test de Configuration

#### 4.1 Test Local
1. Démarrer le serveur de développement : `npm run dev`
2. Aller sur `http://localhost:3000/login`
3. Cliquer sur "Se connecter avec Google"
4. Vérifier que la redirection fonctionne

#### 4.2 Test en Production
1. Aller sur l'application déployée
2. Tester l'authentification Google
3. Vérifier que l'utilisateur est créé dans Supabase

## 🔧 Vérification de la Configuration

### Checklist Supabase
- [ ] **Google Provider activé** dans Authentication → Providers
- [ ] **Client ID configuré** (commence par un nombre)
- [ ] **Client Secret configuré** (commence par GOCSPX-)
- [ ] **Configuration sauvegardée**

### Checklist Google Console
- [ ] **Projet créé** dans Google Cloud Console
- [ ] **API Google+ activée**
- [ ] **OAuth 2.0 Client créé**
- [ ] **Origins autorisées** configurées
- [ ] **Redirect URIs** configurées

### URLs de Redirection à Configurer

#### Google Console (Authorized redirect URIs)
```
https://glexllbywdvlxpbanjmn.supabase.co/auth/v1/callback
http://localhost:3000/auth/callback
https://corematch-hfsd6fv2p-corematchs-projects.vercel.app/auth/callback
```

#### Supabase (Site URL)
```
http://localhost:3000
https://corematch-hfsd6fv2p-corematchs-projects.vercel.app
```

## 🚨 Problèmes Courants et Solutions

### Erreur "provider is not enabled"
**Cause** : Google OAuth pas activé dans Supabase
**Solution** : Activer Google dans Authentication → Providers

### Erreur "redirect_uri_mismatch"
**Cause** : URL de redirection non autorisée
**Solution** : Ajouter toutes les URLs dans Google Console

### Erreur "invalid_client"
**Cause** : Client ID ou Secret incorrect
**Solution** : Vérifier les clés dans Supabase et Google Console

### Erreur "access_denied"
**Cause** : Utilisateur a refusé l'autorisation
**Solution** : Normal, demander à l'utilisateur de réessayer

## 📊 Flux d'Authentification Google

```
1. Utilisateur clique "Se connecter avec Google"
   ↓
2. supabase.auth.signInWithOAuth({ provider: 'google' })
   ↓
3. Redirection vers Google OAuth
   ↓
4. Utilisateur autorise l'application
   ↓
5. Google redirige vers Supabase callback
   ↓
6. Supabase traite l'auth et redirige vers l'app
   ↓
7. Application reçoit l'utilisateur connecté
```

## 🎯 Actions Immédiates Recommandées

### Action 1 : Configuration Supabase (URGENT)
1. Se connecter au dashboard Supabase
2. Aller dans Authentication → Providers
3. Activer Google OAuth
4. Configurer Client ID et Secret

### Action 2 : Test de Validation
1. Tester l'auth Google en local
2. Vérifier que l'utilisateur apparaît dans Supabase
3. Tester en production

### Action 3 : Monitoring
1. Surveiller les logs d'erreur
2. Vérifier les redirections
3. Tester avec différents comptes Google

## ✅ Résultat Attendu

Après configuration complète :
- ✅ Bouton "Se connecter avec Google" fonctionnel
- ✅ Redirection Google fluide
- ✅ Création automatique d'utilisateur dans Supabase
- ✅ Session utilisateur active dans l'application
- ✅ Accès aux fonctionnalités protégées

**L'authentification Google sera pleinement opérationnelle !** 🚀