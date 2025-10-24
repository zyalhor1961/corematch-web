# Architecture du système d'analyse CV CoreMatch

**Version**: Phase 1 (Fondations) ✅
**Date**: 2025-01-24

---

## 📁 Structure des dossiers

```
lib/cv-analysis/
├── types/                      # Types TypeScript centralisés
│   ├── cv.types.ts            # Structure CV (extraction)
│   ├── evaluation.types.ts    # Évaluation et scoring
│   ├── consensus.types.ts     # Multi-provider et agrégation
│   └── index.ts               # Exports centralisés
│
├── config/                     # Configuration centralisée
│   ├── modes.ts               # Modes Éco/Équilibré/Premium
│   ├── providers.ts           # Configuration OpenAI/Gemini/Claude
│   ├── thresholds.ts          # Seuils et poids par domaine métier
│   └── index.ts               # Exports
│
├── schemas/                    # Schémas JSON pour validation
│   ├── cv.schema.json         # Validation CV extrait
│   ├── output.schema.json     # Validation résultat évaluation
│   └── aggregated-result.schema.json  # Validation résultat agrégé
│
├── validators/                 # Validation AJV centralisée
│   └── index.ts               # Validators compilés + helpers
│
├── utils/                      # Utilitaires
│   ├── dates.ts               # Gestion dates et périodes
│   ├── normalize.ts           # Normalisation texte/compétences
│   └── index.ts               # Exports
│
├── providers/                  # Providers IA
│   └── base-provider.ts       # Interface abstraite commune
│
└── ARCHITECTURE.md            # Ce fichier

```

---

## 🎯 Objectifs de la Phase 1

Poser les **fondations solides** pour le système multi-provider :

✅ **Types stricts** : Contrats clairs entre tous les modules
✅ **Configuration centralisée** : Modes, providers, seuils au même endroit
✅ **Validation robuste** : AJV pour garantir la structure JSON
✅ **Utilitaires réutilisables** : Dates et normalisation
✅ **Interface provider** : Base commune pour OpenAI/Gemini/Claude

---

## 📝 Types (`types/`)

### **cv.types.ts**
Structure du CV extrait :
- `CV_JSON` : Format complet (identité, expériences, formations, compétences)
- `CV_ExtractionMetadata` : Métadonnées (hash, date, modèle extracteur)

### **evaluation.types.ts**
Évaluation et scoring :
- `JobSpec` : Spécification du poste (must_have, skills, thresholds)
- `EvaluationResult` : Résultat d'analyse (score, recommandation, preuves)
- `Evidence` : Preuve avec citation et field_path

### **consensus.types.ts**
Multi-provider et consensus :
- `AnalysisMode` : Éco / Équilibré / Premium
- `ConsensusMetrics` : Niveau de consensus, delta, désaccords
- `AggregatedResult` : Résultat final avec traçabilité complète
- `NeedsMoreAnalysis` : Triggers pour mode balanced

---

## ⚙️ Configuration (`config/`)

### **modes.ts**
Configuration des 3 modes d'analyse :

| Mode | Providers | Arbitre | Coût | Latence |
|------|-----------|---------|------|---------|
| **Éco** | 1 (OpenAI) | ❌ | ×1.0 | 5s |
| **Équilibré** | 1-2 (conditionnel) | ✅ (si triggers) | ×1.3 | 7s |
| **Premium** | 3 (OpenAI+Gemini+Claude) | ✅ | ×3.5 | 15s |

**Triggers mode Équilibré** (`UNCERTAINTY_THRESHOLDS`) :
- Score borderline (entre consider_min et shortlist_min)
- Écart entre sous-scores > 25 pts
- Preuves faibles (< 3 evidence)
- Confiance < 70%

### **providers.ts**
Configuration des providers IA :
- **OpenAI** : gpt-4o (poids 55%)
- **Gemini** : gemini-1.5-pro (poids 30%)
- **Claude** : claude-3-5-sonnet (poids 15%)

Fonctions utiles :
- `getProvidersForMode()` : Liste des providers selon le mode
- `normalizeWeights()` : Normalise les poids pour sommer à 1.0
- `calculateProviderCost()` : Calcule le coût d'un appel

### **thresholds.ts**
Seuils par domaine métier :
- **Tech** : Valorise les compétences (w_skills = 45%)
- **Teaching** : Valorise l'expérience (w_exp = 60%)
- **Construction** : Seuils plus bas, peu de transfert
- **Management** : Expérience + soft skills
- **Healthcare** : Seuils élevés (sécurité)

Fonctions utiles :
- `detectDomain()` : Détecte le domaine depuis le titre du poste
- `mergeConfig()` : Merge config domaine + custom

---

## ✅ Validation (`validators/`)

Validation AJV centralisée avec 3 schémas :
- `validateCVData()` : Valide un CV_JSON
- `validateEvaluationResult()` : Valide un EvaluationResult
- `validateAggregatedResultData()` : Valide un AggregatedResult

**Usage** :
```typescript
import { initValidators, validateCVData } from './validators';

// Au démarrage
initValidators();

// Validation
const result = validateCVData(data);
if (!result.valid) {
  console.error(result.errorMessage);
}
```

**Assertions** (throw on error) :
```typescript
import { assertValidCV } from './validators';

// Throw si invalide
assertValidCV(data);
```

---

## 🛠️ Utilitaires (`utils/`)

### **dates.ts**
Gestion des dates et périodes :
- `calculateMonths()` : Nombre de mois entre deux dates YYYY-MM
- `mergePeriods()` : Fusionne les périodes qui se chevauchent
- `calculateTotalMonths()` : Total de mois (avec merge)
- `normalizeEndDate()` : Gère "en cours", null, "INFORMATION_MANQUANTE"
- `formatDuration()` : Formate "X ans Y mois"

**Exemple** :
```typescript
const months = calculateMonths('2020-01', '2023-06'); // 42 mois
const formatted = formatDuration(months); // "3 ans 6 mois"
```

### **normalize.ts**
Normalisation de texte et compétences :
- `normalizeText()` : Minuscules + suppression accents
- `normalizeSkill()` : Normalise compétences ("React.js" → "reactjs")
- `skillsMatch()` : Vérifie si 2 compétences correspondent
- `findMatchingSkills()` : Trouve les compétences présentes dans le CV
- `extractKeywords()` : Extrait mots-clés (sans stop words)
- `jaccardSimilarity()` : Similarité entre 2 ensembles de mots

**Exemple** :
```typescript
skillsMatch('React.js', 'ReactJS'); // true
skillsMatch('Node.js', 'Node'); // true

const { matched, missing } = findMatchingSkills(
  ['JavaScript', 'React', 'TypeScript'],
  ['javascript', 'react.js', 'node.js']
);
// matched: ['javascript', 'react.js']
// missing: ['node.js']
```

---

## 🔌 Providers (`providers/`)

### **BaseProvider (classe abstraite)**
Interface commune pour tous les providers IA.

**Méthodes abstraites** :
- `analyze()` : Analyser un CV (Pass 2)

**Méthodes optionnelles** :
- `extract()` : Extraire un CV (Pass 1, OpenAI uniquement)
- `arbitrate()` : Arbitrer entre résultats (Juge, OpenAI uniquement)

**Helpers** :
- `buildSystemPrompt()` : Prompt système universel
- `buildUserPrompt()` : Prompt utilisateur (CV + JobSpec)

**Usage futur** (Phase 2) :
```typescript
class OpenAIProvider extends BaseProvider {
  async analyze(cvJson: CV_JSON, jobSpec: JobSpec): Promise<ProviderResult> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(cvJson, jobSpec);
    // ... appel API OpenAI
  }
}

// Registry
ProviderRegistry.register('openai', (config) => new OpenAIProvider('openai', config));
const provider = ProviderRegistry.create('openai', config);
```

---

## 🚀 Prochaines phases

### **Phase 2 : Pipeline core** (Sprint 3-4)
- [ ] `prefilter/stage0-prefilter.ts` : Pré-filtre ultra-permissif
- [ ] `packer/context-packer.ts` : Compression tokens (Top-K + citations)
- [ ] `rules/` : Règles métier (relevance, must-have, skills-map)
- [ ] `providers/openai-provider.ts` : Implémentation OpenAI
- [ ] `orchestrator.ts` : Gestion modes + needsMore()

### **Phase 3 : Multi-provider** (Sprint 5)
- [ ] `providers/gemini-provider.ts`
- [ ] `providers/claude-provider.ts`
- [ ] `aggregate/quantitative.ts` : Agrégation mathématique
- [ ] `aggregate/final-arbiter.ts` : Juge LLM
- [ ] `aggregate/evidence-quality.ts` : Score qualité preuves

### **Phase 4 : Optimisation** (Sprint 6)
- [ ] `cache/` : Caching intelligent (file_hash, jobSpec)
- [ ] `utils/rate-limit.ts` : Rate limiting par provider
- [ ] `utils/circuit-breaker.ts` : Gestion erreurs successives
- [ ] `cost-tracker.ts` : Tracking budget

### **Phase 5 : Apprentissage** (Sprint 7)
- [ ] `analytics/golden-labels.ts` : Validation humaine
- [ ] `analytics/model-bias.ts` : Calcul biais par provider
- [ ] `analytics/metrics-collector.ts` : Précision, recall, coût/CV

---

## 📊 Métriques de qualité

**Phase 1 (actuelle)** :
- ✅ **7 fichiers créés**
- ✅ **3 types modules** (cv, evaluation, consensus)
- ✅ **3 configs** (modes, providers, thresholds)
- ✅ **3 schémas JSON** validés
- ✅ **2 utils** (dates, normalize)
- ✅ **Base provider** interface
- ✅ **100% TypeScript strict**
- ✅ **Zéro dépendance externe** (sauf AJV)

---

## 💡 Principes d'architecture

1. **Types-first** : Tout est typé strictement
2. **Configuration centralisée** : Pas de magic numbers dans le code
3. **Validation stricte** : AJV à chaque étape critique
4. **Traçabilité complète** : Métadonnées sur tous les résultats
5. **Extensibilité** : Facile d'ajouter un nouveau provider
6. **Testabilité** : Modules découplés, faciles à tester

---

## 🎓 Pour contribuer

**Ajouter un nouveau domaine métier** :
→ `config/thresholds.ts` : Ajouter dans `DOMAIN_CONFIGS`

**Ajouter un nouveau provider** :
→ `providers/` : Créer classe qui extends `BaseProvider`
→ `config/providers.ts` : Ajouter dans `PROVIDER_CONFIGS`

**Ajouter une nouvelle validation** :
→ `schemas/` : Créer schéma JSON
→ `validators/` : Ajouter fonction de validation

---

**🎉 Phase 1 complète !**
Ready pour Phase 2 (Pipeline core) 🚀
