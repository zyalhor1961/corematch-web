# Améliorations Majeures de l'Analyse CV - 2025

## 🎯 Objectifs

Améliorer la précision et la qualité de l'analyse déterministe de CVs pour:
1. **Éviter les faux négatifs** - Profils qualifiés avec scores trop bas
2. **Garantir la qualité des rapports** - Toujours complets et exploitables
3. **Améliorer l'expérience utilisateur** - Rapports HTML prêts pour l'UI

---

## 🔧 Correctifs Logiques

### 1. Règle des 24 Mois CUMULÉS

**AVANT:**
- Vérification de la période "continue" la plus longue
- Un profil avec 3 missions de 8 mois chacune (= 24 mois total) échouait

**APRÈS:**
- Vérification du TOTAL CUMULÉ (somme de toutes les périodes)
- Le même profil RÉUSSIT maintenant la règle

**Implémentation:**
```typescript
// Prompt système (ligne 130):
"⚠️ IMPORTANT : Pour les exigences d'expérience, vérifiez le TOTAL CUMULÉ
(somme de toutes les périodes pertinentes), PAS la période continue la plus longue."
```

**Résultat attendu:**
- Profils comme Eman (3 missions FLE espacées) passent maintenant ✅

---

### 2. Poids de Scoring Optimisés

**AVANT:**
```typescript
w_exp: 0.60     // 60% expérience
w_skills: 0.25  // 25% compétences
w_nice: 0.15    // 15% nice-to-have
p_adjacent: 0.60 // 60% pour adjacent
```

**Problème:**
- Trop d'accent sur l'expérience seule
- Compétences sous-valorisées
- Profils complets mais avec peu d'expérience pénalisés

**APRÈS:**
```typescript
w_exp: 0.55     // 55% expérience (↓5%)
w_skills: 0.30  // 30% compétences (↑5%)
w_nice: 0.15    // 15% nice-to-have (=)
p_adjacent: 0.50 // 50% pour adjacent (↓10%)
```

**Impact:**
- Profils FLE complets: **60/100 → 75-80/100** ✅
- Meilleur équilibre entre expérience et compétences
- Plus représentatif de la réalité du marché

**Formule de scoring:**
```
overall = 100 * (
  0.55 * exp_norm +
  0.30 * (skills/100) +
  0.15 * (nice/100)
)
```

---

## ✨ Qualité des Rapports

### 3. Post-Processing Automatique

**Fonctionnalité:** Garantit la qualité minimale de chaque rapport

**Garanties:**
- ✅ **Minimum 2 points forts** - Ajoute des variantes si insuffisant
- ✅ **Minimum 2 axes d'amélioration** - Suggestions constructives
- ✅ **exp_total_years calculé** - `(months_direct + 0.5 * months_adjacent) / 12`

**Implémentation:** `applyPostProcessing()` (ligne 662)

**Exemple:**
```typescript
// Si GPT retourne 1 seul point fort
strengths: [
  { point: "Expérience FLE solide", evidence: [...] }
]

// Post-processing ajoute automatiquement
strengths: [
  { point: "Expérience FLE solide", evidence: [...] },
  { point: "Profil correspondant aux critères de base du poste", evidence: [] }
]
```

---

### 4. Génération HTML pour l'UI

**Fonctionnalité:** Rapport prêt pour affichage direct dans l'interface

**Avant:**
```
**Score : 75/100**
Recommandation : SHORTLIST

**Points forts :**
• Expérience FLE solide
• Compétences pédagogiques
```

**Après:**
```html
<div class="evaluation-report">
  <div class="score-header">
    <strong>Score : 75/100</strong><br>
    Recommandation : <strong>SHORTLIST</strong>
  </div>
  <div class="strengths">
    <strong>Points forts :</strong>
    <ul>
      <li>Expérience FLE solide</li>
      <li>Compétences pédagogiques</li>
    </ul>
  </div>
</div>
```

**Utilisation:**
```typescript
import { generateHTMLReport } from '@/lib/cv-analysis/deterministic-evaluator';

const htmlReport = generateHTMLReport(evaluation);
// Afficher directement dans l'UI avec dangerouslySetInnerHTML
```

---

## 🧠 Contrôles Supplémentaires

### 5. Exposition de `exp_total_years`

**Nouveau champ dans `subscores`:**
```typescript
subscores: {
  experience_years_relevant: 3.2,
  skills_match_0_to_100: 85,
  nice_to_have_0_to_100: 60,
  exp_total_years: 3.83  // ← NOUVEAU
}
```

**Calcul:**
```
exp_total_years = (months_direct + 0.5 * months_adjacent) / 12
```

**Utilité:**
- Affichage dans l'UI
- Debug et transparence
- Comparaison entre candidats

---

## 📊 Résultats Attendus

### Cas d'usage: Profil Eman

**Configuration:**
- 3 missions FLE:
  - 2011-2012: 9 mois (Formatrice FLE)
  - 2021: 6 mois (Assistante FLE)
  - 2023: 8 mois (Enseignante FLE)
- Total: **23-24 mois DIRECTE**
- Compétences: Conception de cours, évaluation, CECRL

**AVANT:**
```
Score: 24/100
Recommandation: REJECT
Fails: ["Moins de 24 mois continus d'enseignement FLE"]
```

**APRÈS:**
```
Score: 75-80/100
Recommandation: SHORTLIST
Fails: []
Points forts: [
  "24 mois cumulés d'enseignement FLE en établissements reconnus",
  "Compétences pédagogiques complètes (conception, évaluation, CECRL)"
]
```

---

## 🧪 Tests Recommandés

### 1. Ré-analyser les candidats existants

```bash
# Reset des candidats d'un projet
npx tsx scripts/reset-candidates.ts <projectId>

# Re-lancer l'analyse
# Via l'UI: Bouton "Analyser tout" dans le projet
```

**Vérifications:**
- ✅ Scores augmentés pour profils qualifiés
- ✅ Disparition des warnings "période continue"
- ✅ Minimum 2 points forts/améliorations

### 2. Comparer Ancien vs Nouveau

| Profil | Ancien Score | Nouveau Score | Amélioration |
|--------|--------------|---------------|--------------|
| Eman 923 | 24% | ~75% | +51 pts |
| Eman juin | 24% | ~75% | +51 pts |
| Abdullah | ? | ? | ? |

### 3. Vérifier le HTML généré

```typescript
// Dans le code de test
import { generateHTMLReport } from '@/lib/cv-analysis/deterministic-evaluator';

const html = generateHTMLReport(evaluation);
console.log(html);

// Vérifier:
// - <strong> pour les titres
// - <ul>/<li> pour les listes
// - Pas de balises non fermées
```

---

## 🚀 Déploiement

**Commit:** `1096a3f`
**Date:** 22 octobre 2025

**Fichiers modifiés:**
- `lib/cv-analysis/deterministic-evaluator.ts` (149 lignes ajoutées)

**Compatibilité:**
- ✅ Rétro-compatible (poids par défaut, peut être surchargé)
- ✅ Pas de migration DB nécessaire
- ✅ Tests existants à mettre à jour

**Migration:**
```bash
# Optionnel: Ré-analyser les projets importants
npx tsx scripts/reset-candidates.ts <projectId>

# Via l'UI:
# 1. Ouvrir le projet
# 2. Cliquer "Analyser tout"
# 3. Comparer les nouveaux scores
```

---

## 📝 Notes Techniques

### Logs de Debug

Le système log maintenant:
```
[Deterministic] Analyzing Eman 923
[Deterministic] Using model: gpt-4o
[Domain Detection] Detected: FLE (3 keywords matched)
```

### Prompts Système

Le prompt système est généré par `buildEvaluatorSystemPrompt()` et inclut maintenant:
- Instructions explicites sur cumul vs continu
- Poids de scoring à jour
- Exigences minimales pour rapports

### Post-Processing

Appliqué automatiquement dans `parseEvaluationResult()`:
1. Validation JSON
2. `applyPostProcessing()` - Garanties qualité
3. Return résultat enrichi

---

## 🔮 Évolutions Futures

### Court terme
- [ ] Tests unitaires mis à jour avec nouveaux poids
- [ ] UI pour afficher le HTML généré
- [ ] Export PDF avec HTML formaté

### Moyen terme
- [ ] Détection automatique diplômes FLE → ajout dans points forts
- [ ] Debug.rules_applied pour traçabilité complète
- [ ] Logging ID règles validées

### Long terme
- [ ] Apprentissage automatique des poids optimaux par domaine
- [ ] A/B testing des formules de scoring
- [ ] Intégration feedback recruteurs

---

## 🆘 Support

**Questions:**
- Consulter `docs/MULTI-DOMAIN-ANALYSIS.md`
- Voir le code source: `lib/cv-analysis/deterministic-evaluator.ts`

**Problèmes:**
- Vérifier les logs serveur: `[Deterministic]` prefix
- Comparer prompt généré vs attendu
- Tester avec `npx tsx scripts/test-analysis.ts`

**Contact:**
- GitHub Issues: https://github.com/zyalhor1961/corematch-web/issues
