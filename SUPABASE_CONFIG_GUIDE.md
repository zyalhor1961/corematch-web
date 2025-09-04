# 🔐 Guide de Configuration Supabase pour CoreMatch

## ⚠️ Configuration Requise pour Résoudre le Problème de Connexion

Votre problème de connexion vient du fait que **les URLs de production ne sont pas autorisées dans Supabase**. Voici comment corriger cela :

---

## 1. 🌐 **Configurer les URLs Autorisées**

### Dans votre tableau de bord Supabase :
1. Allez sur [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Sélectionnez votre projet CoreMatch
3. Allez dans **Settings** → **Authentication**

### Ajoutez ces URLs dans **Site URL** :
```
https://corematch-oxgcmrzeo-corematchs-projects.vercel.app
```

### Ajoutez ces URLs dans **Redirect URLs** :
```
https://corematch-oxgcmrzeo-corematchs-projects.vercel.app/auth/callback
https://corematch-oxgcmrzeo-corematchs-projects.vercel.app/dashboard
http://localhost:3000/auth/callback
http://localhost:3000/dashboard
```

---

## 2. 🔧 **Variables d'Environnement Vercel**

### Dans votre tableau de bord Vercel :
1. Allez sur [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Sélectionnez votre projet CoreMatch
3. Allez dans **Settings** → **Environment Variables**

### Ajoutez/Vérifiez ces variables :
```bash
# Supabase (REQUIS)
NEXT_PUBLIC_SUPABASE_URL=https://glexllbywdvlxpbanjmn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Application (REQUIS)
NEXT_PUBLIC_APP_URL=https://corematch-oxgcmrzeo-corematchs-projects.vercel.app

# OpenAI (REQUIS)
OPENAI_API_KEY=sk-...

# Stripe (REQUIS pour les paiements)
STRIPE_PUBLIC_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Azure (REQUIS pour DEB module)
AZURE_DOCINTEL_ENDPOINT=https://...
AZURE_DOCINTEL_KEY=...
```

---

## 3. 📧 **Configuration OAuth (Google/autres)**

Si vous utilisez Google OAuth :

### Dans la console Google Cloud :
1. Allez sur [console.cloud.google.com](https://console.cloud.google.com)
2. Sélectionnez votre projet
3. APIs & Services → Credentials
4. Éditez votre OAuth client
5. Ajoutez dans **Authorized redirect URIs** :
```
https://glexllbywdvlxpbanjmn.supabase.co/auth/v1/callback
```

### Dans Supabase Authentication → Providers :
1. Activez Google Provider
2. Ajoutez votre Client ID et Client Secret

---

## 4. 🔄 **Après Configuration**

1. **Sauvegardez** toutes les configurations dans Supabase
2. **Redéployez** votre application Vercel
3. **Attendez** 2-3 minutes pour la propagation
4. **Testez** la connexion sur le site live

---

## 🚨 **Problèmes Courants et Solutions**

### Erreur "Invalid login credentials"
- ✅ Vérifiez que l'utilisateur existe dans Supabase Auth
- ✅ Vérifiez que le mot de passe est correct
- ✅ Créez un compte test si nécessaire

### Erreur "Redirect URL not allowed"
- ✅ Ajoutez l'URL dans Supabase Redirect URLs
- ✅ Vérifiez que l'URL est exactement la même (avec/sans /)

### Erreur "Site URL mismatch"
- ✅ Configurez la Site URL dans Supabase
- ✅ Vérifiez NEXT_PUBLIC_APP_URL dans Vercel

### La page ne charge pas
- ✅ Vérifiez les variables d'environnement dans Vercel
- ✅ Redéployez après les changements

---

## 🧪 **Test de Connexion**

Après configuration, testez dans cet ordre :

1. **Chargement de la page** : `https://corematch-oxgcmrzeo-corematchs-projects.vercel.app`
2. **Page de login** : `https://corematch-oxgcmrzeo-corematchs-projects.vercel.app/login`
3. **Connexion email/mot de passe**
4. **Connexion Google OAuth** (si configuré)

---

## 📞 **Support**

Si le problème persiste après ces étapes :
1. Vérifiez les logs Vercel Function
2. Vérifiez les logs Supabase Auth
3. Testez en mode développement local d'abord

---

**⏰ Temps estimé pour la configuration : 10-15 minutes**
**✅ Une fois configuré, la connexion devrait fonctionner immédiatement**