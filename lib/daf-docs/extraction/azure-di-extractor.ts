/**
 * Azure Document Intelligence Extractor
 * Provider fallback pour l'extraction DAF
 */

import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';
import { getSecret } from '@/lib/secrets/1password';
import type { DAFExtractor, DAFExtractionResult } from './types';

export class AzureDIExtractor implements DAFExtractor {
  name = 'azure-di';

  async extractDocument(fileBuffer: ArrayBuffer, fileName: string): Promise<DAFExtractionResult> {
    const startTime = Date.now();

    try {
      // Get Azure credentials from 1Password
      const endpoint = await getSecret('AZURE_DI_ENDPOINT');
      const apiKey = await getSecret('AZURE_DI_API_KEY');

      if (!endpoint || !apiKey) {
        throw new Error('Azure Document Intelligence credentials not found in 1Password');
      }

      const client = new DocumentAnalysisClient(
        endpoint,
        new AzureKeyCredential(apiKey)
      );

      // Analyze document with prebuilt-invoice model
      const poller = await client.beginAnalyzeDocument(
        'prebuilt-invoice',
        fileBuffer
      );

      const result = await poller.pollUntilDone();

      if (!result.documents || result.documents.length === 0) {
        throw new Error('No document found in analysis result');
      }

      const document = result.documents[0];
      const fields = document.fields;

      // Extract fields from Azure response
      const extractedData: DAFExtractionResult = {
        success: true,
        provider: 'azure-di',
        confidence: document.confidence || 0.7,
        montant_ht: fields?.SubTotal?.value,
        montant_ttc: fields?.InvoiceTotal?.value,
        taux_tva: fields?.TotalTax?.value ? (fields.TotalTax.value / (fields.SubTotal?.value || 1)) * 100 : undefined,
        date_document: fields?.InvoiceDate?.value,
        date_echeance: fields?.DueDate?.value,
        numero_facture: fields?.InvoiceId?.value,
        fournisseur: fields?.VendorName?.value,
        extraction_duration_ms: Date.now() - startTime,
        raw_response: document,
      };

      console.log(`[Azure DI] Extraction completed in ${extractedData.extraction_duration_ms}ms (confidence: ${extractedData.confidence})`);

      return extractedData;

    } catch (error) {
      console.error('[Azure DI] Extraction failed:', error);

      return {
        success: false,
        provider: 'azure-di',
        confidence: 0,
        extraction_duration_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
