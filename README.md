# CoreMatch - Solutions d'automatisation intelligente

CoreMatch est une application SaaS multi-tenant offrant deux modules principaux :

1. **CV Screening** - Analyse automatique de CV avec scoring IA
2. **DEB Assistant** - Traitement des factures intracommunautaires pour export DEB

## 🏗️ Architecture

- **Frontend**: Next.js 15 (App Router) + Tailwind CSS
- **Backend**: Next.js API routes
- **Base de données**: Supabase (PostgreSQL) avec RLS
- **Authentification**: Supabase Auth (email + Google OAuth)
- **Paiements**: Stripe (Checkout + Customer Portal + Webhooks)
- **IA**: OpenAI GPT-4o/GPT-4o-mini
- **OCR**: Azure Document Intelligence
- **Automatisation**: n8n Cloud
- **Stockage**: Supabase Storage (buckets privés)

## 📋 Fonctionnalités

### CV Screening
- Upload de 5-200 CV (PDF)
- Analyse IA avec scoring 0-100
- Gestion de projets de recrutement
- Shortlisting et export CSV
- Quotas par plan (200/1000/∞ CV/mois)

### DEB Assistant
- Upload PDF multi-pages (factures + BL scannés)
- OCR Azure + classification IA
- Extraction automatique des lignes produit
- Enrichissement données (HS codes, poids, pays d'origine)
- Répartition frais de port
- Export CSV format DEB
- Quotas par plan (200/1500/10000 pages/mois)

### Multi-tenant
- Organisations isolées (RLS)
- Rôles: org_admin, org_manager, org_viewer
- Plans: Starter (49€), Pro (149€), Scale (399€)
- Essai gratuit 14 jours
- Gestion quotas temps réel

## 🚀 Installation locale

### Prérequis

- Node.js 18+
- npm/yarn
- Compte Supabase
- Compte Stripe
- Compte OpenAI
- Compte Azure (Document Intelligence)
- Instance n8n Cloud (optionnel)

### Configuration

1. **Cloner et installer**
```bash
git clone <repository-url>
cd corematch
npm install
```

2. **Variables d'environnement**
```bash
cp .env.example .env.local
```

Remplir les variables :
```env
# Database & Auth
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI
OPENAI_API_KEY=sk-your-openai-key

# Stripe
STRIPE_PUBLIC_KEY=pk_test_your-stripe-public-key
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# Azure Document Intelligence
AZURE_DOCINTEL_ENDPOINT=https://your-region.api.cognitive.microsoft.com/
AZURE_DOCINTEL_KEY=your-azure-key

# n8n (optionnel)
N8N_WEBHOOK_DEB_INGEST_URL=https://your-n8n.app/webhook/deb/ingest

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

3. **Base de données**
```bash
# Exécuter les migrations dans Supabase SQL Editor
# Fichiers dans /supabase/migrations/
```

4. **Lancement**
```bash
npm run dev
```

## 📁 Structure du projet

```
corematch/
├── app/
│   ├── api/                    # API routes
│   │   ├── billing/           # Stripe integration
│   │   ├── cv/                # CV Screening endpoints
│   │   └── deb/               # DEB Assistant endpoints
│   ├── components/            # Composants réutilisables
│   │   ├── layout/           # Header, Footer
│   │   └── ui/               # Button, Hero, PricingTable
│   ├── dashboard/            # Multi-org selector
│   ├── org/[orgId]/         # Interface organisation
│   ├── login/               # Authentication
│   ├── pricing/             # Plans et tarifs
│   └── onboarding/          # Configuration initiale
├── lib/
│   ├── supabase/            # Clients DB
│   ├── stripe/              # Config Stripe
│   ├── openai/              # Client IA
│   ├── azure/               # Client OCR
│   ├── utils/               # Quotas, shipping, utils
│   └── types.ts             # Types TypeScript
├── supabase/
│   └── migrations/          # Scripts SQL
├── n8n/
│   └── workflows/           # Workflow d'automatisation
└── docs/
    └── DEPLOYMENT.md        # Guide de déploiement
```

## 🌐 Déploiement Production

Voir le guide détaillé dans [DEPLOYMENT.md](./DEPLOYMENT.md)

## 🔒 Sécurité

- RLS activée sur toutes les tables
- Isolation multi-tenant stricte
- Service Role Key jamais exposée côté client
- Buckets Storage privés avec signed URLs
- Validation des inputs avec Zod
- CORS configuré strictement

## 📝 Licence

Propriétaire - Tous droits réservés
