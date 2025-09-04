# Guide de Configuration N8N pour DEB Processing

## 1. Prérequis

### Azure Form Recognizer
1. Créer une ressource Azure Form Recognizer
2. Obtenir la clé API et l'endpoint
3. Dans N8N, créer les credentials:
   - Type: `Generic Credential Type`
   - Name: `azureFormRecognizer`
   - Field: `subscriptionKey` = votre clé Azure

### Variables d'environnement N8N
```bash
COREMATCH_URL=https://votre-site.vercel.app
```

## 2. Import du Workflow

1. Copier le contenu de `n8n-workflow-deb-processing.json`
2. Dans N8N interface, aller à "Import from JSON"
3. Coller le JSON et importer

## 3. Configuration des Endpoints CoreMatch

Vous devez créer ces nouveaux endpoints dans votre application:

### `/api/deb/request-location` (POST)
```typescript
// Pour demander département/ville à l'utilisateur
export async function POST(request: NextRequest) {
  const data = await request.json();
  
  // Envoyer notification à l'utilisateur
  // ou créer une tâche en attente
  
  return NextResponse.json({
    success: true,
    message: 'Location request sent to user',
    document_id: data.document_id
  });
}
```

### `/api/deb/documents/[documentId]/finalize` (POST)
```typescript
// Pour sauvegarder les résultats finaux du traitement
export async function POST(request: NextRequest, { params }: { params: { documentId: string } }) {
  const { documentId } = await params;
  const data = await request.json();
  
  // Sauvegarder:
  // - Informations extraites
  // - Codes HS trouvés
  // - Liens avec BL
  // - Validations
  // - Répartition frais transport
  
  return NextResponse.json({
    success: true,
    document_updated: true
  });
}
```

## 4. Déclenchement du Workflow

### Depuis votre application
```typescript
// Après upload d'un PDF
const triggerN8N = async (documentData) => {
  const response = await fetch('https://votre-n8n.app/webhook/deb-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: documentData.id,
      file_url: documentData.file_url,
      org_id: documentData.org_id,
      name: documentData.name
    })
  });
  
  return response.json();
};
```

## 5. Fonctionnalités du Workflow

### ✅ Extraction OCR avec Azure Form Recognizer
- Reconnaissance automatique des factures
- Extraction des champs: fournisseur, montants, dates, articles

### ✅ Extraction Géographique
- Détection automatique département/ville depuis adresse
- Demande manuelle si non détecté

### ✅ Recherche Codes HS
- Base de données intégrée de codes HS courants
- Matching par mots-clés dans descriptions
- Marquage pour révision manuelle si nécessaire

### ✅ Recherche de Poids
- Expressions régulières pour détecter poids dans texte
- Support: kg, g, t, lb, livres
- Calcul poids total estimé

### ✅ Validations TVA et Conformité
- Validation format TVA française
- Vérification cohérence montants
- Contrôle seuils DEB (1000€, 8000€)

### ✅ Liaison avec BL (Bons de Livraison)
- Matching automatique par:
  - Nom fournisseur (40% poids)
  - Proximité dates (30% poids)  
  - Cohérence poids/montants (20% poids)
  - Coûts transport (10% poids)
- Répartition automatique frais transport

## 6. Monitoring et Logs

Le workflow génère des logs détaillés à chaque étape:
- Statut traitement OCR
- Codes HS trouvés/manqués
- Score matching BL
- Validations échouées

## 7. Gestion des Erreurs

### Documents nécessitant révision manuelle
- Codes HS non déterminés
- Informations géographiques manquantes  
- Validations TVA échouées
- Aucun BL correspondant trouvé

### Workflow de reprise
- Possibilité de reprendre traitement après input utilisateur
- Sauvegarde état intermédiaire
- Notifications pour actions requises

## 8. Optimisations Possibles

### Base de données HS Codes étendue
```typescript
// Connecter à une vraie base HS Codes
const hsDatabase = await fetch('https://api.tariff-codes.com/search', {
  method: 'POST',
  body: JSON.stringify({ description: item.description })
});
```

### Machine Learning pour matching BL
```typescript
// Utiliser un modèle ML pour améliorer matching
const mlScore = await fetch('https://your-ml-api.com/match-bl', {
  method: 'POST', 
  body: JSON.stringify({ invoice: invoice, bls: potentialBLs })
});
```

### Integration avec API externes
- API codes douaniers officiels
- Services de validation TVA
- APIs transport pour coûts réels

## 9. Sécurité

### Données sensibles
- Chiffrement des documents en transit
- Logs sans informations confidentielles
- Rétention limitée des données temporaires

### Authentification
- Validation token JWT dans webhook
- Vérification droits organisation
- Audit trail des traitements

## 10. Tests

### Test du workflow complet
```bash
curl -X POST https://votre-n8n.app/webhook/deb-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-doc-123",
    "file_url": "https://example.com/test-invoice.pdf",
    "org_id": "org-456", 
    "name": "facture-test.pdf"
  }'
```

Cette configuration te donnera un système complet de traitement automatisé des documents DEB avec toutes les fonctionnalités que tu as demandées. Le workflow peut traiter des PDF complexes avec plusieurs factures et BL, extraire automatiquement les informations nécessaires, et ne demander l'intervention humaine que quand c'est vraiment nécessaire.