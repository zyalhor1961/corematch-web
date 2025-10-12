# DEB System Usage Examples

Complete examples showing how to use the DEB processing system.

## Table of Contents

1. [Complete End-to-End Flow](#1-complete-end-to-end-flow)
2. [Service Usage Examples](#2-service-usage-examples)
3. [API Endpoint Examples](#3-api-endpoint-examples)
4. [UI Component Usage](#4-ui-component-usage)
5. [Testing Examples](#5-testing-examples)

---

## 1. Complete End-to-End Flow

### Scenario: Process an invoice from upload to export

```typescript
// example-complete-flow.ts

import { performVATControls } from '@/lib/services/deb/vat-control';
import { enrichHSCodes } from '@/lib/services/deb/hs-code-enrichment';
import { recordValidation } from '@/lib/services/deb/auto-learning';
import { prepareForArchiving, exportToSAE } from '@/lib/services/deb/archiving';
import { allocateShipping } from '@/lib/utils/shipping';

async function processInvoiceComplete(documentId: string, orgId: string) {
  console.log('🚀 Starting complete DEB processing...\n');

  // STEP 1: Run VAT Controls
  console.log('1️⃣ Running VAT controls...');
  const vatResult = await performVATControls({
    documentId,
    netAmount: 10000.00,
    taxAmount: 2000.00,
    totalAmount: 12000.00,
    vendorVAT: 'DE123456789',
    vendorCountry: 'DE',
    currency: 'EUR'
  });

  console.log(`   Status: ${vatResult.overallStatus}`);
  console.log(`   Arithmetic TTC: ${vatResult.controls.arithmeticTTC.status}`);
  console.log(`   Intra-EU: ${vatResult.controls.intraEUClassification.status}`);
  console.log(`   VAT Zero: ${vatResult.controls.vatZeroVerification.status}\n`);

  if (vatResult.needsManualReview) {
    console.log('   ⚠️  Manual review required!\n');
  }

  // STEP 2: Enrich HS Codes
  console.log('2️⃣ Enriching HS codes...');
  const enrichmentResult = await enrichHSCodes({
    orgId,
    documentId,
    lineItems: [
      {
        lineId: 'line-1',
        description: 'Laptop computer Dell XPS 13',
        sku: 'LAPTOP-XPS13',
        quantity: 2,
        unitPrice: 1500.00,
        valueHT: 3000.00
      },
      {
        lineId: 'line-2',
        description: 'Wireless mouse Logitech MX Master',
        sku: 'MOUSE-MX',
        quantity: 5,
        unitPrice: 80.00,
        valueHT: 400.00
      },
      {
        lineId: 'line-3',
        description: 'USB-C cable 2m',
        quantity: 10,
        unitPrice: 15.00,
        valueHT: 150.00
      }
    ]
  });

  console.log(`   Total lines: ${enrichmentResult.summary.totalLines}`);
  console.log(`   From Reference DB: ${enrichmentResult.summary.fromReferenceDB}`);
  console.log(`   From OpenAI: ${enrichmentResult.summary.fromOpenAI}`);
  console.log(`   Reference hit rate: ${enrichmentResult.referenceHitRate.toFixed(1)}%\n`);

  // STEP 3: User Validation (simulated)
  console.log('3️⃣ Simulating user validation...');
  for (const suggestion of enrichmentResult.suggestions) {
    console.log(`   Validating: ${suggestion.description}`);
    console.log(`     HS Code: ${suggestion.hsCode} (${suggestion.source})`);
    console.log(`     Weight: ${suggestion.weightKg} kg`);
    console.log(`     Confidence: ${(suggestion.confidence * 100).toFixed(0)}%`);

    // Record validation (saves to learning database)
    const learningResult = await recordValidation({
      orgId,
      description: suggestion.description,
      hsCode: suggestion.hsCode,
      weightKg: suggestion.weightKg || 1.0,
      validatedBy: 'user-123'
    });

    console.log(`     ✅ ${learningResult.message}\n`);
  }

  // STEP 4: Allocate Transport Fees
  console.log('4️⃣ Allocating transport fees...');
  const lineItems = enrichmentResult.suggestions.map(s => ({
    line_amount: s.description.includes('Laptop') ? 3000 : s.description.includes('mouse') ? 400 : 150,
    qty: s.description.includes('Laptop') ? 2 : s.description.includes('mouse') ? 5 : 10,
    net_mass_kg: s.weightKg
  }));

  const shippingAllocations = allocateShipping(
    lineItems,
    150.00, // Total shipping cost
    'value' // Allocate proportionally to value
  );

  console.log(`   Total shipping: €150.00`);
  shippingAllocations.forEach((amount, index) => {
    console.log(`   Line ${index + 1}: €${amount.toFixed(2)}`);
  });
  console.log();

  // STEP 5: Prepare for Archiving
  console.log('5️⃣ Preparing for archiving...');
  const archiveResult = await prepareForArchiving(documentId);

  if (archiveResult.success) {
    console.log(`   ✅ ${archiveResult.message}`);
    console.log(`   Completeness: ${archiveResult.validation.completeness}%`);
    console.log(`   Ready for export: ${archiveResult.validation.valid}\n`);
  } else {
    console.log(`   ❌ ${archiveResult.message}`);
    console.log(`   Errors: ${archiveResult.validation.errors.join(', ')}\n`);
    return;
  }

  // STEP 6: Export to SAE (if ready)
  if (archiveResult.validation.valid) {
    console.log('6️⃣ Exporting to SAE...');
    const exportResult = await exportToSAE(documentId);

    if (exportResult.success) {
      console.log(`   ✅ ${exportResult.message}`);
      console.log(`   Export ID: ${exportResult.exportId}\n`);
    } else {
      console.log(`   ❌ ${exportResult.message}\n`);
    }
  }

  console.log('🎉 Complete DEB processing finished!');
}

// Run example
processInvoiceComplete('doc-123', 'org-456');
```

**Expected Output:**
```
🚀 Starting complete DEB processing...

1️⃣ Running VAT controls...
   Status: passed
   Arithmetic TTC: passed
   Intra-EU: passed
   VAT Zero: passed

2️⃣ Enriching HS codes...
   Total lines: 3
   From Reference DB: 0
   From OpenAI: 3
   Reference hit rate: 0.0%

3️⃣ Simulating user validation...
   Validating: Laptop computer Dell XPS 13
     HS Code: 84713000 (openai)
     Weight: 1.8 kg
     Confidence: 70%
     ✅ New article added to reference database

   Validating: Wireless mouse Logitech MX Master
     HS Code: 84716060 (openai)
     Weight: 0.15 kg
     Confidence: 70%
     ✅ New article added to reference database

   Validating: USB-C cable 2m
     HS Code: 85444290 (openai)
     Weight: 0.05 kg
     Confidence: 70%
     ✅ New article added to reference database

4️⃣ Allocating transport fees...
   Total shipping: €150.00
   Line 1: €126.76
   Line 2: €16.90
   Line 3: €6.34

5️⃣ Preparing for archiving...
   ✅ Document prepared for archiving successfully
   Completeness: 100%
   Ready for export: true

6️⃣ Exporting to SAE...
   ✅ Document exported to SAE successfully
   Export ID: SAE-1735824000000

🎉 Complete DEB processing finished!
```

---

## 2. Service Usage Examples

### 2.1 VAT Control Service

```typescript
import { performVATControls, validateArithmeticTTC, classifyIntraEU } from '@/lib/services/deb/vat-control';

// Example 1: Basic VAT controls
async function example1() {
  const result = await performVATControls({
    documentId: 'doc-123',
    netAmount: 1000.00,
    taxAmount: 200.00,
    totalAmount: 1200.00,
    vendorVAT: 'FR12345678901',
    currency: 'EUR'
  });

  console.log(result.overallStatus); // 'passed' | 'warning' | 'failed'
}

// Example 2: Standalone arithmetic validation
function example2() {
  const result = validateArithmeticTTC(1000, 200, 1200, 2.00);

  if (result.passed) {
    console.log('✅ TTC validation passed');
  } else {
    console.log(`❌ TTC error: ${result.message}`);
    console.log(`Difference: €${result.difference}`);
  }
}

// Example 3: Intra-EU classification
function example3() {
  const result = classifyIntraEU('DE', 'DE123456789');

  console.log(`Is Intra-EU: ${result.isIntraEU}`);
  console.log(`VAT Regime: ${result.vatRegime}`);
}
```

### 2.2 HS Code Enrichment Service

```typescript
import { enrichHSCodes, validateHSCodeFormat, formatHSCode } from '@/lib/services/deb/hs-code-enrichment';

// Example 1: Enrich multiple line items
async function example1() {
  const result = await enrichHSCodes({
    orgId: 'org-123',
    documentId: 'doc-456',
    lineItems: [
      {
        lineId: 'line-1',
        description: 'Steel pipes for industrial use',
        quantity: 100,
        unitPrice: 50,
        valueHT: 5000
      }
    ]
  });

  for (const suggestion of result.suggestions) {
    console.log(`HS Code: ${suggestion.hsCode}`);
    console.log(`Weight: ${suggestion.weightKg} kg`);
    console.log(`Source: ${suggestion.source}`);
    console.log(`Confidence: ${(suggestion.confidence * 100).toFixed(0)}%`);
    if (suggestion.reasoning) {
      console.log(`Reasoning: ${suggestion.reasoning}`);
    }
  }
}

// Example 2: Validate HS code format
function example2() {
  console.log(validateHSCodeFormat('84713000')); // true
  console.log(validateHSCodeFormat('8471.30.00')); // true (auto-cleans)
  console.log(validateHSCodeFormat('8471')); // false (too short)
}

// Example 3: Format HS code for display
function example3() {
  console.log(formatHSCode('84713000')); // '8471.30.00'
}
```

### 2.3 Auto-Learning Service

```typescript
import {
  recordValidation,
  getLearningStats,
  getArticleReference,
  searchSimilarArticles,
  exportReferenceToCSV
} from '@/lib/services/deb/auto-learning';

// Example 1: Record a validation
async function example1() {
  const result = await recordValidation({
    orgId: 'org-123',
    description: 'Laptop computer',
    hsCode: '84713000',
    weightKg: 2.5,
    sku: 'LAPTOP-001',
    validatedBy: 'user-456'
  });

  console.log(result.message); // 'New article added' or 'Updated existing'
  console.log(`Is new: ${result.isNew}`);
}

// Example 2: Get learning statistics
async function example2() {
  const stats = await getLearningStats('org-123');

  if (stats) {
    console.log(`Total articles: ${stats.totalArticles}`);
    console.log(`User validated: ${stats.userValidatedCount}`);
    console.log(`AI suggested: ${stats.aiSuggestedCount}`);
    console.log(`Avg confidence: ${(stats.avgConfidence * 100).toFixed(1)}%`);
  }
}

// Example 3: Search similar articles
async function example3() {
  const similar = await searchSimilarArticles(
    'org-123',
    'laptop computer dell',
    5
  );

  for (const article of similar) {
    console.log(`${article.description} (${article.similarity * 100}% match)`);
    console.log(`HS Code: ${article.hsCode}, Weight: ${article.weightKg} kg`);
  }
}

// Example 4: Export to CSV
async function example4() {
  const csv = await exportReferenceToCSV('org-123');
  console.log(csv); // CSV string ready for download
}
```

---

## 3. API Endpoint Examples

### 3.1 Using fetch() in React components

```typescript
// VAT Controls
async function runVATControls(documentId: string) {
  const response = await fetch(`/api/deb/documents/${documentId}/vat-control`, {
    method: 'POST'
  });
  const data = await response.json();
  return data;
}

// HS Code Enrichment
async function enrichDocument(documentId: string, forceRefresh = false) {
  const response = await fetch(`/api/deb/documents/${documentId}/enrich-hs-codes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ forceRefresh })
  });
  const data = await response.json();
  return data;
}

// Validate Line
async function validateLine(documentId: string, lineData: any) {
  const response = await fetch(`/api/deb/documents/${documentId}/validate-line`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lineData)
  });
  const data = await response.json();
  return data;
}

// Batch Validate
async function batchValidate(documentId: string, validations: any[]) {
  const response = await fetch(`/api/deb/documents/${documentId}/validate-line`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ validations })
  });
  const data = await response.json();
  return data;
}

// Prepare for Archive
async function prepareArchive(documentId: string, exportImmediately = false) {
  const response = await fetch(`/api/deb/documents/${documentId}/prepare-archive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exportImmediately })
  });
  const data = await response.json();
  return data;
}

// Get Learning Stats
async function getLearningStats(orgId: string) {
  const response = await fetch(`/api/deb/reference/stats?orgId=${orgId}`);
  const data = await response.json();
  return data.stats;
}

// Export Reference Database
function downloadReferenceCSV(orgId: string) {
  window.location.href = `/api/deb/reference/export?orgId=${orgId}`;
}
```

### 3.2 Using curl for testing

```bash
# Run VAT controls
curl -X POST http://localhost:3000/api/deb/documents/doc-123/vat-control \
  -H "Content-Type: application/json"

# Enrich HS codes
curl -X POST http://localhost:3000/api/deb/documents/doc-123/enrich-hs-codes \
  -H "Content-Type: application/json" \
  -d '{"forceRefresh": true}'

# Validate a line
curl -X POST http://localhost:3000/api/deb/documents/doc-123/validate-line \
  -H "Content-Type: application/json" \
  -d '{
    "lineId": "line-1",
    "hsCode": "84713000",
    "weightKg": 2.5,
    "description": "Laptop computer"
  }'

# Get learning stats
curl http://localhost:3000/api/deb/reference/stats?orgId=org-123

# Import articles
curl -X POST http://localhost:3000/api/deb/reference/import \
  -H "Content-Type: application/json" \
  -d '{
    "orgId": "org-123",
    "importedBy": "user-456",
    "articles": [
      {
        "description": "Laptop Dell XPS",
        "hsCode": "84713000",
        "weightKg": 2.5,
        "sku": "LAPTOP-XPS"
      }
    ]
  }'
```

---

## 4. UI Component Usage

### 4.1 Main Validation Interface

```tsx
// app/deb/[documentId]/validate/page.tsx

import { DEBValidationInterface } from '@/app/components/deb/DEBValidationInterface';

export default function DEBValidationPage({
  params
}: {
  params: { documentId: string };
}) {
  const handleComplete = () => {
    console.log('Validation complete!');
    // Redirect to export page or show success message
  };

  return (
    <DEBValidationInterface
      documentId={params.documentId}
      orgId="org-123"
      onComplete={handleComplete}
    />
  );
}
```

### 4.2 Individual Components

```tsx
// Using VAT Control Summary
import { VATControlSummary } from '@/app/components/deb/VATControlSummary';

function MyComponent() {
  const [controls, setControls] = useState(null);

  useEffect(() => {
    // Load controls from API
    fetchControls();
  }, []);

  if (!controls) return null;

  return <VATControlSummary controls={controls} />;
}

// Using HS Code Input
import { HSCodeInput } from '@/app/components/deb/HSCodeInput';

function MyForm() {
  const [hsCode, setHSCode] = useState('');

  return (
    <HSCodeInput
      value={hsCode}
      onChange={setHSCode}
      disabled={false}
    />
  );
}

// Using Enrichment Badge
import { EnrichmentBadge } from '@/app/components/deb/EnrichmentBadge';

function LineItemRow({ item }) {
  return (
    <tr>
      <td>{item.description}</td>
      <td>
        <EnrichmentBadge
          source={item.source}
          confidence={item.confidence}
        />
      </td>
    </tr>
  );
}

// Using Learning Stats Card
import { LearningStatsCard } from '@/app/components/deb/LearningStatsCard';

function Dashboard({ orgId }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <LearningStatsCard orgId={orgId} />
      {/* Other dashboard cards */}
    </div>
  );
}
```

---

## 5. Testing Examples

### 5.1 Unit Tests

```typescript
// __tests__/vat-control.test.ts

import { validateArithmeticTTC, classifyIntraEU } from '@/lib/services/deb/vat-control';

describe('VAT Control Service', () => {
  describe('validateArithmeticTTC', () => {
    it('should pass when amounts are correct', () => {
      const result = validateArithmeticTTC(1000, 200, 1200, 2.00);
      expect(result.passed).toBe(true);
      expect(result.status).toBe('passed');
    });

    it('should fail when difference exceeds tolerance', () => {
      const result = validateArithmeticTTC(1000, 200, 1205, 2.00);
      expect(result.passed).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.difference).toBe(5);
    });

    it('should warn when within tolerance', () => {
      const result = validateArithmeticTTC(1000, 200, 1201, 2.00);
      expect(result.passed).toBe(true);
      expect(result.status).toBe('warning');
    });
  });

  describe('classifyIntraEU', () => {
    it('should detect intra-EU transaction', () => {
      const result = classifyIntraEU('DE', 'DE123456789');
      expect(result.isIntraEU).toBe(true);
      expect(result.vatRegime).toBe('reverse_charge');
    });

    it('should detect extra-EU transaction', () => {
      const result = classifyIntraEU('US', 'US123456789');
      expect(result.isIntraEU).toBe(false);
      expect(result.vatRegime).toBe('standard');
    });
  });
});
```

### 5.2 Integration Tests

```typescript
// __tests__/integration/deb-flow.test.ts

describe('Complete DEB Flow', () => {
  let documentId: string;
  const orgId = 'test-org';

  beforeAll(async () => {
    // Setup: Create test document
    documentId = await createTestDocument();
  });

  it('should process document end-to-end', async () => {
    // 1. Run VAT controls
    const vatResult = await performVATControls({
      documentId,
      netAmount: 1000,
      taxAmount: 200,
      totalAmount: 1200,
      vendorVAT: 'DE123456789'
    });

    expect(vatResult.passed).toBe(true);

    // 2. Enrich HS codes
    const enrichResult = await enrichHSCodes({
      orgId,
      documentId,
      lineItems: [/* test items */]
    });

    expect(enrichResult.suggestions.length).toBeGreaterThan(0);

    // 3. Validate lines
    for (const suggestion of enrichResult.suggestions) {
      const validateResult = await recordValidation({
        orgId,
        description: suggestion.description,
        hsCode: suggestion.hsCode,
        weightKg: suggestion.weightKg || 1.0,
        validatedBy: 'test-user'
      });

      expect(validateResult.success).toBe(true);
    }

    // 4. Prepare for archive
    const archiveResult = await prepareForArchiving(documentId);

    expect(archiveResult.success).toBe(true);
    expect(archiveResult.validation.valid).toBe(true);
  });
});
```

---

## Quick Reference

### Service Imports

```typescript
// VAT Controls
import { performVATControls } from '@/lib/services/deb/vat-control';

// HS Enrichment
import { enrichHSCodes } from '@/lib/services/deb/hs-code-enrichment';

// Auto-Learning
import { recordValidation, getLearningStats } from '@/lib/services/deb/auto-learning';

// Archiving
import { prepareForArchiving, exportToSAE } from '@/lib/services/deb/archiving';

// Allocation
import { allocateShipping } from '@/lib/utils/shipping';
```

### API Endpoints

```
POST   /api/deb/documents/[id]/vat-control
GET    /api/deb/documents/[id]/vat-control
POST   /api/deb/documents/[id]/enrich-hs-codes
GET    /api/deb/documents/[id]/enrich-hs-codes
POST   /api/deb/documents/[id]/validate-line
PUT    /api/deb/documents/[id]/validate-line (batch)
POST   /api/deb/documents/[id]/prepare-archive
GET    /api/deb/documents/[id]/prepare-archive
GET    /api/deb/reference/stats?orgId=xxx
POST   /api/deb/reference/import
GET    /api/deb/reference/export?orgId=xxx
GET    /api/deb/reference/articles?orgId=xxx
DELETE /api/deb/reference/articles?orgId=xxx&articleId=xxx
```

---

**Document Version**: 1.0
**Last Updated**: 2025-10-12
