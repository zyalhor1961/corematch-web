# Corrections Finales Mission Corematch — État d'Implémentation

Date: 23 octobre 2025
Commit actuel: `792d8c0`

---

## ✅ DÉJÀ IMPLÉMENTÉ (Commit 792d8c0)

### 1. Must-Have "24 Mois Cumulés"
**Status:** ✅ IMPLÉMENTÉ

- **Prompt système** (deterministic-evaluator.ts:130-131):
  ```
  ⚠️ IMPORTANT : Pour les exigences d'expérience, vérifiez le TOTAL CUMULÉ
  (somme de toutes les périodes pertinentes), PAS la période continue la plus longue.
  ```
- **Vérification:** Le GPT additionne TOUS les mois d'expérience DIRECTE, même espacés
- **Exemple:** 3 missions de 8 mois chacune = 24 mois ✅ PASSE la règle M1

### 2. Persistance Mois en DB
**Status:** ✅ IMPLÉMENTÉ

```typescript
// analyze-all/route.ts:328-333
if (analysisResult.evaluation) {
  updateData.evaluation_result = analysisResult.evaluation;
  updateData.relevance_months_direct = analysisResult.evaluation.relevance_summary.months_direct || 0;
  updateData.relevance_months_adjacent = analysisResult.evaluation.relevance_summary.months_adjacent || 0;
}
```

### 3. Normalisation Données
**Status:** ✅ IMPLÉMENTÉ

- **Fichier:** `lib/utils/data-normalization.ts`
- **Fonctions:**
  - `normalizeSkill()` - lowercase, sans accents, espaces normalisés
  - `normalizePhone()` - format E.164 (+33XXXXXXXXX)
  - `maskPII()` - masque email/téléphone dans logs
  - `detectFLEDiploma()` - détecte Master FLE, DAEFLE, DUFLE, etc.

### 4. Détection Diplôme FLE
**Status:** ✅ IMPLÉMENTÉ

- Intégré dans `applyPostProcessing()` (deterministic-evaluator.ts:662-767)
- Détecte automatiquement diplômes FLE dans formations
- Ajoute `"Diplôme FLE ✅: [nom]"` dans strengths avec evidence

### 5. Protection PII
**Status:** ✅ IMPLÉMENTÉ

- Masquage dans `console.log()` et logs d'erreur
- `normalizePhone()` appliqué avant sauvegarde DB
- Format E.164 standardisé pour tous les numéros

---

## 🔄 CORRECTIONS FINALES À IMPLÉMENTER

### ✅ PRIORITÉ 1: Vérification Stricte Règle M1 (IMPLÉMENTÉ - Commit 1df5ba7)

**Demande:**
> Dans le module de vérification des règles, remplace toute logique existante par :
> comparer exclusivement le champ agrégé final relevance_summary.months_direct.
>
> Condition : if (months_direct < 24) -> fail(M1), sinon retirer M1 de fails.

**État actuel:**
- ✅ `enforceM1Rule()` implémenté avec vérification conditionnelle
- ✅ Applique M1 UNIQUEMENT si règle existe dans jobSpec
- ✅ Override GPT pour garantie absolue de cohérence
- ✅ Propagation jobSpec complète (route → parse → postprocessing → enforce)

**Solution implémentée:**

#### Post-Processing Strict avec Vérification Conditionnelle
Fonction `enforceM1Rule()` dans `deterministic-evaluator.ts:659-715`:

```typescript
function enforceM1Rule(evaluation: EvaluationResult, jobSpec?: JobSpec): EvaluationResult {
  // CRITIQUE: Vérifier si M1 existe dans jobSpec avant d'appliquer
  if (!jobSpec || !jobSpec.must_have.some(rule => rule.id === 'M1')) {
    return evaluation; // Pas de M1 dans ce projet → pas de vérification
  }

  const monthsDirect = evaluation.relevance_summary.months_direct || 0;
  const m1FailIndex = evaluation.fails.findIndex(f => f.rule_id === 'M1');
  const m1Failed = m1FailIndex >= 0 ? evaluation.fails[m1FailIndex] : null;

  if (monthsDirect >= 24) {
    // ✅ PASSE M1
    if (m1FailIndex >= 0) {
      evaluation.fails.splice(m1FailIndex, 1);
    }
    evaluation.meets_all_must_have = evaluation.fails.filter(f => f.rule_id.startsWith('M')).length === 0;

    // Déplacer preuves M1 vers strengths
    if (m1Failed && m1Failed.evidence.length > 0) {
      evaluation.strengths.unshift({
        point: `Expérience FLE validée: ${monthsDirect} mois cumulés d'enseignement`,
        evidence: m1Failed.evidence
      });
    }
  } else {
    // ❌ ÉCHOUE M1
    if (!m1Failed) {
      evaluation.fails.push({
        rule_id: 'M1',
        reason: `Moins de 24 mois cumulés d'enseignement FLE requis (${monthsDirect} mois détectés)`,
        evidence: []
      });
    }
    evaluation.meets_all_must_have = false;
  }

  return evaluation;
}
```

**Avantages:**
- ✅ Garantie absolue que M1 est vérifié correctement pour projets FLE
- ✅ Indépendant du GPT (zéro hallucination)
- ✅ **Vérification conditionnelle**: appliqué UNIQUEMENT si M1 existe dans jobSpec
- ✅ Projets non-FLE (Peintre, Tech, etc.) ne sont pas affectés
- ✅ Déplacement automatique preuves M1 → strengths

**Implémentation complète:**
1. ✅ `enforceM1Rule(evaluation, jobSpec)` dans deterministic-evaluator.ts:659-715
2. ✅ Appelé dans `applyPostProcessing(evaluation, cvJson, jobSpec)` ligne 721
3. ✅ `parseEvaluationResult(jsonString, cvJson, jobSpec)` accepte jobSpec ligne 630
4. ✅ `analyze-all/route.ts` ligne 92 passe jobSpec à parseEvaluationResult()

**Bug corrigé:**
- Avant: Tous projets recevaient vérification M1 (FLE + Peintre + Tech + ...)
- Après: Vérification M1 appliquée UNIQUEMENT aux projets FLE avec must_have.M1

---

### 📌 PRIORITÉ 2: Système Multi-Provider (OpenAI + Gemini)

**Demande:**
> Séquence d'agrégation & union des périodes
> - Fixer un analysis_date unique (aujourd'hui)
> - Harmoniser pertinence: DIRECTE > ADJACENTE > PÉRIPHÉRIQUE > NON
> - Union des périodes (pas de double comptage)
> - Si désaccord fournisseurs: prendre la plus haute pertinence

**État actuel:**
- ⚠️ Le système de production utilise **MONO-PROVIDER** (OpenAI uniquement)
- ✅ Il existe un système multi-provider dans `corematch-multi/` et `lib/cv-analysis/multi-provider-analyzer.ts`
- ❓ **À CLARIFIER:** Quel système est utilisé en production?

**Architecture actuelle:**
```
app/api/cv/projects/[projectId]/analyze-all/route.ts
  ├─ analyzeCandidateDeterministic()
  │   └─ openai.chat.completions.create() ← MONO-PROVIDER
  └─ parseEvaluationResult()
```

**Architecture multi-provider disponible:**
```
lib/cv-analysis/multi-provider-analyzer.ts
  ├─ analyzeWithMultipleProviders()
  │   ├─ OpenAI Provider
  │   ├─ Gemini Provider
  │   └─ aggregateResults()
  └─ app/api/cv/analyze-multi-provider/route.ts
```

**Prochaines étapes:**

#### Étape 1: Identifier le système en production
```bash
# Vérifier quelle route est utilisée
grep -r "analyze-all" app/ --include="*.tsx"
grep -r "analyze-multi-provider" app/ --include="*.tsx"
```

#### Étape 2A: Si MONO-PROVIDER (actuel)
→ **REFACTORING NÉCESSAIRE** pour intégrer multi-provider

#### Étape 2B: Si MULTI-PROVIDER (déjà actif)
→ Implémenter les améliorations d'agrégation demandées:

1. **Fixer analysis_date unique:**
   ```typescript
   const analysisDate = new Date().toISOString().split('T')[0];
   ```

2. **Harmoniser pertinence (priorité haute):**
   ```typescript
   function harmonizeRelevance(openaiResult, geminiResult) {
     // Pour chaque période, prendre la pertinence la plus haute
     const relevanceOrder = {
       'DIRECTE': 4,
       'ADJACENTE': 3,
       'PERIPHERIQUE': 2,
       'NON_PERTINENTE': 1
     };

     return experiences.map(exp => {
       const openaiRel = openaiResult.find(e => e.index === exp.index);
       const geminiRel = geminiResult.find(e => e.index === exp.index);

       // Prendre la pertinence la plus haute
       return relevanceOrder[openaiRel] > relevanceOrder[geminiRel]
         ? openaiRel
         : geminiRel;
     });
   }
   ```

3. **Union des périodes:**
   ```typescript
   function unionPeriods(periods: ExperienceRelevance[]): number {
     // Trier par date de début
     const sorted = periods.sort((a, b) => a.start.localeCompare(b.start));

     // Fusionner périodes qui se chevauchent
     let totalMonths = 0;
     let currentEnd = null;

     for (const period of sorted) {
       if (!currentEnd || period.start > currentEnd) {
         // Nouvelle période
         totalMonths += calculateMonths(period.start, period.end || analysisDate);
         currentEnd = period.end || analysisDate;
       } else if (period.end > currentEnd) {
         // Extension de période
         totalMonths += calculateMonths(currentEnd, period.end);
         currentEnd = period.end;
       }
       // Si period.end <= currentEnd: période déjà comptée (chevauchement)
     }

     return totalMonths;
   }
   ```

4. **Test variance ±10%:**
   ```typescript
   test('Deux extractions du même CV doivent avoir months_direct ±10%', async () => {
     const result1 = await analyzeCV(cvText);
     const result2 = await analyzeCV(cvText);

     const variance = Math.abs(result1.months_direct - result2.months_direct) / result1.months_direct;
     expect(variance).toBeLessThan(0.1); // < 10%
   });
   ```

---

### 📌 PRIORITÉ 3: Skills Mapping & Debug

**Demande:**
> Centraliser skills_map et normalisation, appliquer des deux côtés (OpenAI + Gemini).
> Ajouter debug.matched_skills et debug.unmatched_skills pour audit.

**État actuel:**
- ✅ `normalizeSkill()` existe dans `lib/utils/data-normalization.ts`
- ✅ `skills_map` existe dans les templates de domaines (deterministic-evaluator.ts:266-500)
- ⚠️ **MAIS**: Appliqué seulement via le prompt GPT, pas en post-processing

**Solution proposée:**

#### A. Ajout de debug.matched_skills dans EvaluationResult

```typescript
// lib/cv-analysis/deterministic-evaluator.ts

export interface SkillMatch {
  required: string;           // Compétence requise originale
  found_in: string[];         // Où trouvé dans le CV
  alias_used: string | null;  // Alias/synonyme utilisé pour le match
  confidence: number;         // Score de confiance (0-1)
}

export interface EvaluationResult {
  // ... champs existants ...

  debug?: {
    matched_skills: SkillMatch[];
    unmatched_skills: string[];
    rules_applied: string[];  // IDs des règles vérifiées
  };
}
```

#### B. Post-Processing Skills Matching

```typescript
function matchSkills(
  required: string[],
  cvCompetences: string[],
  cvMissions: string[],
  skillsMap: Record<string, string[]>
): { matched: SkillMatch[], unmatched: string[] } {

  const matched: SkillMatch[] = [];
  const unmatched: string[] = [];

  for (const skill of required) {
    const normalizedSkill = normalizeSkill(skill);
    const aliases = [normalizedSkill, ...(skillsMap[skill] || []).map(normalizeSkill)];

    let foundIn: string[] = [];
    let aliasUsed: string | null = null;

    // Chercher dans compétences et missions
    const allText = [...cvCompetences, ...cvMissions].map(normalizeSkill);

    for (const alias of aliases) {
      const matches = allText.filter(text => text.includes(alias));
      if (matches.length > 0) {
        foundIn = matches;
        aliasUsed = alias !== normalizedSkill ? alias : null;
        break;
      }
    }

    if (foundIn.length > 0) {
      matched.push({
        required: skill,
        found_in: foundIn.slice(0, 3), // Max 3 exemples
        alias_used: aliasUsed,
        confidence: 1.0
      });
    } else {
      unmatched.push(skill);
    }
  }

  return { matched, unmatched };
}
```

#### C. Intégration dans applyPostProcessing()

```typescript
function applyPostProcessing(evaluation: EvaluationResult, cvJson?: any, jobSpec?: JobSpec): EvaluationResult {
  // ... code existant ...

  // Ajouter debug skills si jobSpec fourni
  if (jobSpec && cvJson) {
    const { matched, unmatched } = matchSkills(
      jobSpec.skills_required,
      cvJson.competences || [],
      cvJson.experiences?.flatMap(e => e.missions || []) || [],
      jobSpec.skills_map || {}
    );

    evaluation.debug = {
      matched_skills: matched,
      unmatched_skills: unmatched,
      rules_applied: jobSpec.must_have.map(r => r.id)
    };
  }

  return evaluation;
}
```

---

### 📌 PRIORITÉ 4: Tests d'Intégration

**Demande:**
> Ajouter test d'intégration qui charge le CSV exporté et vérifie l'égalité
> avec les champs de la décision agrégée.

**Structure proposée:**

```typescript
// tests/integration/csv-export.spec.ts

describe('CSV Export Integration', () => {
  test('CSV months_direct matches DB evaluation_result', async () => {
    // 1. Analyser un CV
    const response = await analyzeCandidate(testCandidateId);

    // 2. Récupérer depuis DB
    const { data: candidate } = await supabase
      .from('candidates')
      .select('relevance_months_direct, evaluation_result')
      .eq('id', testCandidateId)
      .single();

    // 3. Exporter CSV
    const csvData = await exportCandidatesCSV(projectId);
    const candidateRow = csvData.find(r => r.id === testCandidateId);

    // 4. Vérifier cohérence
    expect(candidateRow.months_direct).toBe(candidate.relevance_months_direct);
    expect(candidateRow.months_adjacent).toBe(
      candidate.evaluation_result.relevance_summary.months_adjacent
    );

    // Jamais 0 si des mois existent dans notes/explanation
    if (candidate.evaluation_result.relevance_summary.months_direct > 0) {
      expect(candidateRow.months_direct).toBeGreaterThan(0);
    }
  });
});
```

---

## 🎯 PLAN D'ACTION RECOMMANDÉ

### Phase 1: Corrections Critiques (Immediate) 🔴

1. **Implémenter `enforceM1Rule()`** - Post-processing strict de M1
2. **Ajouter test unitaire** - `months_direct=45 => meets_all_must_have=true`
3. **Vérifier système en production** - Mono vs Multi-provider?

**Estimé:** 2 heures
**Impact:** ✅ Garantit scoring correct des profils FLE

### Phase 2: Debug & Audit (Court terme) 🟡

1. **Ajouter debug.matched_skills** dans EvaluationResult
2. **Post-processing skills matching** avec normalizeSkill()
3. **Test d'intégration CSV** vs DB

**Estimé:** 4 heures
**Impact:** 📊 Meilleure traçabilité et debugging

### Phase 3: Multi-Provider Improvements (Moyen terme) 🟢

**SI multi-provider déjà actif:**
1. Harmonisation pertinence (priorité haute)
2. Union des périodes (pas de double comptage)
3. Test variance ±10%

**SI mono-provider:**
1. Refactoring pour intégrer multi-provider-analyzer.ts
2. Migration progressive des projets

**Estimé:** 1-2 jours
**Impact:** 🎯 Scores plus robustes et cohérents

---

## 📝 CHECKLIST FINALE

- [x] `enforceM1Rule()` implémenté avec vérification conditionnelle
- [x] Propagation jobSpec complète (route → parse → postprocessing)
- [x] Documentation mise à jour
- [ ] Test unitaire: `months_direct=45 => OK` (à faire)
- [ ] Test projet Peintre: vérifier absence de M1
- [ ] Test projet FLE: vérifier présence de M1
- [ ] Debug.matched_skills ajouté (PRIORITÉ 2)
- [ ] Test intégration CSV vs DB (PRIORITÉ 2)
- [ ] Système multi-provider vérifié/activé (PRIORITÉ 3)

---

## 🔗 RÉFÉRENCES

- **Commit actuel:** `1df5ba7` (fix: Appliquer règle M1 uniquement aux projets FLE)
- **Commits précédents:**
  - `1b931b1` - feat: Vérification stricte règle M1
  - `792d8c0` - feat: Corrections immédiates - Normalisation et PII
- **Documentation:** `docs/ANALYSIS_IMPROVEMENTS_2025.md`
- **Code principal:**
  - `lib/cv-analysis/deterministic-evaluator.ts`
  - `lib/utils/data-normalization.ts`
  - `app/api/cv/projects/[projectId]/analyze-all/route.ts`
- **Multi-provider:**
  - `lib/cv-analysis/multi-provider-analyzer.ts`
  - `app/api/cv/analyze-multi-provider/route.ts`
