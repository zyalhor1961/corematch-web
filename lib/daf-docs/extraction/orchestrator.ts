/**
 * Orchestrateur d'extraction DAF
 * Try Landing AI → Fallback to Azure DI
 */

import { LandingAIExtractor } from './landing-ai-extractor';
import { AzureDIExtractor } from './azure-di-extractor';
import type { DAFExtractionResult, DAFExtractionConfig } from './types';

const DEFAULT_CONFIG: DAFExtractionConfig = {
  primaryProvider: 'landing-ai',
  fallbackProvider: 'azure-di',
  timeout: 30000, // 30s
};

export class DAFExtractionOrchestrator {
  private landingAI: LandingAIExtractor;
  private azureDI: AzureDIExtractor;
  private config: DAFExtractionConfig;

  constructor(config?: Partial<DAFExtractionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.landingAI = new LandingAIExtractor();
    this.azureDI = new AzureDIExtractor();
  }

  /**
   * Extract document data using primary provider with fallback
   */
  async extractDocument(
    fileBuffer: ArrayBuffer,
    fileName: string
  ): Promise<DAFExtractionResult> {
    console.log(`[DAF Extraction] Starting extraction for: ${fileName}`);
    console.log(`[DAF Extraction] Primary: ${this.config.primaryProvider}, Fallback: ${this.config.fallbackProvider || 'none'}`);

    // Try primary provider
    try {
      const primaryExtractor = this.getExtractor(this.config.primaryProvider);
      const result = await this.executeWithTimeout(
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
    }
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
