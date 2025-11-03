/**
 * DAF Document Extraction Library
 * Landing AI (primary) + Azure DI (fallback)
 */

export { extractDAFDocument, DAFExtractionOrchestrator } from './orchestrator';
export { LandingAIExtractor } from './landing-ai-extractor';
export { AzureDIExtractor } from './azure-di-extractor';
export type { DAFExtractionResult, DAFExtractor, DAFExtractionConfig } from './types';
