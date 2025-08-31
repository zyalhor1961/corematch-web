# Guide de déploiement CoreMatch

Ce guide vous accompagne dans le déploiement de CoreMatch en production.

## 📋 Checklist pré-déploiement

- [ ] Comptes créés (Supabase, Stripe, OpenAI, Azure, Vercel)
- [ ] Domaine configuré (DNS pointant vers Vercel)
- [ ] SSL/TLS configuré
- [ ] Variables d'environnement définies
- [ ] Base de données migrée
- [ ] Tests effectués en staging

## 🏗️ Étape 1: Configuration Supabase

### 1.1 Créer le projet
```bash
# Via l'interface Supabase
1. Aller sur https://supabase.com
2. Créer un nouveau projet
3. Choisir la région: Europe (eu-west-1)
4. Attendre la création (2-3 minutes)
```

### 1.2 Exécuter les migrations
```sql
-- Dans SQL Editor de Supabase, exécuter dans l'ordre :
-- 1. supabase/migrations/001_initial_schema.sql
-- 2. supabase/migrations/002_rls_policies.sql  
-- 3. supabase/migrations/003_indexes_functions.sql
```

### 1.3 Configurer l'authentification
```bash
# Dans Authentication > Settings
1. Activer "Enable email confirmations": false (pour simplifier)
2. Ajouter Google OAuth:
   - Client ID: from Google Console
   - Client Secret: from Google Console
   - Redirect URL: https://your-project.supabase.co/auth/v1/callback
3. Ajouter Site URL: https://yourdomain.com
```

### 1.4 Configurer Storage
```bash
# Dans Storage, créer 3 buckets PRIVÉS:
1. cv (pour les CV uploadés)
2. deb-docs (pour les documents PDF)  
3. deb-exports (pour les CSV générés)

# Policies par défaut (buckets privés avec RLS)
```

## 🎨 Étape 2: Configuration Vercel

### 2.1 Connecter le repository
```bash
# Via l'interface Vercel
1. Aller sur https://vercel.com
2. Importer le repository GitHub
3. Framework Preset: Next.js
4. Build Command: npm run build
5. Output Directory: .next
```

### 2.2 Variables d'environnement
```bash
# Dans Project Settings > Environment Variables
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

OPENAI_API_KEY=sk-proj-xxxxx

STRIPE_PUBLIC_KEY=pk_live_xxxxx
STRIPE_SECRET_KEY=sk_live_xxxxx  
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

AZURE_DOCINTEL_ENDPOINT=https://xxxxx.cognitiveservices.azure.com/
AZURE_DOCINTEL_KEY=xxxxx

N8N_WEBHOOK_DEB_INGEST_URL=https://xxxxx.app.n8n.cloud/webhook/deb/ingest

NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### 2.3 Domaine personnalisé
```bash
# Dans Project Settings > Domains
1. Ajouter votre domaine: yourdomain.com
2. Configurer les DNS records chez votre registrar
3. Attendre la validation SSL (5-10 minutes)
```

## 💳 Étape 3: Configuration Stripe

### 3.1 Créer les produits
```bash
# Via Stripe Dashboard > Products
1. Produit: CoreMatch Starter
   - Prix: €49.00 EUR / mois
   - ID: price_starter_monthly
   
2. Produit: CoreMatch Pro  
   - Prix: €149.00 EUR / mois
   - ID: price_pro_monthly
   
3. Produit: CoreMatch Scale
   - Prix: €399.00 EUR / mois
   - ID: price_scale_monthly
```

### 3.2 Configurer les webhooks
```bash
# Dans Developers > Webhooks > Add endpoint
Endpoint URL: https://yourdomain.com/api/billing/webhook

Events à sélectionner:
- checkout.session.completed
- invoice.payment_succeeded  
- invoice.payment_failed
- customer.subscription.updated
- customer.subscription.deleted

# Copier le webhook secret dans STRIPE_WEBHOOK_SECRET
```

### 3.3 Activer Customer Portal
```bash
# Dans Settings > Billing > Customer Portal
1. Activer le portail client
2. Configurer les options:
   - Allow customers to update payment methods: ✓
   - Allow customers to update billing details: ✓
   - Allow customers to view invoices: ✓
   - Allow customers to cancel subscriptions: ✓
```

## 🤖 Étape 4: Configuration OpenAI

### 4.1 Créer la clé API
```bash
# Via OpenAI Platform
1. Aller sur https://platform.openai.com
2. API Keys > Create new secret key  
3. Copier dans OPENAI_API_KEY
4. Configurer les limites de débit (optionnel)
```

## 🧠 Étape 5: Configuration Azure Document Intelligence

### 5.1 Créer la ressource
```bash
# Via Azure Portal
1. Créer une ressource > AI + Machine Learning
2. Form Recognizer / Document Intelligence
3. Région: West Europe (pour la conformité EU)
4. Pricing tier: F0 (gratuit) ou S0 (payant)
```

### 5.2 Récupérer les credentials
```bash
# Dans la ressource créée > Keys and Endpoint
AZURE_DOCINTEL_ENDPOINT=https://xxxxx.cognitiveservices.azure.com/
AZURE_DOCINTEL_KEY=xxxxx (Key 1)
```

## 🔄 Étape 6: Configuration n8n (optionnel)

### 6.1 Créer l'instance
```bash
# Via n8n.cloud  
1. Créer un compte sur https://n8n.cloud
2. Créer une nouvelle instance
3. Attendre le déploiement
```

### 6.2 Importer le workflow
```bash
# Dans n8n Editor
1. Importer n8n/workflows/deb-processing.json
2. Configurer les credentials:
   - Supabase (HTTP Header Auth avec SERVICE_ROLE_KEY)
   - OpenAI API Key
   - Azure Document Intelligence
3. Activer le workflow
4. Copier l'URL webhook dans N8N_WEBHOOK_DEB_INGEST_URL
```

## 🛡️ Étape 7: Configuration DNS et sécurité

### 7.1 Cloudflare (recommandé)
```bash
# Configuration DNS
1. Ajouter le domaine à Cloudflare
2. Configurer les records:
   - A record: @ -> Vercel IP
   - CNAME: www -> yourdomain.com
3. Proxy status: Orange (proxy activé)
4. SSL/TLS: Full (strict)
```

### 7.2 Sécurité supplémentaire
```bash
# Dans Cloudflare Security
1. Security Level: Medium
2. Challenge Passage: 1 hour  
3. Browser Integrity Check: On
4. Hotlink Protection: On
```

## 🧪 Étape 8: Tests de validation

### 8.1 Tests fonctionnels
```bash
# Tester manuellement:
1. Inscription utilisateur ✓
2. Création organisation ✓  
3. Upload CV et analyse ✓
4. Upload document DEB et traitement ✓
5. Paiement Stripe ✓
6. Export CSV ✓
```

### 8.2 Tests de charge (optionnel)
```bash
# Avec Artillery ou équivalent
1. Test d'authentification (100 users)
2. Test d'upload CV (50 concurrent)
3. Test API endpoints
```

## 📊 Étape 9: Monitoring et observabilité

### 9.1 Dashboards à configurer
```bash
# Vercel Analytics (intégré)
# Supabase Dashboard (DB metrics)
# Stripe Dashboard (payments)
# OpenAI Usage Dashboard
# Azure Portal (Document Intelligence)
```

### 9.2 Alertes recommandées
```bash
1. Erreur 5xx > 5% (Vercel)
2. Latence DB > 1s (Supabase)
3. Paiement échoué (Stripe webhook)
4. Quota OpenAI > 90%
5. Quota Azure > 90%
```

## 🔄 Étape 10: Sauvegarde et récupération

### 10.1 Sauvegarde base de données
```bash
# Via Supabase CLI (quotidien recommandé)
supabase db dump --local > backup-$(date +%Y%m%d).sql

# Ou via l'interface Supabase > Settings > Database
```

### 10.2 Plan de récupération
```bash
1. Backup automatique Supabase (7 jours)
2. Repository Git (code source)
3. Variables d'environnement documentées
4. Procédures de rollback Vercel
```

## 🚀 Déploiement final

### Checklist finale
```bash
- [ ] Domaine et SSL fonctionnels
- [ ] Base de données accessible et migrée  
- [ ] Authentification testée (email + Google)
- [ ] Paiements Stripe testés
- [ ] Upload et traitement CV fonctionnels
- [ ] Upload et traitement DEB fonctionnels
- [ ] Webhooks configurés et testés
- [ ] Monitoring configuré
- [ ] Sauvegardes configurées
```

### Mise en production
```bash
1. Final deploy sur Vercel
2. Test complet du funnel utilisateur  
3. Monitoring des premiers utilisateurs
4. Documentation mise à jour
```

## 🆘 Troubleshooting

### Problèmes courants

**1. Erreur CORS**
```bash
# Vérifier dans Supabase > Settings > API
- Site URL: https://yourdomain.com
- Additional URLs: https://www.yourdomain.com
```

**2. Webhook Stripe non reçu**  
```bash
# Vérifier:
- URL webhook correcte
- Secret webhook dans env vars
- Événements sélectionnés
- Logs Vercel Functions
```

**3. Upload files échoue**
```bash
# Vérifier:
- Buckets créés et privés
- Policies RLS configurées
- Signed URLs générées correctement
```

**4. OCR Azure timeout**
```bash
# Vérifier:
- Endpoint et région corrects
- Quota non dépassé
- Taille des fichiers < 50MB
```

### Logs utiles
```bash
# Vercel Functions
vercel logs --tail

# Supabase  
# Via Dashboard > Logs Explorer

# Stripe
# Via Dashboard > Events

# n8n
# Via workflow execution logs
```

## 📞 Support

En cas de problème:
1. Vérifier les logs (Vercel, Supabase, Stripe)
2. Tester en local avec les mêmes env vars  
3. Consulter la documentation des services
4. Contacter le support technique

---

**✅ Votre application CoreMatch est maintenant prête pour la production !**