# 📋 Résumé de la session - Système PDF Routing Intelligent

**Date:** 4 novembre 2024
**Objectif:** Implémenter un système d'extraction de PDF avec routing intelligent pour économiser les coûts Landing AI

## ✅ RÉALISATIONS

### 1. Remplacement de pdf-parse par pdf2json
**Problème:** `pdf-parse` v2.4.5 nécessite un worker pdfjs-dist qui ne fonctionne pas avec Turbopack/Next.js

**Solution:** Migration vers `pdf2json` - bibliothèque pure Node.js sans dépendance worker

**Fichiers modifiés:**
- `lib/daf-docs/extraction/pdf-detector.ts` - Utilise pdf2json au lieu de pdf-parse
- `lib/daf-docs/extraction/pdf-metadata-extractor.ts` - Migration vers pdf2json

### 2. Désactivation temporaire de Landing AI
**Raison:** Économiser les crédits pendant les tests

**Fichier modifié:**
- `lib/daf-docs/extraction/orchestrator.ts` - Landing AI commenté (lignes 90-138)

**Pour réactiver Landing AI:**
```typescript
// Décommenter les lignes 100-138 dans orchestrator.ts
// Supprimer le return early (lignes 91-97)
```

### 3. Nettoyage des caractères null (Unicode \u0000)
**Problème:** PostgreSQL refuse les caractères null dans les champs text

**Solution:** Fonction `cleanText()` qui supprime:
- `\u0000` - Caractères null
- `[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]` - Caractères de contrôle

**Fichiers modifiés:**
- `lib/daf-docs/extraction/markdown-generator.ts` - Nettoie le markdown
- `lib/daf-docs/extraction/simple-text-extractor.ts` - Nettoie les données extraites

## 🎯 RÉSULTATS DES TESTS

### Test avec Invoice-WKRWOYFW-0001.pdf (Landing AI natif)

**Analyse PDF:**
- Type: `native` ✅
- Densité: `791 chars/page` ✅
- Confiance: `79%` ✅
- Recommendation: `simple-parser` ✅

**Extraction:**
- Provider: `simple-text` (GRATUIT) ✅
- Durée: `151ms` ✅
- Landing AI **NON appelé** ✅

**Données extraites:**
- ✅ `numero_facture: "WKRWOYFW"`
- ❌ `fournisseur: "Page 1 of 1"` (incorrect)
- ❌ Manque: montants, dates, TVA

**Confiance finale:** `0.45` (faible)

### Problème identifié
Le parser gratuit extrait peu de données sur ce PDF particulier. Raisons possibles:
1. Layout de facture non standard
2. Patterns regex insuffisants
3. pdf2json extrait le texte différemment de pdf-parse

## 📊 ARCHITECTURE ACTUELLE

```
PDF Upload
    ↓
pdf2json (analyse)
    ↓
├─ Native (≥100 chars/page)
│   ↓
│   Simple Text Parser (GRATUIT)
│   └─ Patterns regex pour extraction
│       └─ Si confiance < 0.6 → ⚠️ OCR désactivé
│
└─ Scanned (<50 chars/page)
    ↓
    ⚠️ Landing AI DÉSACTIVÉ
    └─ Retourne erreur temporairement
```

## 🔧 FICHIERS CLÉS

### Extraction PDF
- `lib/daf-docs/extraction/pdf-detector.ts` - Détection type PDF (pdf2json)
- `lib/daf-docs/extraction/pdf-metadata-extractor.ts` - Métadonnées 99.99% (pdf2json)
- `lib/daf-docs/extraction/simple-text-extractor.ts` - Parser gratuit (regex)
- `lib/daf-docs/extraction/markdown-generator.ts` - Markdown professionnel
- `lib/daf-docs/extraction/orchestrator.ts` - Routing intelligent

### Extracteurs IA (désactivés)
- `lib/daf-docs/extraction/landing-ai-extractor.ts` - Landing AI EU
- `lib/daf-docs/extraction/azure-di-extractor.ts` - Azure Document Intelligence

## 🐛 PROBLÈMES À RÉSOUDRE

### 1. Extraction faible (0.45 confiance)
**Symptôme:** Le parser n'extrait que 2 champs sur 7

**Causes possibles:**
- pdf2json extrait le texte différemment de pdf-parse
- Layout de la facture Landing AI est non standard
- Patterns regex inadaptés

**Solutions à explorer:**
1. Afficher le texte brut extrait par pdf2json pour debug
2. Adapter les patterns regex au format pdf2json
3. Ajouter des patterns spécifiques pour les factures Landing AI
4. Améliorer l'extraction du fournisseur (actuellement "Page 1 of 1")

### 2. Patterns regex à améliorer
**Actuels:**
- ✅ `numero_facture` - Fonctionne bien
- ❌ `fournisseur` - Capture "Page 1 of 1" au lieu du nom
- ❌ `montant_ttc` - Pas trouvé
- ❌ `date_document` - Pas trouvée

**Action requise:** Analyser le texte brut pour adapter les patterns

### 3. Landing AI temporairement désactivé
**Pour réactiver:**
1. Éditer `lib/daf-docs/extraction/orchestrator.ts`
2. Décommenter lignes 100-138
3. Supprimer le return early (lignes 91-97)

## 💰 ÉCONOMIES ATTENDUES

**Scénario actuel (Landing AI désactivé):**
- 100% PDFs → Parser gratuit = **€0/mois**

**Scénario cible (après amélioration patterns):**
- 70% PDFs natifs → Parser gratuit = €0
- 30% PDFs scannés → Landing AI = €6
- **Total: €6/mois** vs €20/mois (économie 70%)

## 📝 PROCHAINES ÉTAPES

### Priorité 1: Débug extraction
1. **Afficher le texte brut extrait** par pdf2json
2. **Adapter les patterns regex** au format de ce texte
3. **Tester avec plusieurs types de factures** (Stripe, AWS, etc.)

### Priorité 2: Amélioration patterns
1. Ajouter patterns pour formats alternatifs
2. Améliorer extraction fournisseur
3. Support multi-langues (EN, FR)

### Priorité 3: Réactivation Landing AI
1. Une fois les patterns améliorés
2. Pour les PDFs scannés uniquement
3. Avec fallback Azure DI

## 🎓 MÉTADONNÉES POUR INTERROGATION FUTURE (RAG)

**Données stockées dans Supabase (`daf_documents`):**
- ✅ Texte complet du PDF (searchable)
- ✅ Métadonnées PDF (MD5, SHA-256, creator, dates)
- ✅ Données facture (montants, dates, fournisseur)
- ✅ Markdown structuré (pour LLM)

**Cas d'usage:**
- Recherche sémantique: "Factures > 1000€"
- Filtrage temporel: "Factures janvier 2024"
- Agrégation: "Total par fournisseur"
- Context AI: Envoyer markdown à LLM pour questions

## 🚀 COMMANDES UTILES

**Démarrer le serveur:**
```bash
npm run dev
# Actuellement sur port 3009
http://localhost:3009/daf-demo
```

**Réactiver Landing AI:**
1. Éditer `lib/daf-docs/extraction/orchestrator.ts`
2. Décommenter le bloc OCR
3. Redémarrer: `rm -rf .next && npm run dev`

**Tester le routing:**
```bash
npx tsx scripts/test-pdf-routing.ts
```

## 📈 STATUS ACTUEL

- ✅ pdf2json installé et fonctionnel
- ✅ Détection PDF native vs scanned fonctionne
- ✅ Parser gratuit fonctionne (mais extraction faible)
- ✅ Caractères null nettoyés
- ✅ Landing AI désactivé (économie crédits)
- ⚠️ Extraction faible (0.45 confiance) - À améliorer
- ⚠️ Patterns regex à adapter pour pdf2json

**Serveur:** http://localhost:3009 ✅ RUNNING
**Build:** ✅ Aucune erreur
**Économies:** 100% (Landing AI désactivé)

---

**Développé par:** CoreMatch Team
**Dernière mise à jour:** 4 novembre 2024 01:10
**Status:** 🟡 Tests en cours - Patterns à améliorer
