# Unified IDP System - Complete Implementation Guide

## 🎯 Overview

This enterprise-grade Intelligent Document Processing (IDP) system integrates the best features from industry leaders:

- **Rossum**: Real-time queues, audit trails, drag-and-drop workflow builder
- **Docsumo**: Excel-like editable tables, visual error highlighting, auto-categorization
- **Azure AI Document Intelligence**: Confidence scoring, custom extraction models
- **Apryse**: High-fidelity PDF viewing, 30+ annotation types, in-browser editing

## 🏗️ Architecture

```
app/
├── components/
│   └── idp/
│       ├── UnifiedIDPDashboard.tsx       # Main dashboard orchestrator
│       ├── DocumentQueue.tsx              # Real-time document queue
│       ├── PDFViewerWithAnnotations.tsx   # High-fidelity PDF viewer
│       ├── ExtractionDataView.tsx         # Side-by-side data sync
│       ├── WorkflowBuilder.tsx            # Drag-and-drop workflow designer
│       ├── AuditTrailViewer.tsx          # Activity logging
│       └── ExtractionModelManager.tsx     # Model configuration
└── org/
    └── [orgId]/
        └── idp/
            └── page.tsx                   # Demo page
```

## 🚀 Features

### 1. Real-Time Document Queue (Rossum-inspired)

**File**: `DocumentQueue.tsx`

**Features**:
- Priority-based document sorting (High/Medium/Low)
- Status filtering (Pending/Processing/Review/Completed/Error)
- Advanced search and filtering
- Queue analytics with real-time KPIs
- Batch operations support

**Usage**:
```tsx
<DocumentQueue
  documents={documents}
  onDocumentSelect={handleDocumentSelect}
  onStatusChange={handleStatusChange}
  queueStats={queueStats}
  isDarkMode={isDarkMode}
/>
```

**Key Components**:
- **Status badges** with color coding
- **Confidence scores** displayed prominently
- **SLA monitoring** with timestamp tracking
- **Assignee management** for team collaboration

### 2. High-Fidelity PDF Viewer (Apryse-inspired)

**File**: `PDFViewerWithAnnotations.tsx`

**Features**:
- PDF.js integration for cross-browser compatibility
- 30+ annotation types:
  - Highlight, underline, strikethrough
  - Text annotations
  - Shapes (rectangle, circle)
  - Freehand drawing
  - Arrows and callouts
- Zoom (50%-300%), pan, and rotate controls
- Undo/Redo functionality
- Touch and pen input support
- Lazy loading for large PDFs

**Usage**:
```tsx
<PDFViewerWithAnnotations
  pdfUrl="/path/to/document.pdf"
  documentId="doc-123"
  annotations={existingAnnotations}
  isDarkMode={isDarkMode}
  onAnnotationsChange={handleAnnotationsChange}
/>
```

**Optimization Strategies**:
```typescript
// Large PDF handling
- Canvas pooling to reduce memory usage
- Progressive rendering (page-by-page)
- Virtual scrolling for page thumbnails
- Blob URL management with cleanup

// Cross-browser compatibility
- PDF.js worker configuration
- Touch event normalization
- CSS transforms for rotation
```

### 3. Side-by-Side Data Extraction (Rossum/Docsumo-inspired)

**File**: `ExtractionDataView.tsx`

**Features**:
- Real-time field validation with visual feedback
- AI confidence scoring (High/Medium/Low)
- LLM-powered auto-correction suggestions
- Field-level locking for reviewed data
- Export to JSON/CSV with schema validation
- Visual error highlighting:
  - Red borders for missing required fields
  - Yellow for low confidence (< 80%)
  - Green for high confidence (≥ 95%)

**Field Configuration**:
```typescript
interface ExtractedField {
  id: string;
  label: string;
  value: string;
  confidence: number; // 0.0 - 1.0
  type: 'text' | 'number' | 'date' | 'email' | 'currency';
  required: boolean;
  validation?: {
    pattern?: string;        // Regex validation
    min?: number;           // Min value for numbers
    max?: number;           // Max value for numbers
    options?: string[];     // Dropdown options
  };
  suggestions?: string[];   // AI suggestions
  locked?: boolean;         // Prevent editing
}
```

**Validation Rules**:
```typescript
// Automatic validation
- Required field checking
- Type validation (email, date, number)
- Regex pattern matching
- Min/max range validation
- Custom business rules
```

### 4. Drag-and-Drop Workflow Builder (Rossum-inspired)

**File**: `WorkflowBuilder.tsx`

**Features**:
- Visual workflow design with drag-and-drop
- Pre-built stage templates:
  - **Extraction**: Azure OCR, Tesseract.js, OpenAI Vision, Custom Models
  - **Validation**: Business rules, required fields, auto-correction
  - **Review**: Human review routing, confidence thresholds
  - **Export**: JSON/CSV/XML export, webhook integration
- Stage configuration UI
- Real-time workflow testing
- Version control support

**Workflow Configuration**:
```typescript
interface WorkflowStage {
  id: string;
  name: string;
  type: 'extraction' | 'validation' | 'review' | 'export';
  order: number;
  config: {
    // Extraction config
    extractionMethod?: 'azure_ocr' | 'tesseract' | 'openai_vision';
    confidence_threshold?: number;

    // Validation config
    rules?: ValidationRule[];
    auto_correct?: boolean;

    // Review config
    assignee?: string;
    priority?: 'high' | 'medium' | 'low';

    // Export config
    format?: 'json' | 'csv' | 'xml';
    webhook_url?: string;
  };
}
```

### 5. Audit Trail & Activity Logging

**File**: `AuditTrailViewer.tsx`

**Features**:
- Complete activity logging
- User action tracking
- Document lifecycle history
- Compliance reporting
- Exportable audit logs

**Logged Events**:
```typescript
- document_opened
- document_uploaded
- data_modified
- status_changed
- workflow_modified
- field_locked
- export_completed
- user_login
- permission_changed
```

### 6. Custom Extraction Models (Azure AI-inspired)

**File**: `ExtractionModelManager.tsx`

**Features**:
- Pre-built model templates
- Custom model training
- Field mapping configuration
- Model accuracy tracking
- A/B testing support

## 🔧 Integration Guide

### Step 1: Install Dependencies

```bash
npm install react-pdf pdfjs-dist ag-grid-react ag-grid-community recharts zustand zod
```

### Step 2: Configure PDF.js Worker

Already configured in `PDFViewerWithAnnotations.tsx`:

```typescript
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc =
    `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}
```

### Step 3: Integrate with Existing Auth

The system uses your existing auth context:

```typescript
// In UnifiedIDPDashboard.tsx
const userId = 'current-user-id'; // TODO: Get from auth context
const userName = 'Current User';   // TODO: Get from auth context
```

**Integration Example**:
```typescript
import { useAuth } from '@/lib/auth-context';

function UnifiedIDPDashboard() {
  const { user } = useAuth();

  // Use user.id and user.name for audit logging
  const logEntry: AuditLogEntry = {
    userId: user.id,
    userName: user.name,
    // ...
  };
}
```

### Step 4: Connect to Backend API

**Document Upload**:
```typescript
// POST /api/idp/upload
const formData = new FormData();
formData.append('file', pdfFile);
formData.append('orgId', orgId);

const response = await fetch('/api/idp/upload', {
  method: 'POST',
  body: formData
});
```

**Data Extraction**:
```typescript
// POST /api/idp/extract
const response = await fetch('/api/idp/extract', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    documentId: doc.id,
    extractionMethod: 'azure_ocr'
  })
});
```

**Save Annotations**:
```typescript
// PATCH /api/idp/documents/:id/annotations
await fetch(`/api/idp/documents/${docId}/annotations`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ annotations })
});
```

## ⚡ Performance Optimizations

### Large PDF Handling

**Problem**: Large PDFs (50+ pages) can cause browser crashes

**Solutions Implemented**:

1. **Lazy Loading**:
```typescript
// Only render current page + 1 page buffer
<Page pageNumber={currentPage} />
// Don't render all pages at once
```

2. **Canvas Pooling**:
```typescript
// Reuse canvas elements instead of creating new ones
const canvasPool: HTMLCanvasElement[] = [];

function getCanvas() {
  return canvasPool.pop() || document.createElement('canvas');
}

function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
  canvasPool.push(canvas);
}
```

3. **Memory Management**:
```typescript
// Clean up blob URLs
useEffect(() => {
  return () => {
    if (pdfUrl.startsWith('blob:')) {
      URL.revokeObjectURL(pdfUrl);
    }
  };
}, [pdfUrl]);
```

4. **Virtual Scrolling** (for page thumbnails):
```typescript
// Only render visible thumbnails
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={400}
  itemCount={numPages}
  itemSize={120}
>
  {({ index, style }) => (
    <div style={style}>
      <PageThumbnail pageNumber={index + 1} />
    </div>
  )}
</FixedSizeList>
```

### Cross-Browser Compatibility

**Testing Matrix**:
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

**Compatibility Strategies**:

1. **PDF.js** (instead of native `<embed>` or `<object>`):
   - Works consistently across all browsers
   - No plugin dependencies
   - Full rendering control

2. **Touch Event Handling**:
```typescript
// Support both mouse and touch
const handlePointerDown = (e: React.PointerEvent) => {
  // Works for mouse, touch, and pen
  const { clientX, clientY } = e;
  startDrawing(clientX, clientY);
};
```

3. **CSS Transforms** (instead of canvas rotation):
```typescript
// Better performance, works everywhere
<div style={{ transform: `rotate(${rotation}deg)` }}>
  <Page pageNumber={currentPage} />
</div>
```

## 🔐 Security Considerations

### File Upload Validation

```typescript
// Validate file type
if (!file.type.includes('pdf')) {
  throw new Error('Only PDF files are allowed');
}

// Validate file size (max 50MB)
if (file.size > 50 * 1024 * 1024) {
  throw new Error('File too large');
}

// Scan for malware (server-side)
await scanFile(file);
```

### Data Sanitization

```typescript
// Sanitize extracted text
import DOMPurify from 'dompurify';

const cleanText = DOMPurify.sanitize(extractedText);
```

### Access Control

```typescript
// Check user permissions
const canEdit = await checkPermission(user.id, 'edit_documents');
const canExport = await checkPermission(user.id, 'export_data');
```

## 📊 Analytics & Monitoring

### Key Metrics to Track

```typescript
// Document processing metrics
- Average processing time per document
- Extraction accuracy rate
- Human review rate
- Error rate by document type

// Queue metrics
- Queue depth (pending documents)
- Average wait time
- SLA compliance rate
- Throughput (documents/hour)

// User metrics
- Active users per day
- Documents processed per user
- Average review time
- Annotations per document
```

### Implementation Example

```typescript
// Track processing time
const startTime = Date.now();
await processDocument(doc);
const processingTime = Date.now() - startTime;

await analytics.track('document_processed', {
  documentId: doc.id,
  processingTime,
  accuracy: doc.confidence,
  reviewRequired: doc.confidence < 0.95
});
```

## 🧪 Testing

### Unit Tests

```typescript
// Test field validation
describe('validateField', () => {
  it('should validate required fields', () => {
    const field: ExtractedField = {
      id: '1',
      label: 'Invoice Number',
      value: '',
      required: true,
      // ...
    };

    const result = validateField(field);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('This field is required');
  });
});
```

### Integration Tests

```typescript
// Test document processing workflow
it('should process document through complete workflow', async () => {
  // Upload
  const doc = await uploadDocument(pdfFile);
  expect(doc.status).toBe('pending');

  // Extract
  await extractData(doc.id);
  expect(doc.status).toBe('review');

  // Review
  await approveDocument(doc.id);
  expect(doc.status).toBe('completed');
});
```

## 🚀 Deployment

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_AZURE_OCR_ENDPOINT=https://your-service.cognitiveservices.azure.com/
AZURE_OCR_API_KEY=your-api-key

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional: OpenAI for LLM corrections
OPENAI_API_KEY=sk-...
```

### Build Optimization

```javascript
// next.config.js
module.exports = {
  webpack: (config) => {
    // Optimize PDF.js worker
    config.resolve.alias = {
      ...config.resolve.alias,
      'pdfjs-dist/build/pdf.worker.entry':
        'pdfjs-dist/build/pdf.worker.min.js',
    };
    return config;
  },

  // Enable SWC minification
  swcMinify: true,

  // Optimize images
  images: {
    formats: ['image/webp'],
  },
};
```

## 📚 API Reference

### Document API

```typescript
// GET /api/idp/documents
// List all documents for organization
interface GetDocumentsResponse {
  documents: IDPDocument[];
  total: number;
  page: number;
}

// POST /api/idp/upload
// Upload new PDF document
interface UploadRequest {
  file: File;
  orgId: string;
  priority?: 'high' | 'medium' | 'low';
}

// GET /api/idp/documents/:id
// Get document details
interface GetDocumentResponse {
  document: IDPDocument;
  extractedData: ExtractedField[];
  annotations: Annotation[];
}

// PATCH /api/idp/documents/:id
// Update document data
interface UpdateDocumentRequest {
  status?: IDPDocument['status'];
  extractedData?: ExtractedField[];
  annotations?: Annotation[];
}

// DELETE /api/idp/documents/:id
// Delete document
```

### Extraction API

```typescript
// POST /api/idp/extract
// Trigger data extraction
interface ExtractionRequest {
  documentId: string;
  method: 'azure_ocr' | 'tesseract' | 'openai_vision';
  fields?: string[];
}

interface ExtractionResponse {
  success: boolean;
  confidence: number;
  fields: ExtractedField[];
  processingTime: number;
}
```

### Workflow API

```typescript
// GET /api/idp/workflows
// Get organization workflows
interface GetWorkflowsResponse {
  workflows: WorkflowStage[][];
}

// POST /api/idp/workflows
// Create/update workflow
interface SaveWorkflowRequest {
  name: string;
  stages: WorkflowStage[];
}

// POST /api/idp/workflows/:id/test
// Test workflow
interface TestWorkflowRequest {
  testDocumentId: string;
}
```

## 🎓 Best Practices

### 1. Error Handling

```typescript
try {
  await processDocument(doc);
} catch (error) {
  // Log error for debugging
  console.error('Processing error:', error);

  // Update document status
  await updateDocument(doc.id, {
    status: 'error',
    errorMessage: error.message
  });

  // Notify user
  toast.error('Document processing failed');

  // Send to error queue for investigation
  await errorQueue.add(doc);
}
```

### 2. State Management

```typescript
// Use Zustand for global state
import create from 'zustand';

interface IDPStore {
  documents: IDPDocument[];
  selectedDocument: IDPDocument | null;
  setDocuments: (docs: IDPDocument[]) => void;
  selectDocument: (id: string) => void;
}

export const useIDPStore = create<IDPStore>((set) => ({
  documents: [],
  selectedDocument: null,
  setDocuments: (documents) => set({ documents }),
  selectDocument: (id) => set((state) => ({
    selectedDocument: state.documents.find(d => d.id === id)
  }))
}));
```

### 3. Caching

```typescript
// Cache PDF blobs to avoid re-fetching
const pdfCache = new Map<string, string>();

async function getPDFUrl(documentId: string): Promise<string> {
  if (pdfCache.has(documentId)) {
    return pdfCache.get(documentId)!;
  }

  const blob = await fetchPDFBlob(documentId);
  const url = URL.createObjectURL(blob);
  pdfCache.set(documentId, url);

  return url;
}
```

## 🔄 Migration Guide

### From Basic DEB to Unified IDP

```typescript
// Old DEB table approach
<table>
  <tbody>
    {lines.map(line => (
      <tr>
        <td><input value={line.hs_code} /></td>
        // ...
      </tr>
    ))}
  </tbody>
</table>

// New IDP approach
<UnifiedIDPDashboard orgId={orgId} />
```

### Data Migration

```sql
-- Migrate DEB batches to IDP documents
INSERT INTO idp_documents (id, filename, status, uploaded_at)
SELECT id, source_filename,
  CASE status
    WHEN 'uploaded' THEN 'pending'
    WHEN 'needs_review' THEN 'review'
    ELSE status
  END,
  created_at
FROM deb_batches;

-- Migrate lines to extracted fields
INSERT INTO idp_extracted_fields (document_id, label, value, confidence)
SELECT document_id, 'HS Code', hs_code, hs_confidence
FROM lines
WHERE hs_code IS NOT NULL;
```

## 📞 Support

For issues or questions:
1. Check this documentation
2. Review component source code (heavily commented)
3. Check GitHub issues
4. Contact: support@corematch.fr

---

**Built with ❤️ using React, Next.js, PDF.js, and TypeScript**
