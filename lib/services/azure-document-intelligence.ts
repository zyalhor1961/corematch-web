/**
 * Azure Document Intelligence Service
 *
 * Provides enterprise-grade document analysis using Azure AI Document Intelligence
 * (formerly Azure Form Recognizer).
 *
 * Features:
 * - Prebuilt models (invoices, receipts, business cards, ID documents)
 * - Custom model training and deployment
 * - Key-value pair extraction
 * - Table extraction
 * - Layout analysis
 * - Confidence scoring
 * - Multi-page document support
 */

import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';

// Azure Document Intelligence client
let documentAnalysisClient: DocumentAnalysisClient | null = null;

/**
 * Initialize Azure Document Intelligence client
 */
function getClient(): DocumentAnalysisClient {
  if (!documentAnalysisClient) {
    const endpoint = process.env.AZURE_FORM_RECOGNIZER_ENDPOINT;
    const key = process.env.AZURE_FORM_RECOGNIZER_KEY;

    if (!endpoint || !key) {
      throw new Error('Azure Document Intelligence credentials not configured');
    }

    // Remove /api/projects/{projectName} from endpoint if present
    const baseEndpoint = endpoint.includes('/api/projects/')
      ? endpoint.split('/api/projects/')[0]
      : endpoint;

    documentAnalysisClient = new DocumentAnalysisClient(
      baseEndpoint,
      new AzureKeyCredential(key)
    );
  }

  return documentAnalysisClient;
}

/**
 * Supported prebuilt models
 */
export enum AzurePrebuiltModel {
  INVOICE = 'prebuilt-invoice',
  RECEIPT = 'prebuilt-receipt',
  BUSINESS_CARD = 'prebuilt-businessCard',
  ID_DOCUMENT = 'prebuilt-idDocument',
  LAYOUT = 'prebuilt-layout',
  READ = 'prebuilt-read',
  GENERAL_DOCUMENT = 'prebuilt-document',
  TAX_US_W2 = 'prebuilt-tax.us.w2',
  HEALTH_INSURANCE_CARD = 'prebuilt-healthInsuranceCard.us'
}

/**
 * Extracted field with confidence score
 */
export interface ExtractedField {
  name: string;
  value: any;
  confidence: number;
  type: string;
  boundingBox?: number[];
  pageNumber?: number; // Page number where this field appears (1-indexed)
}

/**
 * Extracted table data
 */
export interface ExtractedTable {
  rowCount: number;
  columnCount: number;
  cells: {
    rowIndex: number;
    columnIndex: number;
    content: string;
    confidence: number;
  }[];
}

/**
 * Azure Document Intelligence analysis result
 */
export interface AzureAnalysisResult {
  modelId: string;
  confidence: number;
  fields: ExtractedField[];
  tables: ExtractedTable[];
  pages: {
    pageNumber: number;
    width: number;
    height: number;
    angle: number;
    unit: string;
    lines: {
      content: string;
      boundingBox: number[];
      confidence: number;
    }[];
  }[];
  keyValuePairs: {
    key: string;
    value: any;
    confidence: number;
  }[];
}

/**
 * Analyze document using Azure Document Intelligence
 *
 * @param documentUrl - URL to the document (must be publicly accessible or use SAS token)
 * @param modelId - Prebuilt model ID or custom model ID
 * @returns Analysis result with extracted data
 */
export async function analyzeDocument(
  documentUrl: string,
  modelId: string = AzurePrebuiltModel.GENERAL_DOCUMENT
): Promise<AzureAnalysisResult> {
  try {
    const client = getClient();

    // Start analysis
    const poller = await client.beginAnalyzeDocumentFromUrl(modelId, documentUrl);

    // Wait for completion
    const result = await poller.pollUntilDone();

    if (!result) {
      throw new Error('Analysis completed but no result returned');
    }

    // Extract fields
    const fields: ExtractedField[] = [];
    if (result.documents && result.documents.length > 0) {
      const document = result.documents[0];

      for (const [fieldName, field] of Object.entries(document.fields || {})) {
        if (field) {
          const boundingRegion = field.boundingRegions?.[0];
          fields.push({
            name: fieldName,
            value: field.value,
            confidence: field.confidence || 0,
            type: field.kind || 'string',
            boundingBox: boundingRegion?.polygon || [],
            pageNumber: boundingRegion?.pageNumber || 1
          });
        }
      }
    }

    // If no fields found, use key-value pairs as fields
    if (fields.length === 0 && result.keyValuePairs && result.keyValuePairs.length > 0) {
      for (const pair of result.keyValuePairs) {
        if (pair.key && pair.value) {
          const boundingRegion = pair.value.boundingRegions?.[0] || pair.key.boundingRegions?.[0];
          fields.push({
            name: pair.key.content || 'Unknown',
            value: pair.value.content || '',
            confidence: pair.confidence || 0,
            type: 'string',
            boundingBox: boundingRegion?.polygon || [],
            pageNumber: boundingRegion?.pageNumber || 1
          });
        }
      }
    }

    // Extract tables
    const tables: ExtractedTable[] = (result.tables || []).map((table, tableIndex) => ({
      rowCount: table.rowCount,
      columnCount: table.columnCount,
      cells: (table.cells || []).map(cell => ({
        rowIndex: cell.rowIndex,
        columnIndex: cell.columnIndex,
        content: cell.content,
        confidence: cell.confidence || 0
      }))
    }));

    // Also extract table cells as individual fields for bounding box display
    if (result.tables && result.tables.length > 0) {
      for (const [tableIndex, table] of result.tables.entries()) {
        for (const cell of table.cells || []) {
          if (cell.content && cell.content.trim()) {
            const boundingRegion = cell.boundingRegions?.[0];
            fields.push({
              name: `Table ${tableIndex + 1} [R${cell.rowIndex + 1}C${cell.columnIndex + 1}]`,
              value: cell.content,
              confidence: cell.confidence || 0,
              type: 'string',
              boundingBox: boundingRegion?.polygon || [],
              pageNumber: boundingRegion?.pageNumber || 1
            });
          }
        }
      }
    }

    // Extract pages with lines
    const pages = (result.pages || []).map(page => ({
      pageNumber: page.pageNumber,
      width: page.width,
      height: page.height,
      angle: page.angle,
      unit: page.unit,
      lines: (page.lines || []).map(line => ({
        content: line.content,
        boundingBox: line.polygon || [],
        confidence: 1.0 // Lines don't have confidence in newer SDK
      }))
    }));

    // Extract key-value pairs
    const keyValuePairs = (result.keyValuePairs || [])
      .filter(pair => pair.key && pair.value)
      .map(pair => ({
        key: pair.key.content || '',
        value: pair.value?.content || '',
        confidence: pair.confidence || 0
      }));

    // Calculate overall confidence
    const avgConfidence = fields.length > 0
      ? fields.reduce((sum, f) => sum + f.confidence, 0) / fields.length
      : 0;

    return {
      modelId,
      confidence: avgConfidence,
      fields,
      tables,
      pages,
      keyValuePairs
    };
  } catch (error: any) {
    console.error('Azure Document Intelligence analysis error:', error);
    throw new Error(`Azure analysis failed: ${error.message}`);
  }
}

/**
 * Analyze document from Buffer/Blob
 *
 * @param documentBuffer - Document buffer or blob
 * @param modelId - Prebuilt model ID or custom model ID
 * @returns Analysis result with extracted data
 */
export async function analyzeDocumentFromBuffer(
  documentBuffer: Buffer | Blob,
  modelId: string = AzurePrebuiltModel.GENERAL_DOCUMENT
): Promise<AzureAnalysisResult> {
  try {
    const client = getClient();

    // Start analysis
    const poller = await client.beginAnalyzeDocument(modelId, documentBuffer);

    // Wait for completion
    const result = await poller.pollUntilDone();

    if (!result) {
      throw new Error('Analysis completed but no result returned');
    }

    // Extract fields (same as above)
    const fields: ExtractedField[] = [];
    if (result.documents && result.documents.length > 0) {
      const document = result.documents[0];

      for (const [fieldName, field] of Object.entries(document.fields || {})) {
        if (field) {
          const boundingRegion = field.boundingRegions?.[0];
          fields.push({
            name: fieldName,
            value: field.value,
            confidence: field.confidence || 0,
            type: field.kind || 'string',
            boundingBox: boundingRegion?.polygon || [],
            pageNumber: boundingRegion?.pageNumber || 1
          });
        }
      }
    }

    // If no fields found, use key-value pairs as fields
    if (fields.length === 0 && result.keyValuePairs && result.keyValuePairs.length > 0) {
      for (const pair of result.keyValuePairs) {
        if (pair.key && pair.value) {
          const boundingRegion = pair.value.boundingRegions?.[0] || pair.key.boundingRegions?.[0];
          fields.push({
            name: pair.key.content || 'Unknown',
            value: pair.value.content || '',
            confidence: pair.confidence || 0,
            type: 'string',
            boundingBox: boundingRegion?.polygon || [],
            pageNumber: boundingRegion?.pageNumber || 1
          });
        }
      }
    }

    // Extract tables
    const tables: ExtractedTable[] = (result.tables || []).map((table, tableIndex) => ({
      rowCount: table.rowCount,
      columnCount: table.columnCount,
      cells: (table.cells || []).map(cell => ({
        rowIndex: cell.rowIndex,
        columnIndex: cell.columnIndex,
        content: cell.content,
        confidence: cell.confidence || 0
      }))
    }));

    // Also extract table cells as individual fields for bounding box display
    if (result.tables && result.tables.length > 0) {
      for (const [tableIndex, table] of result.tables.entries()) {
        for (const cell of table.cells || []) {
          if (cell.content && cell.content.trim()) {
            const boundingRegion = cell.boundingRegions?.[0];
            fields.push({
              name: `Table ${tableIndex + 1} [R${cell.rowIndex + 1}C${cell.columnIndex + 1}]`,
              value: cell.content,
              confidence: cell.confidence || 0,
              type: 'string',
              boundingBox: boundingRegion?.polygon || [],
              pageNumber: boundingRegion?.pageNumber || 1
            });
          }
        }
      }
    }

    // Extract pages
    const pages = (result.pages || []).map(page => ({
      pageNumber: page.pageNumber,
      width: page.width,
      height: page.height,
      angle: page.angle,
      unit: page.unit,
      lines: (page.lines || []).map(line => ({
        content: line.content,
        boundingBox: line.polygon || [],
        confidence: 1.0
      }))
    }));

    // Extract key-value pairs
    const keyValuePairs = (result.keyValuePairs || [])
      .filter(pair => pair.key && pair.value)
      .map(pair => ({
        key: pair.key.content || '',
        value: pair.value?.content || '',
        confidence: pair.confidence || 0
      }));

    const avgConfidence = fields.length > 0
      ? fields.reduce((sum, f) => sum + f.confidence, 0) / fields.length
      : 0;

    return {
      modelId,
      confidence: avgConfidence,
      fields,
      tables,
      pages,
      keyValuePairs
    };
  } catch (error: any) {
    console.error('Azure Document Intelligence analysis error:', error);
    throw new Error(`Azure analysis failed: ${error.message}`);
  }
}

/**
 * Get available prebuilt models
 */
export function getPrebuiltModels() {
  return Object.values(AzurePrebuiltModel);
}

/**
 * Auto-detect best model for document type
 */
export function detectBestModel(filename: string): string {
  const lower = filename.toLowerCase();

  if (lower.includes('invoice') || lower.includes('facture')) {
    return AzurePrebuiltModel.INVOICE;
  }
  if (lower.includes('receipt') || lower.includes('recu')) {
    return AzurePrebuiltModel.RECEIPT;
  }
  if (lower.includes('card') || lower.includes('carte')) {
    return AzurePrebuiltModel.BUSINESS_CARD;
  }
  if (lower.includes('id') || lower.includes('passport') || lower.includes('license')) {
    return AzurePrebuiltModel.ID_DOCUMENT;
  }
  if (lower.includes('w2') || lower.includes('tax')) {
    return AzurePrebuiltModel.TAX_US_W2;
  }

  // Default to general document
  return AzurePrebuiltModel.GENERAL_DOCUMENT;
}
