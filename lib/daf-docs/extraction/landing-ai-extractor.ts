/**
 * Landing AI Vision Agent Extractor
 * Provider principal pour l'extraction DAF
 *
 * Documentation: https://docs.landing.ai/ade/extraction
 */

import { getSecret } from '@/lib/secrets/1password';
import type { DAFExtractor, DAFExtractionResult } from './types';

export class LandingAIExtractor implements DAFExtractor {
  name = 'landing-ai';

  /**
   * Get the Landing AI API endpoint based on region
   * EU: Better latency for Europe + GDPR compliance
   * US: Default endpoint
   */
  private getApiEndpoint(): string {
    const region = process.env.VA_REGION || 'US'; // Default to US if not specified

    if (region.toUpperCase() === 'EU') {
      return 'https://api.va.eu-west-1.landing.ai/v1/tools/agentic-document-analysis';
    }

    return 'https://api.va.landing.ai/v1/tools/agentic-document-analysis';
  }

  /**
   * JSON Schema for DAF document extraction
   * Follows Landing AI's Agentic Document Analysis API format
   */
  private getExtractionSchema() {
    return {
      type: 'object',
      title: 'DAF Document Extraction Schema',
      description: 'Schema for extracting financial data from invoices and receipts',
      properties: {
        montant_ht: {
          type: 'number',
          title: 'Montant HT',
          description: 'Montant hors taxes en euros (sans symbole €)',
        },
        montant_ttc: {
          type: 'number',
          title: 'Montant TTC',
          description: 'Montant toutes taxes comprises en euros (sans symbole €)',
        },
        taux_tva: {
          type: 'number',
          title: 'Taux TVA',
          description: 'Taux de TVA en pourcentage (ex: 20 pour 20%)',
        },
        date_document: {
          type: 'string',
          title: 'Date du document',
          description: 'Date de la facture au format YYYY-MM-DD',
        },
        date_echeance: {
          type: 'string',
          title: 'Date d\'échéance',
          description: 'Date d\'échéance de paiement au format YYYY-MM-DD',
        },
        numero_facture: {
          type: 'string',
          title: 'Numéro de facture',
          description: 'Numéro de facture ou référence du document',
        },
        fournisseur: {
          type: 'string',
          title: 'Fournisseur',
          description: 'Nom du fournisseur ou émetteur de la facture',
        },
      },
      required: ['montant_ttc', 'fournisseur'],
    };
  }

  async extractDocument(fileBuffer: ArrayBuffer, fileName: string): Promise<DAFExtractionResult> {
    const startTime = Date.now();

    try {
      // Get Landing AI API key (VA_API_KEY) from 1Password or env
      const apiKey = await getSecret('VA_API_KEY');

      if (!apiKey) {
        throw new Error('VA_API_KEY not found in 1Password or environment variables');
      }

      // Prepare multipart/form-data request
      const formData = new FormData();

      // Add PDF file
      const blob = new Blob([fileBuffer], { type: 'application/pdf' });
      formData.append('pdf', blob, fileName);

      // Add JSON schema
      const schema = this.getExtractionSchema();
      formData.append('fields_schema', JSON.stringify(schema));

      const endpoint = this.getApiEndpoint();
      const region = process.env.VA_REGION || 'US';

      console.log(`[Landing AI] Extracting from ${fileName} with VA API (${region})...`);
      console.log(`[Landing AI] Using endpoint: ${endpoint}`);

      // Call Landing AI Agentic Document Analysis API
      // Documentation: https://docs.landing.ai/ade/extraction
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Landing AI API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      // Parse Landing AI response
      // Response format: { data: { extracted_schema: {...} } }
      const extracted = data.data?.extracted_schema || {};

      const result: DAFExtractionResult = {
        success: true,
        provider: 'landing-ai',
        confidence: 0.85, // Landing AI doesn't return confidence, using default
        montant_ht: extracted.montant_ht || null,
        montant_ttc: extracted.montant_ttc || null,
        taux_tva: extracted.taux_tva || null,
        date_document: extracted.date_document || null,
        date_echeance: extracted.date_echeance || null,
        numero_facture: extracted.numero_facture || null,
        fournisseur: extracted.fournisseur || null,
        extraction_duration_ms: Date.now() - startTime,
        raw_response: data,
      };

      console.log(`[Landing AI] ✓ Extraction completed in ${result.extraction_duration_ms}ms`);
      console.log(`[Landing AI] Extracted: ${JSON.stringify(extracted, null, 2)}`);

      return result;

    } catch (error) {
      console.error('[Landing AI] ✗ Extraction failed:', error);

      return {
        success: false,
        provider: 'landing-ai',
        confidence: 0,
        extraction_duration_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
