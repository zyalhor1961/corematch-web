# 📦 Implémentation des Bounding Boxes - PDF Viewer

**Date:** 4 novembre 2024
**Objectif:** Ajouter un visualiseur PDF side-by-side avec bounding boxes color-coded pour le débogage des extractions

---

## ✅ RÉALISATIONS

### 1. Extraction des positions de texte depuis pdf2json

**Fichier:** `lib/daf-docs/extraction/pdf-detector.ts`

Nouvelle fonction `extractPDFTextWithPositions()` qui capture:
- Texte complet du PDF
- Position (x, y) de chaque élément de texte
- Numéro de page pour chaque élément
- Largeur et hauteur des éléments

```typescript
export interface TextPosition {
  text: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function extractPDFTextWithPositions(
  pdfBuffer: ArrayBuffer
): Promise<{
  text: string;
  pages: string[];
  positions: TextPosition[];
  metadata: any;
}>
```

**pdf2json** utilise des unités PDF (1 unité = 1/72 inch). Pour un A4 standard:
- Largeur: ~595 points
- Hauteur: ~842 points

---

### 2. Types mis à jour pour supporter les bounding boxes

**Fichier:** `lib/daf-docs/extraction/types.ts`

```typescript
export interface FieldBoundingBox {
  field: string;          // Nom du champ ('numero_facture', 'fournisseur', etc.)
  page: number;           // Numéro de page (0-indexed)
  x: number;              // Position X en unités PDF
  y: number;              // Position Y en unités PDF
  width: number;          // Largeur en unités PDF
  height: number;         // Hauteur en unités PDF
  text: string;           // Texte trouvé
}

export interface DAFExtractionResult {
  // ... champs existants ...
  field_positions?: FieldBoundingBox[];  // Nouveau!
}
```

---

### 3. Simple Text Extractor - Capture des positions

**Fichier:** `lib/daf-docs/extraction/simple-text-extractor.ts`

**Modifications:**
1. Utilise maintenant `extractPDFTextWithPositions()` au lieu de `extractPDFText()`
2. Nouvelle méthode `findTextPositions()` qui cherche les positions pour chaque champ extrait
3. Retourne `field_positions` dans le résultat

**Fonctionnement:**
```typescript
// Pour chaque champ extrait (numero_facture, fournisseur, montants, etc.)
if (numeroFacture) {
  const boxes = this.findTextPositions(numeroFacture, positions);
  boxes.forEach(box => {
    box.field = 'numero_facture';
    fieldPositions.push(box);
  });
}
```

**Résultat:** Log dans la console indiquant le nombre de bounding boxes trouvées:
```
[Simple Text] Found 12 bounding boxes
```

---

### 4. PDF Viewer avec Bounding Boxes

**Fichier:** `app/daf/documents/[id]/viewer/page.tsx`

**Fonctionnalités implémentées:**

#### A. Layout Side-by-Side
- **Gauche:** Affichage PDF avec `react-pdf`
- **Droite:** Champs extraits + métadonnées

#### B. Bounding Boxes Overlay
```typescript
{document.extraction_result?.field_positions?.map((box, idx) => {
  // Filtrer pour la page actuelle
  if (box.page !== pageNumber - 1) return null;

  // Conversion des coordonnées PDF → pixels d'affichage
  const PDF_WIDTH_PTS = 595;
  const DISPLAY_WIDTH = 600 * scale;
  const scaleFactor = DISPLAY_WIDTH / PDF_WIDTH_PTS;

  const left = box.x * scaleFactor;
  const top = box.y * scaleFactor;
  const width = box.width * scaleFactor || 100;
  const height = 20 * scale;

  return (
    <div
      className="absolute border-2"
      style={{
        borderColor: FIELD_COLORS[box.field],
        backgroundColor: `${FIELD_COLORS[box.field]}20`,  // 20% opacity
      }}
      title={`${box.field}: ${box.text}`}
    />
  );
})}
```

#### C. Code couleur des champs
```typescript
const FIELD_COLORS = {
  numero_facture: '#3B82F6',  // Bleu
  fournisseur: '#10B981',     // Vert
  montant_ttc: '#EF4444',     // Rouge
  montant_ht: '#F59E0B',      // Orange
  taux_tva: '#8B5CF6',        // Violet
  date_document: '#EC4899',   // Rose
  date_echeance: '#06B6D4',   // Cyan
};
```

#### D. Légende des zones détectées
Affiche le nombre de zones trouvées pour chaque type de champ:
```
Zones détectées
3 zone(s) trouvée(s) sur le PDF

[🔵] numero facture (1)
[🟢] fournisseur (1)
[🔴] montant ttc (1)
```

#### E. Contrôles de navigation
- **Zoom:** 50% à 300% avec boutons +/-
- **Pages:** Navigation entre pages si PDF multi-pages
- **Retour:** Bouton pour revenir à la liste des documents

---

### 5. API Endpoint pour récupérer un document

**Fichier:** `app/api/daf/documents/[id]/route.ts`

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: document, error } = await supabase
    .from('daf_documents')
    .select('*')
    .eq('id', params.id)
    .single();

  return NextResponse.json(document);
}
```

---

### 6. Navigation depuis la liste des documents

**Fichier:** `components/daf/DocumentInbox.tsx`

**Modifications:**
- Ajout du bouton "Analyse" avec icône Eye
- Navigation vers `/daf/documents/{id}/viewer`
- Bouton "PDF" pour télécharger le PDF original

```typescript
<button
  onClick={() => router.push(`/daf/documents/${doc.id}/viewer`)}
  className="flex items-center gap-1 text-sm text-blue-600"
>
  <Eye className="h-3.5 w-3.5" />
  Analyse
</button>
<span className="text-gray-300">|</span>
<button
  onClick={() => window.open(doc.file_url, '_blank')}
  className="text-sm text-gray-600"
>
  PDF
</button>
```

---

## 🎯 UTILISATION

### Comment tester le visualiseur:

1. **Démarrer le serveur:**
   ```bash
   npm run dev
   # Serveur sur: http://localhost:3011
   ```

2. **Accéder à la démo DAF:**
   ```
   http://localhost:3011/daf-demo
   ```

3. **Uploader un PDF:**
   - Onglet "Upload"
   - Glisser-déposer un PDF de facture
   - Attendre l'extraction

4. **Visualiser avec bounding boxes:**
   - Onglet "Mes documents"
   - Cliquer sur "Analyse" pour un document
   - **→ Le viewer s'ouvre avec le PDF + bounding boxes**

### Ce que vous verrez:

**Gauche:** PDF affiché avec des rectangles colorés sur le texte détecté:
- 🔵 Bleu = Numéro de facture
- 🟢 Vert = Fournisseur
- 🔴 Rouge = Montant TTC
- 🟠 Orange = Montant HT
- 🟣 Violet = Taux TVA
- 💗 Rose = Date document
- 🔵 Cyan = Date échéance

**Droite:**
- Champs extraits avec valeurs
- Légende des couleurs
- Nombre de zones détectées par champ
- Métadonnées (durée extraction, confidence, etc.)
- Aperçu du texte brut

---

## 🔧 COMMENT ÇA FONCTIONNE

### 1. Extraction (Backend)
```
PDF Upload
    ↓
pdf2json parse
    ↓
extractPDFTextWithPositions()
    ↓
Regex patterns match text
    ↓
findTextPositions() cherche les coordonnées
    ↓
Retourne field_positions[] dans DAFExtractionResult
    ↓
Stocké dans Supabase (extraction_result.field_positions)
```

### 2. Affichage (Frontend)
```
Chargement du document depuis API
    ↓
react-pdf affiche le PDF
    ↓
Overlay <div> avec bounding boxes
    ↓
Pour chaque box:
  - Filtrer par page actuelle
  - Convertir coordonnées PDF → pixels
  - Appliquer couleur selon field type
  - Afficher avec 20% opacité
```

### 3. Conversion des coordonnées

**Problème:** pdf2json utilise des unités PDF, react-pdf affiche en pixels

**Solution:** Facteur de scale dynamique
```typescript
const PDF_WIDTH_PTS = 595;              // Largeur A4 en points PDF
const DISPLAY_WIDTH = 600 * scale;      // Largeur affichée en pixels
const scaleFactor = DISPLAY_WIDTH / PDF_WIDTH_PTS;

const left = box.x * scaleFactor;
const top = box.y * scaleFactor;
const width = box.width * scaleFactor;
```

---

## 🐛 PROBLÈMES CONNUS

### 1. Précision des bounding boxes

**Statut:** Approximatif
**Cause:** pdf2json ne fournit pas toujours la largeur exacte des éléments de texte
**Impact:** Les boxes peuvent être trop larges ou trop courtes
**Solution future:** Utiliser un OCR avec positions précises (Landing AI)

### 2. Hauteur fixe des boxes

**Statut:** Hardcodé à `20 * scale`
**Cause:** pdf2json ne donne pas toujours la hauteur du texte
**Solution actuelle:** Hauteur approximative basée sur le zoom
**Solution future:** Calculer la hauteur basée sur la taille de police

### 3. Texte multi-ligne

**Statut:** Non géré
**Cause:** Un champ peut être sur plusieurs lignes (ex: adresse fournisseur)
**Impact:** Seulement la première occurrence est marquée
**Solution future:** Détecter et merger les boxes adjacentes

---

## 📈 PROCHAINES AMÉLIORATIONS

### Priorité 1: Améliorer les patterns regex
- **Problème actuel:** Confiance faible (0.45)
- **Action:** Analyser le texte brut extrait avec le visualiseur
- **Objectif:** Monter la confiance à >0.8

### Priorité 2: Améliorer le matching des positions
- Utiliser fuzzy matching pour trouver les textes
- Gérer les variantes (espaces, casse, accents)
- Merger les boxes adjacentes pour un même champ

### Priorité 3: Intégration Landing AI
- Landing AI retourne déjà des bounding boxes précises
- Utiliser ces boxes quand disponibles
- Fallback vers pdf2json pour PDFs natifs

---

## 🎓 VALEUR AJOUTÉE

### Pour le développement:
✅ **Débogage visuel:** Voir exactement ce que le parser détecte
✅ **Amélioration patterns:** Identifier pourquoi certains champs ne sont pas trouvés
✅ **Validation extraction:** Vérifier que les bonnes zones sont détectées

### Pour l'utilisateur:
✅ **Transparence:** Comprendre ce qui a été extrait
✅ **Confiance:** Voir visuellement les données détectées
✅ **Correction:** Identifier facilement les erreurs d'extraction

### Pour le business:
✅ **Qualité:** Améliorer les patterns = meilleure extraction = moins d'erreurs
✅ **Coûts:** Optimiser le parser gratuit = moins besoin de Landing AI
✅ **Support:** Les utilisateurs peuvent auto-diagnostiquer les problèmes

---

## 📝 FICHIERS MODIFIÉS/CRÉÉS

### Créés:
- ✅ `app/daf/documents/[id]/viewer/page.tsx` - Viewer complet
- ✅ `app/api/daf/documents/[id]/route.ts` - API endpoint
- ✅ `BOUNDING_BOX_IMPLEMENTATION.md` - Cette doc

### Modifiés:
- ✅ `lib/daf-docs/extraction/pdf-detector.ts` - Ajout `extractPDFTextWithPositions()`
- ✅ `lib/daf-docs/extraction/types.ts` - Ajout `FieldBoundingBox` interface
- ✅ `lib/daf-docs/extraction/simple-text-extractor.ts` - Capture positions
- ✅ `components/daf/DocumentInbox.tsx` - Bouton "Analyse"

---

## 🚀 COMMANDE DE DÉMARRAGE

```bash
# Depuis F:\corematch
npm run dev

# Serveur démarre sur http://localhost:3011
# Accéder à: http://localhost:3011/daf-demo
```

---

**Développé par:** CoreMatch Team
**Dernière mise à jour:** 4 novembre 2024 23:24
**Status:** ✅ Fonctionnel - Prêt pour tests
