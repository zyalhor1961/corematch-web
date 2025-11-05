/**
 * Orchestrateur d'extraction DAF - Version Intelligente
 *
 * Stratégie d'optimisation des coûts :
 * 1. Analyse du PDF (natif vs scanné)
 * 2. Si natif → Simple text parser (GRATUIT)
 * 3. Si scanné → Landing AI (CHER mais puissant)
 * 4. Fallback → Azure DI
 */

import { LandingAIExtractor } from './landing-ai-extractor';
import { AzureDIExtractor } from './azure-di-extractor';
import { SimpleTextExtractor } from './simple-text-extractor';
import { analyzePDFType } from './pdf-detector';
import type { DAFExtractionResult, DAFExtractionConfig } from './types';

const DEFAULT_CONFIG: DAFExtractionConfig = {
  primaryProvider: 'landing-ai',
  fallbackProvider: 'azure-di',
  timeout: 30000, // 30s
};

export class DAFExtractionOrchestrator {
  private landingAI: LandingAIExtractor;
  private azureDI: AzureDIExtractor;
  private simpleText: SimpleTextExtractor;
  private config: DAFExtractionConfig;

  constructor(config?: Partial<DAFExtractionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.landingAI = new LandingAIExtractor();
    this.azureDI = new AzureDIExtractor();
    this.simpleText = new SimpleTextExtractor();
  }

  /**
   * Extract document data using intelligent provider selection
   */
  async extractDocument(
    fileBuffer: ArrayBuffer,
    fileName: string
  ): Promise<DAFExtractionResult> {
    console.log(`[DAF Extraction] Starting extraction for: ${fileName}`);

    // ÉTAPE 1: Analyser le type de PDF
    const pdfAnalysis = await analyzePDFType(fileBuffer);

    console.log(`[DAF Extraction] PDF Analysis: ${pdfAnalysis.type} (${(pdfAnalysis.confidence * 100).toFixed(0)}% confidence)`);
    console.log(`[DAF Extraction] Recommendation: ${pdfAnalysis.recommendation}`);
    console.log(`[DAF Extraction] Text density: ${pdfAnalysis.avgTextPerPage.toFixed(0)} chars/page`);

    // ÉTAPE 2: Choisir la stratégie d'extraction selon le type
    let result: DAFExtractionResult;

    if (pdfAnalysis.recommendation === 'simple-parser') {
      // PDF NATIF → Utiliser le parser simple (GRATUIT!)
      console.log(`[DAF Extraction] 💰 Using FREE simple text parser (native PDF detected)`);

      try {
        result = await this.executeWithTimeout(
          this.simpleText.extractDocument(fileBuffer, fileName),
          this.config.timeout
        );

        // Si le parser simple fonctionne bien, on le garde!
        if (result.success && result.confidence > 0.6) {
          console.log(`[DAF Extraction] ✓ Simple parser succeeded with confidence ${result.confidence}`);
          return result;
        }

        console.warn(`[DAF Extraction] Simple parser failed or low confidence (${result.confidence}), falling back to OCR...`);

      } catch (error) {
        console.error('[DAF Extraction] Simple parser error:', error);
      }
    }

    // ÉTAPE 3: Fallback vers OCR (Azure DI prioritaire)
    console.log(`[DAF Extraction] 🔍 Using Azure Document Intelligence for extraction`);

    try {
      result = await this.executeWithTimeout(
        this.azureDI.extractDocument(fileBuffer, fileName),
        this.config.timeout
      );

      if (result.success) {
        console.log(`[DAF Extraction] ✓ Azure DI succeeded with confidence ${result.confidence}`);
        return result;
      }

      console.warn(`[DAF Extraction] Azure DI failed, using simple parser result as fallback`);

    } catch (error) {
      console.error('[DAF Extraction] Azure DI error:', error);
      console.log('[DAF Extraction] Falling back to simple parser result');
    }

    // Fallback: retourner le résultat du simple parser si Azure échoue
    if (result && result.success) {
      console.log(`[DAF Extraction] Using simple parser result (confidence: ${result.confidence})`);
      return result;
    }

    // Aucun extracteur n'a fonctionné
    return {
      success: false,
      provider: 'azure-di',
      confidence: 0,
      extraction_duration_ms: 0,
      error: 'All extraction methods failed',
    };

    // Try primary provider (Landing AI) - DÉSACTIVÉ
    /* try {
      const primaryExtractor = this.getExtractor(this.config.primaryProvider);
      result = await this.executeWithTimeout(
        primaryExtractor.extractDocument(fileBuffer, fileName),
        this.config.timeout
      );

      if (result.success && result.confidence > 0.6) {
        console.log(`[DAF Extraction] ✓ Primary provider (${result.provider}) succeeded with confidence ${result.confidence}`);
        return result;
      }

      console.warn(`[DAF Extraction] Primary provider failed or low confidence (${result.confidence}), trying fallback...`);

      // Try fallback if configured
      if (this.config.fallbackProvider) {
        return await this.tryFallback(fileBuffer, fileName);
      }

      // No fallback configured, return primary result
      return result;

    } catch (error) {
      console.error('[DAF Extraction] Primary provider error:', error);

      // Try fallback
      if (this.config.fallbackProvider) {
        return await this.tryFallback(fileBuffer, fileName);
      }

      // No fallback, return error
      return {
        success: false,
        provider: this.config.primaryProvider,
        confidence: 0,
        extraction_duration_ms: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } */
  }

  /**
   * Try fallback provider
   */
  private async tryFallback(
    fileBuffer: ArrayBuffer,
    fileName: string
  ): Promise<DAFExtractionResult> {
    if (!this.config.fallbackProvider) {
      throw new Error('No fallback provider configured');
    }

    console.log(`[DAF Extraction] Trying fallback provider: ${this.config.fallbackProvider}`);

    try {
      const fallbackExtractor = this.getExtractor(this.config.fallbackProvider);
      const result = await this.executeWithTimeout(
        fallbackExtractor.extractDocument(fileBuffer, fileName),
        this.config.timeout
      );

      if (result.success) {
        console.log(`[DAF Extraction] ✓ Fallback provider (${result.provider}) succeeded with confidence ${result.confidence}`);
      } else {
        console.error(`[DAF Extraction] ✗ Fallback provider failed: ${result.error}`);
      }

      return result;

    } catch (error) {
      console.error('[DAF Extraction] Fallback provider error:', error);

      return {
        success: false,
        provider: this.config.fallbackProvider,
        confidence: 0,
        extraction_duration_ms: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get extractor instance for provider
   */
  private getExtractor(provider: 'landing-ai' | 'azure-di') {
    switch (provider) {
      case 'landing-ai':
        return this.landingAI;
      case 'azure-di':
        return this.azureDI;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Execute promise with timeout
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }
}

/**
 * Factory function for easy usage
 */
export async function extractDAFDocument(
  fileBuffer: ArrayBuffer,
  fileName: string,
  config?: Partial<DAFExtractionConfig>
): Promise<DAFExtractionResult> {
  const orchestrator = new DAFExtractionOrchestrator(config);
  return orchestrator.extractDocument(fileBuffer, fileName);
}
