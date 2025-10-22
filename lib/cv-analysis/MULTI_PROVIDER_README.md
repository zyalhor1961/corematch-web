# 🤖 Système d'Analyse CV Multi-Provider

Analyse de CV générique (tous métiers) avec double validation **OpenAI + Google Gemini**, agrégation intelligente et traçabilité complète.

---

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
       └────────┬─────────┘
                │
                ▼
       ┌─────────────────┐
       │ Résultat Final  │
       │ + Traçabilité   │
       │ + Debug         │
       └─────────────────┘
```

---

## 🎯 Fonctionnalités Clés

### ✅ Pass 1 : Extraction Neutre
- **Modèle :** OpenAI `gpt-4o-mini`
- **Température :** 0 (déterministe)
- **Output :** JSON validé (`cv.schema.json`)
- **Principe :** Extraction sans jugement, aucune invention

### ✅ Pass 2 : Analyse Parallèle
- **Provider 1 :** OpenAI `gpt-4o`
- **Provider 2 :** Gemini `gemini-1.5-pro`
- **Température :** 0 (déterministe)
- **System Prompt :** Universel (tous métiers)
- **Output :** JSON validé (`output.schema.json`)

### ✅ Agrégation Intelligente
- **meets_all_must_have :** AND (les deux doivent passer)
- **fails :** Union dédupliquée par `rule_id`
- **subscores :** Moyenne pondérée (OpenAI 55%, Gemini 45%)
- **overall_score :** Moyenne pondérée
- **recommendation :** Vote majoritaire avec priorité REJECT
- **relevance_summary :** Moyennes arrondies (entiers)
- **strengths/improvements :** Concaténation dédupliquée

### ✅ Fallback Robuste
- Si OpenAI échoue → Utilise Gemini seul
- Si Gemini échoue → Utilise OpenAI seul
- Si les deux échouent → Erreur

### ✅ Traçabilité Complète
- **providers_raw.openai :** Résultat brut OpenAI
- **providers_raw.gemini :** Résultat brut Gemini
- **debug.model_disagreements :** Liste des écarts (field, openai_value, gemini_value)
- **debug.providers_used :** Providers effectivement utilisés
- **debug.aggregation_method :** Méthode appliquée

### ✅ Preuves Traçables
- Chaque décision a des `evidence` avec `quote` + `field_path`
- Exemple : `{ quote: "5 ans React", field_path: "experiences[1].missions[0]" }`

---

## 📦 Installation

```bash
npm install ajv @google/generative-ai openai
```

**Variables d'environnement :**
```env
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
```

---

## 🚀 Utilisation

### API Endpoint

**POST** `/api/cv/analyze-multi-provider`

**Headers:**
```
Authorization: Bearer <supabase_access_token>
Content-Type: application/json
```

**Body:**
```json
{
  "cvText": "Jean Dupont\n5 ans développeur React...",
  "jobSpec": {
    "title": "Développeur Full Stack",
    "must_have": [
      {
        "id": "M1",
        "desc": "Minimum 3 ans d'expérience en développement web",
        "severity": "standard"
      }
    ],
    "skills_required": ["JavaScript", "React", "Node.js"],
    "nice_to_have": ["TypeScript", "Docker"],
    "relevance_rules": {
      "direct": ["développeur", "programmer"],
      "adjacent": ["analyste", "chef de projet technique"],
      "peripheral": ["IT", "informatique"]
    },
    "weights": {
      "w_exp": 0.5,
      "w_skills": 0.3,
      "w_nice": 0.2,
      "p_adjacent": 0.5
    },
    "thresholds": {
      "years_full_score": 3,
      "shortlist_min": 75,
      "consider_min": 60
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "evaluation": {
      "meets_all_must_have": true,
      "fails": [],
      "relevance_summary": {
        "months_direct": 60,
        "months_adjacent": 12,
        "months_peripheral": 0,
        "months_non_pertinent": 0,
        "by_experience": [...]
      },
      "subscores": {
        "experience_years_relevant": 5.5,
        "skills_match_0_to_100": 87,
        "nice_to_have_0_to_100": 50
      },
      "overall_score_0_to_100": 82.3,
      "recommendation": "SHORTLIST",
      "strengths": [
        {
          "point": "5 ans d'expérience React",
          "evidence": [
            {
              "quote": "Développeur React Senior - 5 ans",
              "field_path": "experiences[0].titre"
            }
          ]
        }
      ],
      "improvements": [
        {
          "point": "Manque d'expérience Docker",
          "why": "Docker est un nice-to-have pour ce poste",
          "suggested_action": "Formation Docker recommandée"
        }
      ]
    },
    "providers_raw": {
      "openai": { /* Résultat brut OpenAI */ },
      "gemini": { /* Résultat brut Gemini */ }
    },
    "debug": {
      "model_disagreements": [
        {
          "field": "subscores.skills_match",
          "openai_value": 90,
          "gemini_value": 85
        }
      ],
      "providers_used": ["openai", "gemini"],
      "aggregation_method": "weighted_average"
    }
  },
  "metadata": {
    "analyzed_by": "user@example.com",
    "timestamp": "2025-01-22T19:30:00.000Z",
    "providers_used": ["openai", "gemini"],
    "disagreements_count": 1
  }
}
```

### Utilisation Programmatique

```typescript
import { analyzeCV } from '@/lib/cv-analysis/multi-provider-analyzer';
import type { JobSpec } from '@/lib/cv-analysis/deterministic-evaluator';

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
      severity: 'standard'
    }
  ],
  skills_required: ['JavaScript', 'React', 'Node.js'],
  nice_to_have: ['TypeScript', 'Docker'],
  relevance_rules: {
    direct: ['développeur', 'programmer'],
    adjacent: ['analyste'],
    peripheral: ['IT']
  },
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

console.log('Score:', result.result.overall_score_0_to_100);
console.log('Recommendation:', result.result.recommendation);
console.log('Providers:', result.debug.providers_used);
console.log('Disagreements:', result.debug.model_disagreements.length);
```

---

## 🔍 Validation JSON

### Schéma CV (`cv.schema.json`)
- **identite :** prenom, nom, email, telephone, etc.
- **experiences :** index, titre, employeur, dates, missions
- **formations :** index, intitule, etablissement, annee
- **competences :** Array de strings
- **langues :** langue + niveau
- **certifications :** nom, organisme, date
- **projets :** titre, description, technologies

### Schéma Output (`output.schema.json`)
- **meets_all_must_have :** boolean
- **fails :** Array de { rule_id, reason, evidence }
- **relevance_summary :** months_direct/adjacent/peripheral/non_pertinent + by_experience
- **subscores :** experience_years_relevant, skills_match_0_to_100, nice_to_have_0_to_100
- **overall_score_0_to_100 :** number (0-100)
- **recommendation :** SHORTLIST | CONSIDER | REJECT
- **strengths :** Array de { point, evidence }
- **improvements :** Array de { point, why, suggested_action }

---

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

### Priorités de Recommandation
1. Si un must-have **critical** échoue → **REJECT**
2. Si au moins un provider dit **SHORTLIST** → **SHORTLIST**
3. Si au moins un provider dit **CONSIDER** → **CONSIDER**
4. Sinon → **REJECT**

---

## 🐛 Debug & Désaccords

Le champ `debug.model_disagreements` liste tous les écarts significatifs :

```json
{
  "field": "subscores.skills_match",
  "openai_value": 90,
  "gemini_value": 85
}
```

**Seuils de désaccord :**
- `subscores.skills_match` : Δ > 10 points
- `overall_score` : Δ > 10 points
- `recommendation` : Toujours loggé si différent
- `meets_all_must_have` : Toujours loggé si différent

---

## ⚡ Performance

**Temps d'exécution typique :**
- Pass 1 (Extraction) : ~2-4 secondes
- Pass 2 (Analyse parallèle) : ~5-8 secondes
- Agrégation : ~100ms
- **Total : ~7-12 secondes**

**Optimisations :**
- Appels API en parallèle (OpenAI + Gemini simultanément)
- Validation AJV compilée (pas de recompilation)
- Fallback immédiat si un provider échoue

---

## 🔒 Sécurité

- ✅ Authentication requise (Bearer token)
- ✅ Validation stricte des schémas JSON
- ✅ Pas d'exécution de code arbitraire
- ✅ Logs sécurisés (pas de CVs en clair dans les logs)
- ✅ Rate limiting recommandé (à implémenter dans middleware)

---

## 📈 Métriques

**À tracker :**
- Taux de succès par provider (OpenAI vs Gemini)
- Taux de fallback (combien de fois un provider échoue)
- Nombre moyen de désaccords
- Distribution des recommandations finales
- Temps d'exécution par étape

---

## 🧪 Tests

**Test manuel :**
```bash
curl -X POST https://yourdomain.com/api/cv/analyze-multi-provider \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cvText": "...",
    "jobSpec": { ... }
  }'
```

**Tests unitaires recommandés :**
- Extraction avec CVs valides/invalides
- Analyse avec différents JobSpecs
- Agrégation avec résultats identiques/divergents
- Fallback quand un provider échoue
- Validation JSON avec schémas

---

## 🚨 Gestion d'Erreurs

| Erreur | Code | Cause | Solution |
|--------|------|-------|----------|
| Authentication required | 401 | Token manquant/invalide | Vérifier le token |
| cvText/jobSpec required | 400 | Body incomplet | Fournir cvText ET jobSpec |
| CV extraction validation failed | 500 | Schéma CV invalide | Vérifier le CV extrait |
| OpenAI output validation failed | 500 | Schéma output invalide | Bug OpenAI (utilise Gemini) |
| Gemini output validation failed | 500 | Schéma output invalide | Bug Gemini (utilise OpenAI) |
| Both providers failed | 500 | Les deux providers échouent | Vérifier API keys + logs |

---

## 📝 Licence

CoreMatch © 2025 - Tous droits réservés
