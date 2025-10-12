# DEB Processing - Technical Specification

## Executive Summary

This document describes the implementation of the complete DEB (Déclaration d'Échanges de Biens) processing system for CoreMatch, including VAT control, auto-learning HS code enrichment, and allocation rules.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Database Schema](#database-schema)
3. [Business Logic Components](#business-logic-components)
4. [API Endpoints](#api-endpoints)
5. [UI Components](#ui-components)
6. [Integration Points](#integration-points)

---

## 1. System Architecture

### Current Infrastructure

```
┌─────────────────────┐
│  User Upload        │
│  (PDF Invoice)      │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Azure Document     │
│  Intelligence       │
│  (OCR + Fields)     │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Raw JSON Data      │
│  Extraction         │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐     ┌──────────────────┐
│  DEB Logic Layer    │────▶│  OpenAI Service  │
│  (This Spec)        │     │  (HS Code)       │
└──────┬──────────────┘     └──────────────────┘
       │
       │  ┌──────────────────────┐
       ├─▶│ VAT Control          │
       │  └──────────────────────┘
       │
       │  ┌──────────────────────┐
       ├─▶│ HS Code Enrichment   │
       │  └──────────────────────┘
       │
       │  ┌──────────────────────┐
       ├─▶│ Allocation Rules     │
       │  └──────────────────────┘
       │
       ▼
┌─────────────────────┐
│  Validation UI      │
│  (User Review)      │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  SAE Archive        │
│  (Tiers Archiveur)  │
└─────────────────────┘
```

### Technology Stack

- **Backend**: Next.js 14+ App Router API Routes
- **Database**: PostgreSQL (Supabase)
- **Document Intelligence**: Azure AI Document Intelligence
- **AI Services**: OpenAI GPT-4o/GPT-4o-mini
- **Frontend**: React 18+ with TypeScript
- **UI Components**: Shadcn/UI + Tailwind CSS

---

## 2. Database Schema

### 2.1 New Table: `deb_article_reference`

**Purpose**: Auto-learning reference database for HS codes and weights

```sql
CREATE TABLE deb_article_reference (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Article Identification
    description TEXT NOT NULL,
    description_normalized TEXT NOT NULL, -- Lowercased, trimmed for matching
    sku VARCHAR(100), -- Optional SKU reference

    -- DEB Data
    hs_code CHAR(8) NOT NULL, -- 8-digit HS/NC code
    weight_net_kg DECIMAL(10,3) NOT NULL, -- Net weight per unit in kg
    country_of_origin CHAR(2), -- ISO 3166-1 alpha-2

    -- Confidence & Learning
    confidence_score DECIMAL(5,4) DEFAULT 1.0000, -- 0-1, increases with validations
    validation_count INTEGER DEFAULT 1, -- How many times validated
    last_validated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),

    -- Source Tracking
    source VARCHAR(50) DEFAULT 'user_validated' CHECK (source IN (
        'user_validated',
        'openai_suggested',
        'manual_entry',
        'imported'
    )),

    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),

    -- Unique constraint on normalized description per organization
    UNIQUE(org_id, description_normalized)
);

-- Indexes for performance
CREATE INDEX idx_deb_article_org_description ON deb_article_reference(org_id, description_normalized);
CREATE INDEX idx_deb_article_hs_code ON deb_article_reference(hs_code);
CREATE INDEX idx_deb_article_confidence ON deb_article_reference(confidence_score DESC);
```

### 2.2 Enhanced Table: `idp_documents`

**Add VAT control fields**:

```sql
ALTER TABLE idp_documents
ADD COLUMN IF NOT EXISTS vat_control_status VARCHAR(50) CHECK (vat_control_status IN (
    'pending',
    'passed',
    'warning',
    'failed',
    'manual_review'
)),
ADD COLUMN IF NOT EXISTS vat_control_results JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS is_intra_eu BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS vat_regime VARCHAR(50) CHECK (vat_regime IN (
    'standard',
    'reverse_charge',
    'exempted',
    'not_applicable'
));
```

### 2.3 Enhanced Table: `idp_extracted_fields`

**Add HS code enrichment fields**:

```sql
ALTER TABLE idp_extracted_fields
ADD COLUMN IF NOT EXISTS hs_code_suggested CHAR(8),
ADD COLUMN IF NOT EXISTS hs_code_confidence DECIMAL(5,4),
ADD COLUMN IF NOT EXISTS hs_code_source VARCHAR(50) CHECK (hs_code_source IN (
    'reference_db',
    'openai',
    'user_corrected',
    'azure_extracted'
)),
ADD COLUMN IF NOT EXISTS weight_kg_suggested DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS weight_source VARCHAR(50) CHECK (weight_source IN (
    'reference_db',
    'rule_of_three',
    'openai_estimated',
    'user_entered',
    'delivery_note'
));
```

### 2.4 New Table: `deb_vat_controls`

**Purpose**: Track VAT control validation results per document

```sql
CREATE TABLE deb_vat_controls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES idp_documents(id) ON DELETE CASCADE,

    -- Control Results
    control_type VARCHAR(50) NOT NULL CHECK (control_type IN (
        'arithmetic_ttc',
        'intra_eu_classification',
        'vat_zero_verification'
    )),

    status VARCHAR(50) NOT NULL CHECK (status IN (
        'passed',
        'warning',
        'failed'
    )),

    -- Values
    expected_value DECIMAL(15,4),
    actual_value DECIMAL(15,4),
    difference DECIMAL(15,4),
    tolerance DECIMAL(15,4),

    -- Details
    message TEXT,
    severity VARCHAR(50) CHECK (severity IN ('info', 'warning', 'error', 'critical')),

    -- Metadata
    auto_resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

CREATE INDEX idx_deb_vat_controls_document ON deb_vat_controls(document_id);
CREATE INDEX idx_deb_vat_controls_status ON deb_vat_controls(status);
```

---

## 3. Business Logic Components

### 3.1 VAT Control Service

**Location**: `lib/services/deb/vat-control.ts`

```typescript
interface VATControlConfig {
  toleranceAmount: number; // Default: 2.00 EUR
  euCountries: string[];   // List of EU country codes
}

interface VATControlResult {
  passed: boolean;
  status: 'passed' | 'warning' | 'failed';
  controls: {
    arithmeticTTC: ControlDetail;
    intraEUClassification: ControlDetail;
    vatZeroVerification: ControlDetail;
  };
}

interface ControlDetail {
  passed: boolean;
  message: string;
  expected?: number;
  actual?: number;
  difference?: number;
}
```

**Key Functions**:

1. **`validateArithmeticTTC()`**
   - Formula: `net_amount + tax_amount = total_amount`
   - Tolerance: ±2.00 EUR (configurable)
   - Status: `failed` if exceeds tolerance, `warning` if close, `passed` if within

2. **`classifyIntraEU()`**
   - Extract country code from vendor VAT number (first 2 chars)
   - Check if country is in EU list
   - Mark document as `is_intra_eu = true/false`

3. **`verifyVATZero()`**
   - If `is_intra_eu = true` AND `tax_amount = 0`
   - Then `vat_regime = 'reverse_charge'`
   - Else if `is_intra_eu = true` AND `tax_amount > 0`, flag as warning

### 3.2 HS Code Enrichment Service

**Location**: `lib/services/deb/hs-code-enrichment.ts`

```typescript
interface HSCodeSuggestion {
  hsCode: string;      // 8-digit HS code
  confidence: number;  // 0.0 - 1.0
  source: 'reference_db' | 'openai' | 'azure_extracted';
  weightKg: number | null;
  reasoning?: string;  // OpenAI reasoning
}

interface EnrichmentRequest {
  orgId: string;
  documentId: string;
  lineItems: Array<{
    lineId: string;
    description: string;
    sku?: string;
    quantity: number;
    unitPrice: number;
  }>;
}
```

**Process Flow**:

```
For each line item:
  1. Normalize description (lowercase, trim)
  2. Search deb_article_reference by description_normalized
  3. IF FOUND:
       ├─ Use hs_code and weight_net_kg from reference
       ├─ confidence_score = reference confidence
       └─ source = 'reference_db'
  4. ELSE:
       ├─ Call OpenAI with specialized prompt
       ├─ Parse JSON response { hs_code, weight_kg_estimated, reasoning }
       ├─ confidence_score = 0.70 (default for AI)
       └─ source = 'openai'
  5. Update idp_extracted_fields with suggestions
  6. Return suggestions to UI for validation
```

**OpenAI Prompt Template**:

```
You are a customs classification expert specializing in HS codes (Harmonized System).

Analyze the following product description and provide:
1. The most appropriate 8-digit HS/NC code
2. Estimated net weight per unit in kilograms
3. Brief reasoning for the classification

Product Description: {description}
SKU (if available): {sku}
Quantity: {quantity}
Unit Price: {unitPrice} EUR

Return ONLY a JSON object:
{
  "hs_code": "XXXXXXXX",
  "weight_kg_estimated": 0.0,
  "reasoning": "Brief explanation"
}
```

### 3.3 Auto-Learning Service

**Location**: `lib/services/deb/auto-learning.ts`

```typescript
interface LearningUpdate {
  orgId: string;
  description: string;
  hsCode: string;
  weightKg: number;
  validatedBy: string;
}

async function recordValidation(update: LearningUpdate): Promise<void> {
  const normalized = update.description.toLowerCase().trim();

  // Upsert into deb_article_reference
  await supabase
    .from('deb_article_reference')
    .upsert({
      org_id: update.orgId,
      description: update.description,
      description_normalized: normalized,
      hs_code: update.hsCode,
      weight_net_kg: update.weightKg,
      source: 'user_validated',
      validation_count: 1, // Will increment via trigger
      confidence_score: 1.0000,
      last_validated_at: new Date().toISOString()
    }, {
      onConflict: 'org_id,description_normalized',
      ignoreDuplicates: false
    });
}
```

**Database Trigger** (increment validation_count):

```sql
CREATE OR REPLACE FUNCTION increment_validation_count()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.id IS NOT NULL THEN
        -- Update existing record
        NEW.validation_count = OLD.validation_count + 1;
        NEW.confidence_score = LEAST(1.0, OLD.confidence_score + 0.05);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_increment_validation
BEFORE UPDATE ON deb_article_reference
FOR EACH ROW EXECUTE FUNCTION increment_validation_count();
```

### 3.4 Allocation Rules Service

**Location**: `lib/services/deb/allocation-rules.ts`

**Extend existing `lib/utils/shipping.ts`**

```typescript
interface WeightAllocationRequest {
  totalWeightKg: number; // Total weight from invoice/delivery note
  lineItems: Array<{
    lineId: string;
    valueHT: number;
    knownWeightKg?: number;
  }>;
}

interface WeightAllocationResult {
  allocations: Array<{
    lineId: string;
    allocatedWeightKg: number;
    method: 'known' | 'rule_of_three';
  }>;
}

function allocateWeightByValue(request: WeightAllocationRequest): WeightAllocationResult {
  // 1. Separate lines with known weight vs unknown
  const knownWeight = request.lineItems
    .filter(l => l.knownWeightKg)
    .reduce((sum, l) => sum + l.knownWeightKg!, 0);

  const remainingWeight = request.totalWeightKg - knownWeight;

  // 2. For lines without weight, use rule of three (proportional to value)
  const unknownLines = request.lineItems.filter(l => !l.knownWeightKg);
  const totalValue = unknownLines.reduce((sum, l) => sum + l.valueHT, 0);

  const allocations = request.lineItems.map(line => {
    if (line.knownWeightKg) {
      return {
        lineId: line.lineId,
        allocatedWeightKg: line.knownWeightKg,
        method: 'known' as const
      };
    } else {
      const proportion = line.valueHT / totalValue;
      return {
        lineId: line.lineId,
        allocatedWeightKg: proportion * remainingWeight,
        method: 'rule_of_three' as const
      };
    }
  });

  return { allocations };
}
```

**Transport Fee Allocation**:
- Already implemented in `lib/utils/shipping.ts`
- Use `allocateShipping()` with `mode: 'value'`

---

## 4. API Endpoints

### 4.1 VAT Control API

**POST** `/api/deb/documents/[documentId]/vat-control`

```typescript
// Request
{
  documentId: string;
}

// Response
{
  success: boolean;
  controls: VATControlResult;
  needsReview: boolean;
}
```

### 4.2 HS Code Enrichment API

**POST** `/api/deb/documents/[documentId]/enrich-hs-codes`

```typescript
// Request
{
  documentId: string;
  forceRefresh?: boolean; // Skip cache, re-run OpenAI
}

// Response
{
  success: boolean;
  enrichments: Array<{
    lineId: string;
    description: string;
    hsCodeSuggested: string;
    weightKgSuggested: number;
    confidence: number;
    source: string;
    reasoning?: string;
  }>;
}
```

### 4.3 Validation API

**POST** `/api/deb/documents/[documentId]/validate-line`

```typescript
// Request
{
  lineId: string;
  hsCode: string;      // User-validated HS code
  weightKg: number;    // User-validated weight
  description: string; // Original description
}

// Response
{
  success: boolean;
  message: string;
  learningSaved: boolean; // Was it added to reference DB?
}
```

### 4.4 Archiving Preparation API

**POST** `/api/deb/documents/[documentId]/prepare-archive`

```typescript
// Request
{
  documentId: string;
}

// Response
{
  success: boolean;
  archiveReady: boolean;
  metadata: {
    documentId: string;
    supplier: object;
    totalAmount: number;
    vatControls: object;
    lineItems: Array<object>;
    validationStatus: string;
  };
}
```

---

## 5. UI Components

### 5.1 DEB Validation Interface

**Location**: `app/components/deb/DEBValidationInterface.tsx`

**Features**:
- Table view of invoice line items
- Editable HS code field (8 digits, validated format)
- Editable weight field (kg, numeric)
- Confidence indicator (color-coded)
- Source badge (Reference DB / OpenAI / User)
- Reasoning tooltip (for OpenAI suggestions)

**Component Structure**:

```tsx
interface DEBValidationInterfaceProps {
  documentId: string;
  orgId: string;
}

export function DEBValidationInterface({ documentId, orgId }: DEBValidationInterfaceProps) {
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [validationStatus, setValidationStatus] = useState<Map<string, ValidationState>>();

  // Load enriched data
  useEffect(() => {
    loadEnrichedData();
  }, [documentId]);

  // Validate single line
  const validateLine = async (lineId: string, hsCode: string, weightKg: number) => {
    // Call API to save validation
    // Update reference database
    // Mark line as validated
  };

  // Submit all for export
  const submitForExport = async () => {
    // Validate all lines are complete
    // Call prepare-archive API
    // Redirect to export page
  };

  return (
    <div className="deb-validation-container">
      <VATControlSummary documentId={documentId} />
      <LineItemsTable
        items={lineItems}
        onValidate={validateLine}
      />
      <ActionBar
        onSubmit={submitForExport}
        allValidated={checkAllValidated()}
      />
    </div>
  );
}
```

### 5.2 VAT Control Summary Component

**Location**: `app/components/deb/VATControlSummary.tsx`

```tsx
export function VATControlSummary({ documentId }: { documentId: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>VAT Controls</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <ControlItem
            label="Arithmetic TTC"
            status={controls.arithmeticTTC.status}
            message={controls.arithmeticTTC.message}
          />
          <ControlItem
            label="Intra-EU"
            status={controls.intraEU.status}
            message={controls.intraEU.message}
          />
          <ControlItem
            label="VAT Zero"
            status={controls.vatZero.status}
            message={controls.vatZero.message}
          />
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## 6. Integration Points

### 6.1 Processing Pipeline

```
1. User uploads PDF
   ↓
2. Azure Document Intelligence extraction
   ↓
3. Store in idp_documents + idp_extracted_fields
   ↓
4. Run VAT Controls (POST /api/deb/documents/[id]/vat-control)
   ↓
5. Run HS Code Enrichment (POST /api/deb/documents/[id]/enrich-hs-codes)
   ↓
6. User reviews in DEBValidationInterface
   ↓
7. User validates/corrects each line
   ↓
8. Auto-learning saves to deb_article_reference
   ↓
9. Allocate transport fees (if applicable)
   ↓
10. Prepare for archiving (POST /api/deb/documents/[id]/prepare-archive)
    ↓
11. Export to SAE (Tiers Archiveur)
```

### 6.2 N8N Workflow Integration

**Option A**: Keep existing N8N workflow, add new steps
- Add webhook calls to new API endpoints
- Insert VAT control step after extraction
- Insert HS enrichment step before validation

**Option B**: Migrate N8N logic to Next.js API routes
- More maintainable
- Better error handling
- Unified codebase

**Recommendation**: Option B - Migrate to Next.js API routes for better control and maintainability.

---

## 7. Testing Strategy

### 7.1 Unit Tests

- VAT control logic (arithmetic, thresholds)
- HS code enrichment (reference DB lookup, OpenAI parsing)
- Allocation algorithms (weight, transport fees)

### 7.2 Integration Tests

- End-to-end document processing
- Auto-learning database updates
- API endpoint responses

### 7.3 Test Data

- Sample EU invoices with known HS codes
- Edge cases: zero VAT, missing fields, multi-page documents
- Performance: 100+ line items per invoice

---

## 8. Deployment Plan

### Phase 1: Database Setup
1. Run migration: `008_deb_business_logic.sql`
2. Seed reference data (EU country list, common HS codes)

### Phase 2: Backend Services
1. Implement VAT control service
2. Implement HS code enrichment service
3. Implement auto-learning service
4. Create API endpoints

### Phase 3: UI Components
1. Build validation interface
2. Integrate with existing DEB dashboard
3. User acceptance testing

### Phase 4: Integration
1. Update document processing pipeline
2. Migrate N8N workflows (if Option B chosen)
3. Performance optimization

### Phase 5: Production
1. Deploy to staging
2. Run smoke tests
3. Deploy to production
4. Monitor error rates and performance

---

## 9. Configuration

### Environment Variables

```bash
# Azure Document Intelligence
AZURE_FORM_RECOGNIZER_ENDPOINT=https://xxx.cognitiveservices.azure.com/
AZURE_FORM_RECOGNIZER_KEY=xxx

# OpenAI
OPENAI_API_KEY=sk-xxx

# DEB Configuration
DEB_VAT_TOLERANCE_EUR=2.00
DEB_HS_CODE_CONFIDENCE_THRESHOLD=0.70
DEB_AUTO_LEARNING_ENABLED=true
```

---

## 10. Monitoring & Metrics

### Key Metrics

1. **Processing Success Rate**: % of documents successfully processed
2. **VAT Control Pass Rate**: % passing all VAT controls
3. **HS Code Confidence**: Average confidence score
4. **Auto-Learning Hit Rate**: % of lines matched from reference DB
5. **User Corrections**: % of lines corrected by users
6. **Processing Time**: Average time per document

### Alerts

- VAT control failures > 10%
- OpenAI API errors
- Processing timeouts
- Database performance degradation

---

## 11. Future Enhancements

1. **Multi-language support**: Handle invoices in German, Spanish, Italian
2. **Customs tariff database**: Integrate official EU TARIC database
3. **Batch processing**: Process multiple invoices simultaneously
4. **ML model training**: Train custom HS code classifier on validated data
5. **Export formats**: Support more accounting systems (SAP, QuickBooks, Xero)

---

## Appendix A: EU Country Codes

```typescript
export const EU_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
];
```

## Appendix B: HS Code Format Validation

```typescript
export function validateHSCode(code: string): boolean {
  // HS code must be 8 digits
  return /^\d{8}$/.test(code);
}

export function formatHSCode(code: string): string {
  // Format as XXXX.XX.XX for display
  const digits = code.replace(/\D/g, '');
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`;
  }
  return code;
}
```

---

**Document Version**: 1.0
**Last Updated**: 2025-10-12
**Author**: CoreMatch Development Team
