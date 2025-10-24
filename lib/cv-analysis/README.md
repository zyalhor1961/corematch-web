# 🎯 CoreMatch CV Analysis System

Système d'analyse de CV multi-provider utilisant l'IA pour évaluer automatiquement les candidatures.

**Version** : 3.0.0
**Status** : ✅ Production Ready
**Tests** : ✅ 3 Phases validées

---

## 🚀 Quick Start

### Installation

```bash
npm install @anthropic-ai/sdk @google/generative-ai openai
```

### Configuration

```bash
# Copier le fichier exemple
cp .env.example .env.local

# Éditer avec vos clés API
nano .env.local
```

**Variables minimales** :
```bash
OPENAI_API_KEY=sk-proj-...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Utilisation

```typescript
import { orchestrateAnalysis } from '@/lib/cv-analysis';

const result = await orchestrateAnalysis(cvText, jobSpec, {
  mode: 'balanced', // 'eco' | 'balanced' | 'premium'
  enablePrefilter: true,
  enablePacking: true,
});

console.log(result.final_decision.overall_score_0_to_100); // 97.5
console.log(result.final_decision.recommendation); // 'SHORTLIST'
console.log(result.cost.total_usd); // 0.0177
```

---

## 📊 Modes disponibles

| Mode | Providers | Coût/CV | Temps | Précision | Use Case |
|------|-----------|---------|-------|-----------|----------|
| **ÉCO** | OpenAI | $0.02 | ~30s | Bonne | Volume élevé, pré-screening |
| **BALANCED** ⭐ | OpenAI + Gemini* | $0.04 | ~45s | Excellente | **Production standard** |
| **PREMIUM** | OpenAI + Gemini + Claude* | $0.10 | ~75s | Maximale | Postes critiques, senior |

*Gemini et Claude appelés uniquement si incertitude détectée

---

## 🏗️ Architecture

### Phase 1 : Fondations ✅

```
types/          # 38 interfaces TypeScript
config/         # Modes, providers, domaines, seuils
schemas/        # Validation JSON (AJV)
validators/     # Validation centralisée
utils/          # Dates, normalisation
providers/      # BaseProvider abstrait
```

**185 assertions testées** ✅

### Phase 2 : Pipeline Core ✅

```
prefilter/      # Stage 0 ultra-permissif
packer/         # Compression tokens (~70% économie)
rules/          # Relevance, must-have, skills-map
providers/      # OpenAI provider
orchestrator.ts # Chef d'orchestre
```

**5 modules testés** ✅

### Phase 3 : Multi-Provider ✅

```
providers/
  ├── gemini-provider.ts   # Google Gemini 1.5 Pro
  └── claude-provider.ts   # Anthropic Claude 3.5 Sonnet
aggregator/
  └── multi-provider-aggregator.ts  # Agrégation + consensus
orchestrator.ts  # Modes BALANCED et PREMIUM
```

**3 composants testés** ✅

---

## 🎯 Fonctionnalités

### ✅ Extraction CV
- Analyse de CV texte → JSON structuré
- Support multiples formats
- Validation stricte des schémas

### ✅ Pré-filtre intelligent
- Ultra-permissif (< 5% rejet)
- Soft flags pour guidance
- Confiance calculée

### ✅ Compression tokens
- Top-K sections pertinentes
- Citations exactes conservées
- ~70% économie sur longs CVs

### ✅ Règles métier
- 4 niveaux de pertinence : DIRECTE, ADJACENTE, PÉRIPHÉRIQUE, NON_PERTINENTE
- 4 types must-have : expérience, diplôme, compétence, générique
- 50+ alias de compétences
- 5 domaines métier : Tech, Enseignement, BTP, Management, Santé

### ✅ Multi-provider
- 3 providers : OpenAI, Gemini, Claude
- Agrégation pondérée (55%, 30%, 15%)
- Consensus detection : strong / moderate / weak
- Arbitre LLM automatique

### ✅ needsMore() intelligent
- Score borderline (60-75)
- Preuves faibles (< 3 evidence)
- Écart sous-scores > 25 pts
- Must-have incertain

---

## 📝 Exemple complet

```typescript
import { orchestrateAnalysis } from '@/lib/cv-analysis';

const cvText = `
SOPHIE MARTIN
Développeuse Full Stack Senior
...
`;

const jobSpec = {
  title: 'Développeur Full Stack React/Node Senior',
  must_have: [
    {
      id: 'M1',
      desc: 'Minimum 4 ans d\'expérience en développement web Full Stack',
      severity: 'critical',
    },
    {
      id: 'M2',
      desc: 'Maîtrise avancée de React et TypeScript',
      severity: 'critical',
    },
  ],
  skills_required: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
  nice_to_have: ['Next.js', 'Kubernetes', 'Docker'],
  relevance_rules: {
    direct: ['développeur', 'dev', 'software engineer', 'full stack'],
    adjacent: ['ingénieur logiciel', 'tech lead'],
    peripheral: ['développeur mobile', 'devops'],
  },
  weights: {
    w_exp: 0.35,
    w_skills: 0.45,
    w_nice: 0.20,
    p_adjacent: 0.6,
  },
  thresholds: {
    years_full_score: 5,
    shortlist_min: 75,
    consider_min: 60,
  },
};

// Mode BALANCED (recommandé)
const result = await orchestrateAnalysis(cvText, jobSpec, {
  mode: 'balanced',
  enablePrefilter: true,
  enablePacking: true,
});

console.log('Score:', result.final_decision.overall_score_0_to_100); // 97.5
console.log('Recommendation:', result.final_decision.recommendation); // SHORTLIST
console.log('Must-have:', result.final_decision.meets_all_must_have); // true
console.log('Providers:', result.debug.providers_used); // ['openai'] ou ['openai', 'gemini']
console.log('Consensus:', result.consensus.level); // 'strong'
console.log('Coût:', result.cost.total_usd); // 0.0177
console.log('Temps:', result.performance.total_execution_time_ms, 'ms'); // ~30000

// Sous-scores
console.log('Expérience:', result.final_decision.subscores.experience_years_relevant, 'ans');
console.log('Compétences:', result.final_decision.subscores.skills_match_0_to_100, '/100');
console.log('Nice-to-have:', result.final_decision.subscores.nice_to_have_0_to_100, '/100');

// Forces identifiées
result.final_decision.strengths.forEach((strength) => {
  console.log(`${strength.category}: ${strength.point}`);
  console.log(`  Evidence: "${strength.evidence[0].quote}"`);
});

// Expériences pertinentes
const directExps = result.final_decision.relevance_summary.by_experience
  .filter((e) => e.relevance === 'DIRECTE');

console.log(`Expériences DIRECTE: ${directExps.length}`);
directExps.forEach((exp) => {
  console.log(`- ${exp.titre} (${exp.months} mois): ${exp.reason}`);
});
```

---

## 🧪 Tests

### Phase 1 (Fondations)
```bash
npx tsx lib/cv-analysis/__tests__/run-all.ts
```
**Résultat** : 185 assertions ✅

### Phase 2 (Pipeline Core)
```bash
npx tsx lib/cv-analysis/__tests__/phase2-integration.test.ts
```
**Résultat** : 5 modules testés ✅

### Phase 3 (Multi-Provider)
```bash
npx tsx lib/cv-analysis/__tests__/phase3-integration.test.ts
```
**Résultat** : Aggregator, consensus, providers ✅

### Test complet multi-provider
```bash
npx tsx lib/cv-analysis/__tests__/multi-provider-real.test.ts
```
**Résultat** : Comparaison 3 modes avec CV réel ✅

---

## 📦 Déploiement

Voir [DEPLOYMENT.md](./DEPLOYMENT.md) pour le guide complet.

**Résumé** :
```bash
# 1. Configurer variables Vercel
OPENAI_API_KEY=sk-proj-...
GOOGLE_GENERATIVE_AI_API_KEY=AIzaSy...

# 2. Installer dépendances
npm install @anthropic-ai/sdk @google/generative-ai

# 3. Déployer
git push origin main
```

---

## 💰 Coûts estimés

### Par CV analysé

| Mode | OpenAI | Gemini | Claude | Total | Providers |
|------|--------|--------|--------|-------|-----------|
| ÉCO | $0.017 | - | - | **$0.017** | 1 |
| BALANCED | $0.017 | $0.015* | - | **$0.017-0.032** | 1-2 |
| PREMIUM | $0.017 | $0.015 | $0.018 | **$0.050** | 3 |

*Appelé uniquement si incertitude

### Volume mensuel (estimations)

| Volume | Mode ÉCO | Mode BALANCED | Mode PREMIUM |
|--------|----------|---------------|--------------|
| 100 CVs | $1.70 | $2.40 | $5.00 |
| 500 CVs | $8.50 | $12.00 | $25.00 |
| 1000 CVs | $17.00 | $24.00 | $50.00 |
| 5000 CVs | $85.00 | $120.00 | $250.00 |

---

## 🔧 Configuration avancée

### Customiser les poids

```typescript
const jobSpec = {
  // ...
  weights: {
    w_exp: 0.5,      // 50% poids expérience
    w_skills: 0.3,   // 30% poids compétences
    w_nice: 0.2,     // 20% poids nice-to-have
    p_adjacent: 0.6, // Expériences adjacentes = 60% pertinence
  },
};
```

### Customiser les seuils

```typescript
const jobSpec = {
  // ...
  thresholds: {
    years_full_score: 5,  // 5 ans = score expérience maximal
    shortlist_min: 75,    // ≥75 = SHORTLIST
    consider_min: 60,     // ≥60 = CONSIDER, <60 = REJECT
  },
};
```

### Domaines métier

Le système détecte automatiquement le domaine depuis le titre du poste :
- **Tech** : développeur, data, ingénieur
- **Enseignement** : professeur, formateur, FLE
- **BTP** : peintre, électricien, maçon
- **Management** : manager, directeur, chef de projet
- **Santé** : infirmier, médecin, aide-soignant

Chaque domaine a des poids optimisés.

---

## 📚 Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture Phase 1
- [PHASE_2_COMPLETE.md](./PHASE_2_COMPLETE.md) - Pipeline Core
- [PHASE_3_COMPLETE.md](./PHASE_3_COMPLETE.md) - Multi-Provider
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Guide déploiement

---

## 🤝 Contributing

Ce système est production-ready mais peut être amélioré :

**Prochaines améliorations** :
- [ ] Cache Redis pour CVs déjà analysés
- [ ] Rate limiting intelligent
- [ ] Embeddings sémantiques pour relevance
- [ ] Dashboard analytics temps réel
- [ ] Support PDFs natifs
- [ ] API REST standalone

---

## 📊 Statistiques du projet

| Métrique | Valeur |
|----------|--------|
| **Fichiers créés** | 28 |
| **Lignes de code** | ~6200 |
| **Interfaces TypeScript** | 38 |
| **Tests** | 193 assertions |
| **Providers** | 3 (OpenAI, Gemini, Claude) |
| **Modes** | 3 (ÉCO, BALANCED, PREMIUM) |
| **Domaines métier** | 5 |
| **Alias compétences** | 50+ |

---

## ⚖️ License

Propriétaire - CoreMatch © 2025

---

## 🎉 Remerciements

Développé avec :
- OpenAI GPT-4o
- Google Gemini 1.5 Pro
- Anthropic Claude 3.5 Sonnet
- TypeScript + Next.js
- Supabase

---

**🚀 Prêt pour production! Questions? Consulter la documentation complète.**
