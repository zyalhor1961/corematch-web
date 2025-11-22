/**
 * Ask DAF - Natural Language Analytics Module
 *
 * Provides chat-based analytics for DAF (Finance Assistant) users
 *
 * Architecture:
 * - orchestrator.ts: Main entry point (Intent + RAG + Agent + Validation)
 * - intent-classifier.ts: Question classification and filter extraction
 * - validation.ts: Response validation and hallucination detection
 * - tools.ts: Database tools for data access
 * - agent.ts: Legacy agent (use orchestrator instead)
 */

// Main orchestrator (recommended entry point)
export { orchestrateQuery, runDafAgent } from './orchestrator';

// Intent Classification
export {
  classifyIntent,
  getRecommendedTools,
  logClassification,
} from './intent-classifier';

// Validation
export {
  validateDafResponse,
  quickValidate,
} from './validation';

// Types
export * from './types';

// Tools
export * from './tools';

// Legacy agent (for backwards compatibility)
export { runDafAgent as runDafAgentLegacy } from './agent';
