/**
 * Landing AI Document Extractor
 * Provider principal pour l'extraction DAF
 */

import { getSecret } from '@/lib/secrets/1password';
import type { DAFExtractor, DAFExtractionResult } from './types';

export class LandingAIExtractor implements DAFExtractor {
  name = 'landing-ai';

  async extractDocument(fileBuffer: ArrayBuffer, fileName: string): Promise<DAFExtractionResult> {
    const startTime = Date.now();

    try {
      // Get Landing AI API key from 1Password
      const apiKey = await getSecret('VISION_AGENT_API_KEY');

      if (!apiKey) {
        throw new Error('VISION_AGENT_API_KEY not found in 1Password');
      }

      // Convert ArrayBuffer to base64
      const base64 = Buffer.from(fileBuffer).toString('base64');

      // Landing AI Document Intelligence API
      // Documentation: https://landing.ai/docs/api
      const response = await fetch('https://api.landing.ai/v1/document/extract', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document: base64,
          fileName: fileName,
          extractFields: [
            'montant_ht',
            'montant_ttc',
            'taux_tva',
            'date_document',
            'date_echeance',
            'numero_facture',
            'fournisseur',
          ],
          language: 'fr',
        }),
      });

      if (!response.ok) {
        throw new Error(`Landing AI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Parse Landing AI response
      const result: DAFExtractionResult = {
        success: true,
        provider: 'landing-ai',
        confidence: data.confidence || 0.8,
        montant_ht: data.fields?.montant_ht?.value,
        montant_ttc: data.fields?.montant_ttc?.value,
        taux_tva: data.fields?.taux_tva?.value,
        date_document: data.fields?.date_document?.value,
        date_echeance: data.fields?.date_echeance?.value,
        numero_facture: data.fields?.numero_facture?.value,
        fournisseur: data.fields?.fournisseur?.value,
        extraction_duration_ms: Date.now() - startTime,
        raw_response: data,
      };

      console.log(`[Landing AI] Extraction completed in ${result.extraction_duration_ms}ms (confidence: ${result.confidence})`);

      return result;

    } catch (error) {
      console.error('[Landing AI] Extraction failed:', error);

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
