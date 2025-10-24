# Tests Phase 1 - Fondations CoreMatch

Suite de tests complète pour valider la Phase 1 de l'architecture multi-provider.

---

## 📊 Statistiques

| Métrique | Valeur |
|----------|--------|
| **Fichiers de test** | 6 |
| **Assertions totales** | 185 ✅ |
| **Coverage** | Types, Config, Utils, Validators |
| **Temps d'exécution** | ~5 secondes |

---

## 🧪 Tests disponibles

### 1. **utils.dates.test.ts** (39 assertions)
Tests des fonctions de gestion de dates :
- ✅ Formatage dates (YYYY-MM-DD ↔ YYYY-MM)
- ✅ Calcul de durées en mois
- ✅ Fusion de périodes overlapping
- ✅ Gestion "en cours" / null
- ✅ Validation format YYYY-MM

**Exécuter** :
```bash
npx tsx lib/cv-analysis/__tests__/utils.dates.test.ts
```

### 2. **utils.normalize.test.ts** (52 assertions)
Tests de normalisation de texte et compétences :
- ✅ Normalisation texte (accents, minuscules)
- ✅ Tokenization et stop words
- ✅ Lemmatisation simple
- ✅ Matching de compétences (React.js ≈ ReactJS)
- ✅ Similarité Jaccard
- ✅ Extraction de mots-clés

**Exécuter** :
```bash
npx tsx lib/cv-analysis/__tests__/utils.normalize.test.ts
```

### 3. **validators.test.ts** (17 assertions)
Tests de validation AJV :
- ✅ Validation CV_JSON
- ✅ Validation EvaluationResult
- ✅ Détection erreurs (champs manquants, types incorrects, enums invalides)
- ✅ Helpers assert (throw on error)

**Exécuter** :
```bash
npx tsx lib/cv-analysis/__tests__/validators.test.ts
```

### 4. **config.test.ts** (65 assertions)
Tests de configuration :
- ✅ Modes Éco/Équilibré/Premium
- ✅ Providers (OpenAI, Gemini, Claude)
- ✅ Normalisation poids
- ✅ Calcul coûts
- ✅ Domaines métier (Tech, Teaching, BTP, Management, Healthcare)
- ✅ Détection automatique domaine
- ✅ Merge configurations

**Exécuter** :
```bash
npx tsx lib/cv-analysis/__tests__/config.test.ts
```

### 5. **integration.test.ts** (12 assertions)
Test d'intégration complet :
- ✅ Scénario réaliste : Développeur Full Stack
- ✅ Validation CV → Détection domaine → Calcul expérience → Matching skills → Scoring → Recommandation
- ✅ Validation finale avec AJV

**Exécuter** :
```bash
npx tsx lib/cv-analysis/__tests__/integration.test.ts
```

### 6. **run-all.ts** (script maître)
Exécute tous les tests et affiche un résumé.

**Exécuter** :
```bash
npx tsx lib/cv-analysis/__tests__/run-all.ts
```

---

## 🚀 Utilisation

### Exécuter tous les tests
```bash
cd F:\corematch
npx tsx lib/cv-analysis/__tests__/run-all.ts
```

### Exécuter un test spécifique
```bash
npx tsx lib/cv-analysis/__tests__/[nom-du-test].test.ts
```

---

## 📝 Exemple de sortie

```
🚀 Running all Phase 1 tests...
════════════════════════════════════════════════════════════

📦 Running utils.dates.test.ts...
✅ utils.dates.test.ts passed (39 assertions)

📦 Running utils.normalize.test.ts...
✅ utils.normalize.test.ts passed (52 assertions)

📦 Running validators.test.ts...
✅ validators.test.ts passed (17 assertions)

📦 Running config.test.ts...
✅ config.test.ts passed (65 assertions)

📦 Running integration.test.ts...
✅ integration.test.ts passed (12 assertions)

════════════════════════════════════════════════════════════
📊 Test Summary
════════════════════════════════════════════════════════════
Total test files: 5
Passed: 5 ✅
Failed: 0 ❌
Total assertions: 185 ✅
════════════════════════════════════════════════════════════

🎉 All tests passed! Phase 1 is solid! 🎉
```

---

## 🛠️ Ajouter un nouveau test

1. Créer `__tests__/mon-test.test.ts`
2. Importer les helpers :
```typescript
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`❌ ${message}`);
  console.log(`✅ ${message}`);
}
```

3. Ajouter le fichier à `run-all.ts` dans l'array `tests`

---

## 🎯 Couverture

| Module | Couverture |
|--------|-----------|
| **types/** | ✅ Validé via validators |
| **config/** | ✅ 100% (modes, providers, thresholds) |
| **utils/dates** | ✅ 100% (10 fonctions) |
| **utils/normalize** | ✅ 100% (11 fonctions) |
| **validators/** | ✅ 100% (validation + assertions) |
| **providers/** | ⏳ Phase 2 (interface définie) |

---

## 🐛 Debugging

Si un test échoue :

1. **Regarder le message d'erreur** : Il contient Expected vs Actual
2. **Isoler le test** : Exécuter le fichier de test individuel
3. **Ajouter des console.log** : Pour inspecter les valeurs intermédiaires
4. **Vérifier les schémas JSON** : Si validation échoue

---

## 📚 Ressources

- [AJV Documentation](https://ajv.js.org/)
- [Architecture Phase 1](../ARCHITECTURE.md)
- [Types centralisés](../types/index.ts)

---

**✅ Phase 1 testée et validée !**
