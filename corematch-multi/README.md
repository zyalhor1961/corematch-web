# CoreMatch Multi-Provider CV Analysis

Système d'analyse de CV générique (tous métiers) avec double validation OpenAI + Google Gemini, agrégation intelligente et traçabilité complète.

## 📋 Architecture

```
┌──────────────┐
│   CV Text    │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────┐
│  PASS 1: Extraction (gpt-4o-mini)    │
│  - Température = 0                   │
│  - JSON validé par AJV               │
└──────┬───────────────────────────────┘
       │
       ▼
    CV_JSON
       │
       ├─────────────────┬─────────────────┐
       │                 │                 │
       ▼                 ▼                 ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  JOB_SPEC   │   │  JOB_SPEC   │   │             │
└──────┬──────┘   └──────┬──────┘   │             │
       │                 │           │             │
       ▼                 ▼           ▼             │
┌─────────────┐   ┌─────────────┐                │
│ PASS 2a:    │   │ PASS 2b:    │                │
│ OpenAI      │   │ Gemini      │ (Parallèle)    │
│ gpt-4o      │   │ 1.5-pro     │                │
└──────┬──────┘   └──────┬──────┘                │
       │                 │                        │
       └────────┬────────┘                        │
                │                                 │
                ▼                                 │
       ┌─────────────────┐                       │
       │  Validation AJV  │                       │
       │   (2 outputs)    │                       │
       └────────┬─────────┘                       │
                │                                 │
                ▼                                 │
       ┌─────────────────┐                       │
       │   Agrégation    │◄──────────────────────┘
       │   + Vote        │
       │   + Consensus   │
       └────────┬─────────┘
                │
                ▼
       ┌─────────────────┐
       │ Résultat Final  │
       │ + Traçabilité   │
       │ + Debug         │
       └─────────────────┘
```

## 🎯 Fonctionnalités

### ✅ Pass 1 : Extraction Neutre
- **Modèle :** OpenAI `gpt-4o-mini`
- **Température :** 0 (déterministe)
- **Output :** JSON validé avec AJV
- **Principe :** Extraction sans jugement, aucune invention

### ✅ Pass 2 : Analyse Parallèle
- **Provider 1 :** OpenAI `gpt-4o`
- **Provider 2 :** Gemini `gemini-1.5-pro`
- **Température :** 0 (déterministe)
- **System Prompt :** Universel (tous métiers)
- **Output :** JSON validé avec AJV
- **Concurrency :** p-limit(3)
- **Retry :** 2 tentatives avec backoff exponentiel

### ✅ Pass 3 : Agrégation Intelligente
- **meets_all_must_have :** AND (les deux doivent passer)
- **fails :** Union dédupliquée par `rule_id`
- **subscores :** Moyenne pondérée (OpenAI 55%, Gemini 45%)
- **overall_score :** Moyenne pondérée
- **recommendation :** Vote majoritaire avec priorité REJECT
- **consensus :** Fort/Moyen/Faible basé sur l'écart des scores

### ✅ Auto-génération de relevance_rules
- Si `relevance_rules` manquant → génération automatique
- Basé sur le titre du poste et les compétences requises
- Loggé dans `debug.rules_applied`

### ✅ Fallback Robuste
- Si OpenAI échoue → Utilise Gemini seul
- Si Gemini échoue → Utilise OpenAI seul
- Si les deux échouent → Erreur
- Timeout : 30s par appel

### ✅ Traçabilité Complète
- **providers_raw :** Résultats bruts de chaque provider
- **debug.model_disagreements :** Écarts significatifs
- **debug.providers_used :** Providers effectivement utilisés
- **debug.aggregation_method :** Méthode d'agrégation
- **consensus :** Niveau de consensus (fort/moyen/faible)

## 📦 Installation

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck
```

## ⚙️ Configuration

Créez un fichier `.env` à partir de `.env.example`:

```env
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=AIza...
CM_STAGE1_MODEL=gpt-4o-mini
CM_STAGE2_OPENAI=gpt-4o
CM_STAGE2_GEMINI=gemini-1.5-pro
DEBUG=false
```

## 🚀 Utilisation

### API Programmatique

```typescript
import { analyzeCV } from 'corematch-multi';
import type { JobSpec } from 'corematch-multi';

const cvText = `
Jean Dupont
Développeur Full Stack Senior
5 ans d'expérience en React, Node.js, TypeScript
...
`;

const jobSpec: JobSpec = {
  title: 'Développeur Full Stack',
  must_have: [
    {
      id: 'M1',
      desc: 'Minimum 3 ans d\'expérience',
      severity: 'critical'
    }
  ],
  skills_required: ['JavaScript', 'React', 'Node.js'],
  nice_to_have: ['TypeScript', 'Docker'],
  // relevance_rules optional - auto-généré si manquant
  weights: {
    w_exp: 0.5,
    w_skills: 0.3,
    w_nice: 0.2,
    p_adjacent: 0.5
  },
  thresholds: {
    years_full_score: 3,
    shortlist_min: 75,
    consider_min: 60
  }
};

const result = await analyzeCV(cvText, jobSpec);

console.log('Score:', result.final_decision.overall_score_0_to_100);
console.log('Recommendation:', result.final_decision.recommendation);
console.log('Consensus:', result.consensus);
console.log('Disagreements:', result.debug.model_disagreements.length);
```

### Structure du Résultat

```typescript
interface AggregatedResult {
  final_decision: EvaluationOutput;  // Résultat agrégé final
  providers_raw: {
    openai?: EvaluationOutput;      // Résultat brut OpenAI
    gemini?: EvaluationOutput;       // Résultat brut Gemini
  };
  consensus: 'fort' | 'moyen' | 'faible';  // Niveau de consensus
  debug: {
    model_disagreements: Array<{     // Désaccords entre modèles
      field: string;
      openai_value: unknown;
      gemini_value: unknown;
      delta?: number;
    }>;
    providers_used: string[];        // ['openai', 'gemini']
    aggregation_method: string;      // 'weighted_average' | 'fallback_openai' | 'fallback_gemini'
  };
}
```

## 📊 Règles d'Agrégation

| Champ | Méthode | Détails |
|-------|---------|---------|
| `meets_all_must_have` | AND | Les deux doivent passer |
| `fails` | Union | Dédupliqué par `rule_id` |
| `subscores` | Moyenne pondérée | OpenAI 55%, Gemini 45% |
| `overall_score` | Moyenne pondérée | OpenAI 55%, Gemini 45% |
| `recommendation` | Vote | SHORTLIST > CONSIDER > REJECT |
| `relevance_summary.months_*` | Moyenne | Arrondi à l'entier |
| `strengths` | Concaténation | Dédupliqué par `point` |
| `improvements` | Concaténation | Dédupliqué par `point` |

### Calcul du Consensus

- **Fort :** Δ score < 5 points ET même recommendation
- **Moyen :** Δ score < 15 points OU même recommendation
- **Faible :** Désaccord significatif

## 🧪 Tests

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch
```

Les tests couvrent :
- Validation des schémas JSON
- Classification des expériences (DIRECTE/ADJACENTE/PÉRIPHÉRIQUE)
- Calcul des scores et sous-scores
- Agrégation et consensus
- Fallback en cas d'échec provider

## 🔍 Validation JSON

### Schéma CV (`schema.cv.json`)
- **identite :** nom, prenom, email, etc.
- **experiences :** titre, debut_iso, fin_iso, en_cours, missions
- **formations :** intitule, niveau, obtention_iso
- **competences :** Array de strings
- **langues :** langue + niveau

### Schéma Output (`schema.output.json`)
- **meets_all_must_have :** boolean
- **fails :** Array de règles échouées
- **relevance_summary :** Mois par catégorie + détail par expérience
- **subscores :** experience_years_relevant, skills_match, nice_to_have
- **overall_score_0_to_100 :** Score final (0-100)
- **recommendation :** SHORTLIST | CONSIDER | REJECT
- **strengths :** Points forts avec preuves
- **improvements :** Points à améliorer

## ⚡ Performance

**Temps d'exécution typique :**
- Pass 1 (Extraction) : ~2-4 secondes
- Pass 2 (Analyse parallèle) : ~5-8 secondes
- Pass 3 (Agrégation) : ~100ms
- **Total : ~7-12 secondes**

**Optimisations :**
- Appels API en parallèle avec p-limit
- Validation AJV compilée (pas de recompilation)
- Retry avec backoff exponentiel
- Timeout 30s par appel

## 🔒 Sécurité

- ✅ Validation stricte des schémas JSON
- ✅ Pas d'exécution de code arbitraire
- ✅ Données sensibles ignorées (âge, origine, genre, santé)
- ✅ API keys en variables d'environnement

## 📝 Licence

CoreMatch © 2025 - Tous droits réservés

## 🤝 Contribution

Ce package est destiné à un usage interne CoreMatch. Pour toute question, contacter l'équipe technique.
