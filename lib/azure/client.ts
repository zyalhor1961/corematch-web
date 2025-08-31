import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';
import { AzureOCRResult } from '@/lib/types';

if (!process.env.AZURE_DOCINTEL_ENDPOINT) {
  throw new Error('Missing env.AZURE_DOCINTEL_ENDPOINT');
}
if (!process.env.AZURE_DOCINTEL_KEY) {
  throw new Error('Missing env.AZURE_DOCINTEL_KEY');
}

export const documentClient = new DocumentAnalysisClient(
  process.env.AZURE_DOCINTEL_ENDPOINT,
  new AzureKeyCredential(process.env.AZURE_DOCINTEL_KEY)
);

export async function analyzeDocument(documentUrl: string): Promise<AzureOCRResult> {
  try {
    // Start analysis with prebuilt-invoice model for better extraction
    const poller = await documentClient.beginAnalyzeDocument(
      'prebuilt-invoice',
      { urlSource: documentUrl }
    );

    // Wait for completion
    const result = await poller.pollUntilDone();

    if (!result) {
      throw new Error('No result from Azure Document Intelligence');
    }

    // Transform to our format
    const pages = result.pages?.map(page => ({
      pageNumber: page.pageNumber || 0,
      content: page.lines?.map(line => line.content).join('\n') || '',
      lines: page.lines?.map(line => ({
        content: line.content || '',
        boundingBox: line.boundingRegions?.[0]?.polygon || []
      })),
      tables: page.tables?.map(table => ({
        rowCount: table.rowCount || 0,
        columnCount: table.columnCount || 0,
        cells: table.cells?.map(cell => ({
          content: cell.content || '',
          rowIndex: cell.rowIndex || 0,
          columnIndex: cell.columnIndex || 0
        })) || []
      }))
    })) || [];

    const documents = result.documents?.map(doc => ({
      docType: doc.docType || 'unknown',
      confidence: doc.confidence || 0,
      fields: Object.fromEntries(
        Object.entries(doc.fields || {}).map(([key, field]) => [
          key,
          {
            content: field?.content?.toString() || '',
            confidence: field?.confidence || 0
          }
        ])
      )
    })) || [];

    return {
      status: 'succeeded',
      pages,
      documents
    };

  } catch (error) {
    console.error('Azure Document Intelligence error:', error);
    throw new Error(`Failed to analyze document: ${error}`);
  }
}

export async function analyzeLayout(documentUrl: string): Promise<AzureOCRResult> {
  try {
    // Use layout model for general document structure
    const poller = await documentClient.beginAnalyzeDocument(
      'prebuilt-layout',
      { urlSource: documentUrl }
    );

    const result = await poller.pollUntilDone();

    if (!result) {
      throw new Error('No result from Azure Document Intelligence');
    }

    const pages = result.pages?.map(page => ({
      pageNumber: page.pageNumber || 0,
      content: page.lines?.map(line => line.content).join('\n') || '',
      lines: page.lines?.map(line => ({
        content: line.content || '',
        boundingBox: line.boundingRegions?.[0]?.polygon || []
      })),
      tables: page.tables?.map(table => ({
        rowCount: table.rowCount || 0,
        columnCount: table.columnCount || 0,
        cells: table.cells?.map(cell => ({
          content: cell.content || '',
          rowIndex: cell.rowIndex || 0,
          columnIndex: cell.columnIndex || 0
        })) || []
      }))
    })) || [];

    return {
      status: 'succeeded',
      pages
    };

  } catch (error) {
    console.error('Azure Layout analysis error:', error);
    throw new Error(`Failed to analyze document layout: ${error}`);
  }
}