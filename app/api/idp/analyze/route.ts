import { NextRequest, NextResponse } from 'next/server';
import { analyzeDocument, analyzeDocumentFromBuffer, detectBestModel, AzurePrebuiltModel } from '@/lib/services/azure-document-intelligence';

export const maxDuration = 60; // 60 seconds for document analysis

/**
 * POST /api/idp/analyze
 *
 * Analyze a document using Azure Document Intelligence
 *
 * Body:
 * - documentUrl: URL to the document (with SAS token)
 * - documentId: ID of the document in the system
 * - modelId: (optional) Specific model to use, defaults to auto-detection
 * - autoDetect: (optional) Auto-detect best model based on filename
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { documentUrl, documentId, modelId, filename, autoDetect = true } = body;

    if (!documentUrl) {
      return NextResponse.json(
        { error: 'documentUrl is required' },
        { status: 400 }
      );
    }

    // Determine which model to use
    let selectedModel = modelId || AzurePrebuiltModel.GENERAL_DOCUMENT;

    if (autoDetect && filename) {
      selectedModel = detectBestModel(filename);
      console.log(`Auto-detected model for "${filename}": ${selectedModel}`);
    }

    console.log(`Analyzing document with Azure Document Intelligence...`);
    console.log(`Model: ${selectedModel}`);
    console.log(`Document URL: ${documentUrl.substring(0, 50)}...`);

    // Analyze document
    const result = await analyzeDocument(documentUrl, selectedModel);

    console.log(`Analysis complete! Extracted ${result.fields.length} fields, ${result.tables.length} tables`);
    console.log(`Overall confidence: ${Math.round(result.confidence * 100)}%`);

    return NextResponse.json({
      success: true,
      data: {
        documentId,
        modelId: result.modelId,
        confidence: result.confidence,
        fields: result.fields,
        tables: result.tables,
        pages: result.pages,
        keyValuePairs: result.keyValuePairs,
        analyzedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Error in Azure analysis API:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to analyze document',
        details: error.details || null
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/idp/analyze/models
 *
 * Get list of available prebuilt models
 */
export async function GET(request: NextRequest) {
  try {
    const models = [
      {
        id: AzurePrebuiltModel.GENERAL_DOCUMENT,
        name: 'General Document',
        description: 'Extract text, tables, and key-value pairs from any document'
      },
      {
        id: AzurePrebuiltModel.INVOICE,
        name: 'Invoice',
        description: 'Extract vendor, customer, amounts, line items, and dates from invoices'
      },
      {
        id: AzurePrebuiltModel.RECEIPT,
        name: 'Receipt',
        description: 'Extract merchant, date, total, and line items from receipts'
      },
      {
        id: AzurePrebuiltModel.BUSINESS_CARD,
        name: 'Business Card',
        description: 'Extract contact information from business cards'
      },
      {
        id: AzurePrebuiltModel.ID_DOCUMENT,
        name: 'ID Document',
        description: 'Extract information from passports, driver licenses, and ID cards'
      },
      {
        id: AzurePrebuiltModel.LAYOUT,
        name: 'Layout',
        description: 'Extract text and layout structure without semantic understanding'
      },
      {
        id: AzurePrebuiltModel.READ,
        name: 'Read',
        description: 'OCR optimized for text-heavy documents'
      },
      {
        id: AzurePrebuiltModel.TAX_US_W2,
        name: 'US W-2 Tax Form',
        description: 'Extract information from US W-2 tax forms'
      },
      {
        id: AzurePrebuiltModel.HEALTH_INSURANCE_CARD,
        name: 'US Health Insurance Card',
        description: 'Extract information from US health insurance cards'
      }
    ];

    return NextResponse.json({
      success: true,
      models
    });
  } catch (error: any) {
    console.error('Error getting models:', error);
    return NextResponse.json(
      { error: 'Failed to get models' },
      { status: 500 }
    );
  }
}
