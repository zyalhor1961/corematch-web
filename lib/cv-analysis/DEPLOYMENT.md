# 🚀 Déploiement du système CV Analysis

Guide pour déployer CoreMatch CV Analysis sur Vercel et autres plateformes.

---

## 📋 Variables d'environnement requises

### 🔴 **OBLIGATOIRES** (pour tous les modes)

```bash
# OpenAI - Utilisé pour tous les modes (ÉCO, BALANCED, PREMIUM)
OPENAI_API_KEY=sk-proj-...

# Supabase - Base de données
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
```

### 🟡 **OPTIONNELLES** (pour modes avancés)

```bash
# Google Gemini - Pour modes BALANCED et PREMIUM
# ⚠️ IMPORTANT: Vous pouvez utiliser l'un OU l'autre de ces noms
GEMINI_API_KEY=AIzaSy...
# OU
GOOGLE_GENERATIVE_AI_API_KEY=AIzaSy...

# Anthropic Claude - Pour mode PREMIUM uniquement
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 🎯 Modes disponibles et leurs besoins

| Mode | Providers | Clés requises | Coût/CV | Temps | Use Case |
|------|-----------|---------------|---------|-------|----------|
| **ÉCO** | OpenAI | `OPENAI_API_KEY` | $0.02 | ~30s | Volume élevé |
| **BALANCED** | OpenAI + Gemini* | `OPENAI_API_KEY`<br/>`GEMINI_API_KEY` | $0.04 | ~45s | Production ⭐ |
| **PREMIUM** | OpenAI + Gemini + Claude* | Toutes les 3 | $0.10 | ~75s | Postes critiques |

*Gemini et Claude sont appelés uniquement si nécessaire (incertitude détectée)

---

## 📦 Déploiement sur Vercel

### Étape 1 : Configuration des variables d'environnement

#### Via l'interface Vercel :

1. Aller sur [vercel.com/dashboard](https://vercel.com/dashboard)
2. Sélectionner votre projet CoreMatch
3. **Settings** → **Environment Variables**
4. Ajouter les variables suivantes :

**Variables obligatoires** :
```
OPENAI_API_KEY = sk-proj-...
NEXT_PUBLIC_SUPABASE_URL = https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbG...
SUPABASE_SERVICE_ROLE_KEY = eyJhbG...
```

**Variables optionnelles (recommandées)** :
```
GOOGLE_GENERATIVE_AI_API_KEY = AIzaSy...
```

> 💡 **Note** : Vercel accepte `GOOGLE_GENERATIVE_AI_API_KEY` (nom standard Google)

#### Via Vercel CLI :

```bash
# Obligatoires
vercel env add OPENAI_API_KEY production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production

# Optionnelles
vercel env add GOOGLE_GENERATIVE_AI_API_KEY production
vercel env add ANTHROPIC_API_KEY production
```

### Étape 2 : Build Settings

Vérifier dans **Settings** → **Build & Development Settings** :

```
Framework Preset: Next.js
Build Command: npm run build
Output Directory: .next
Install Command: npm install
```

### Étape 3 : Déploiement

```bash
# Push vers Git (déploiement automatique)
git add .
git commit -m "feat: Add multi-provider CV analysis system"
git push origin main

# OU déploiement manuel via CLI
vercel --prod
```

### Étape 4 : Vérification

1. Ouvrir votre application sur Vercel
2. Tester l'analyse d'un CV
3. Vérifier les logs : **Deployments** → **View Function Logs**

---

## 🔍 Vérification des clés API

### Test local :

```bash
# Créer .env.local
cp .env.example .env.local

# Éditer .env.local avec vos vraies clés
nano .env.local

# Tester le système
npx tsx lib/cv-analysis/__tests__/phase3-integration.test.ts
```

**Résultat attendu** :
```
✅ Aggregator: Working
✅ Available providers: 2/3
✅ Multi-provider aggregation: Working
✅ Consensus detection: Working
```

### Test sur Vercel :

Créer une route de test : `app/api/test-cv-analysis/route.ts`

```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  const providers = {
    openai: !!process.env.OPENAI_API_KEY,
    gemini: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY),
    claude: !!process.env.ANTHROPIC_API_KEY,
  };

  return NextResponse.json({
    status: 'ok',
    providers,
    available: Object.values(providers).filter(Boolean).length,
  });
}
```

Puis visiter : `https://your-app.vercel.app/api/test-cv-analysis`

---

## 🔐 Sécurité des clés API

### ✅ **À FAIRE** :

1. **Ne jamais commiter** `.env.local` ou `.env` dans Git
2. **Utiliser** `.env.example` pour documenter les variables
3. **Rotation** régulière des clés (tous les 3-6 mois)
4. **Limiter** les permissions des clés (read-only si possible)
5. **Monitorer** l'utilisation via les dashboards des providers

### ❌ **À NE PAS FAIRE** :

1. Ne pas exposer les clés côté client (pas de `NEXT_PUBLIC_` pour les clés API)
2. Ne pas logger les clés dans les erreurs
3. Ne pas partager les clés production en équipe (1 clé par environnement)

---

## 💰 Gestion des coûts

### Limites recommandées :

Configurer des **Usage Limits** dans chaque dashboard provider :

| Provider | Limite mensuelle recommandée | Configuration |
|----------|------------------------------|---------------|
| **OpenAI** | $100/mois (≈5000 CVs) | [platform.openai.com/settings](https://platform.openai.com/settings) |
| **Gemini** | $50/mois (≈3000 CVs) | [console.cloud.google.com/billing](https://console.cloud.google.com/billing) |
| **Claude** | $50/mois (≈2500 CVs) | [console.anthropic.com/settings](https://console.anthropic.com/settings) |

### Monitoring :

```typescript
// Exemple de monitoring côté serveur
import { orchestrateAnalysis } from '@/lib/cv-analysis';

const result = await orchestrateAnalysis(cvText, jobSpec, {
  mode: 'balanced',
  enablePrefilter: true,
  enablePacking: true,
});

// Logger le coût
console.log(`[CV Analysis] Cost: $${result.cost.total_usd.toFixed(4)}`);
console.log(`[CV Analysis] Providers: ${result.debug.providers_used.join(', ')}`);

// Enregistrer dans une DB pour analytics
await supabase.from('cv_analysis_costs').insert({
  cost_usd: result.cost.total_usd,
  mode: result.debug.mode,
  providers_count: result.debug.providers_used.length,
  created_at: new Date(),
});
```

---

## 🐛 Troubleshooting

### Problème : "GEMINI_API_KEY not found"

**Solution** : Vercel utilise `GOOGLE_GENERATIVE_AI_API_KEY`. Le code supporte les deux noms.

```bash
# Sur Vercel, utiliser ce nom
GOOGLE_GENERATIVE_AI_API_KEY=AIzaSy...

# En local, vous pouvez utiliser
GEMINI_API_KEY=AIzaSy...
```

### Problème : "Module not found @anthropic-ai/sdk"

**Solution** : Installer les dépendances manquantes

```bash
npm install @anthropic-ai/sdk @google/generative-ai
```

### Problème : "Rate limit exceeded"

**Solution** : Configurer un système de queue ou augmenter les limites

```typescript
// Ajouter un délai entre les analyses
await new Promise(resolve => setTimeout(resolve, 1000));
```

### Problème : Timeout sur Vercel

Vercel Functions timeout après **10 secondes** par défaut.

**Solution** : Augmenter le timeout dans `vercel.json` :

```json
{
  "functions": {
    "app/api/cv/analyze/route.ts": {
      "maxDuration": 60
    }
  }
}
```

> ⚠️ Limite Hobby plan : 10s. Pro plan : 60s. Enterprise : 900s.

---

## 📊 Monitoring en production

### Logs Vercel :

```bash
# Suivre les logs en temps réel
vercel logs --follow

# Filtrer par fonction
vercel logs --follow --filter="cv-analysis"
```

### Métriques à surveiller :

1. **Temps d'exécution** : Doit rester < 60s
2. **Taux d'erreur** : < 1%
3. **Coût par CV** : $0.02-0.10 selon le mode
4. **Providers utilisés** : Ratio eco/balanced/premium

---

## 🎯 Recommandations de production

1. **Utiliser mode BALANCED** en production (meilleur rapport qualité/prix)
2. **Activer le packing** pour économiser des tokens
3. **Monitorer les coûts** quotidiennement au début
4. **Configurer des alertes** pour les erreurs provider
5. **Implémenter un cache** Redis pour les CVs déjà analysés (futur)

---

## ✅ Checklist de déploiement

- [ ] Variables d'environnement configurées sur Vercel
- [ ] Tests locaux passés
- [ ] Dépendances installées (`@anthropic-ai/sdk`, `@google/generative-ai`)
- [ ] `.env.local` ajouté au `.gitignore`
- [ ] Limites de coût configurées sur OpenAI/Gemini/Claude
- [ ] Timeout Vercel augmenté si nécessaire (Pro plan)
- [ ] Monitoring configuré
- [ ] Route de test `/api/test-cv-analysis` créée
- [ ] Premier déploiement testé avec un CV réel

---

**🎉 Système prêt pour production!**

Pour toute question : consulter `lib/cv-analysis/PHASE_3_COMPLETE.md`
