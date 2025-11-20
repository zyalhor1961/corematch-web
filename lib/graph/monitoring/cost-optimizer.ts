/**
 * Cost Optimizer - Smart Provider Selection
 *
 * Selects providers based on budget constraints and optimization strategy
 */

import type {
  CostBudget,
  CostMetrics,
  TokenUsage,
  ProviderSelectionStrategy,
  Alert,
} from './types';
import { v4 as uuidv4 } from 'uuid';

// Provider cost per 1M tokens (approximate, configurable)
const PROVIDER_COSTS = {
  openai: {
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
  },
  gemini: {
    'gemini-1.5-pro': { input: 1.25, output: 5.00 },
    'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  },
  claude: {
    'claude-3-5-sonnet': { input: 3.00, output: 15.00 },
    'claude-3-haiku': { input: 0.25, output: 1.25 },
  },
} as const;

export class CostOptimizer {
  private currentCost: number = 0;
  private tokenUsageHistory: TokenUsage[] = [];
  private cacheSavings: number = 0;

  constructor(
    private budget?: CostBudget,
    private strategy: ProviderSelectionStrategy = { mode: 'balanced', fallback_enabled: true }
  ) {}

  /**
   * Select optimal provider based on budget and strategy
   */
  selectProvider(
    mode: 'eco' | 'balanced' | 'premium',
    operation: 'extract' | 'analyze' | 'arbitrate',
    remainingBudget?: number
  ): { provider: string; model: string; reason: string } {
    // Check budget constraint
    if (remainingBudget !== undefined && remainingBudget <= 0) {
      return {
        provider: 'openai',
        model: 'gpt-4o-mini',
        reason: 'Budget exhausted - using cheapest option',
      };
    }

    // Cost-optimized strategy
    if (this.strategy.mode === 'cost_optimized') {
      return this.getCheapestProvider(operation);
    }

    // Quality-optimized strategy
    if (this.strategy.mode === 'quality_optimized') {
      return this.getBestQualityProvider(operation);
    }

    // Balanced strategy (default)
    return this.getBalancedProvider(mode, operation, remainingBudget);
  }

  /**
   * Get cheapest provider for operation
   */
  private getCheapestProvider(operation: string): { provider: string; model: string; reason: string } {
    const cheapest = {
      extract: { provider: 'openai', model: 'gpt-4o-mini', cost: 0.15 },
      analyze: { provider: 'gemini', model: 'gemini-1.5-flash', cost: 0.075 },
      arbitrate: { provider: 'openai', model: 'gpt-4o-mini', cost: 0.15 },
    };

    const selected = cheapest[operation as keyof typeof cheapest] || cheapest.analyze;
    return {
      provider: selected.provider,
      model: selected.model,
      reason: `Cost-optimized: Cheapest option for ${operation} ($${selected.cost}/1M tokens)`,
    };
  }

  /**
   * Get best quality provider for operation
   */
  private getBestQualityProvider(operation: string): { provider: string; model: string; reason: string } {
    const best = {
      extract: { provider: 'openai', model: 'gpt-4o', reason: 'Best extraction quality' },
      analyze: { provider: 'claude', model: 'claude-3-5-sonnet', reason: 'Best analysis quality' },
      arbitrate: { provider: 'openai', model: 'gpt-4o', reason: 'Best arbitration quality' },
    };

    return best[operation as keyof typeof best] || best.analyze;
  }

  /**
   * Get balanced provider based on mode and budget
   */
  private getBalancedProvider(
    mode: 'eco' | 'balanced' | 'premium',
    operation: string,
    remainingBudget?: number
  ): { provider: string; model: string; reason: string } {
    // Premium mode: Use best models
    if (mode === 'premium') {
      return this.getBestQualityProvider(operation);
    }

    // Eco mode: Use cheapest models
    if (mode === 'eco') {
      return this.getCheapestProvider(operation);
    }

    // Balanced mode: Smart selection
    if (operation === 'extract') {
      return {
        provider: 'openai',
        model: 'gpt-4o-mini',
        reason: 'Balanced: Fast and cheap extraction',
      };
    }

    if (operation === 'analyze') {
      // Use cheaper models if budget is tight
      if (remainingBudget !== undefined && remainingBudget < 0.02) {
        return {
          provider: 'gemini',
          model: 'gemini-1.5-flash',
          reason: 'Budget-aware: Low budget, using cheaper model',
        };
      }

      return {
        provider: 'openai',
        model: 'gpt-4o',
        reason: 'Balanced: High quality analysis',
      };
    }

    // Arbitrate
    return {
      provider: 'openai',
      model: 'gpt-4o',
      reason: 'Balanced: Reliable arbitration',
    };
  }

  /**
   * Track token usage and calculate cost
   */
  trackTokenUsage(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    operation: string
  ): TokenUsage {
    const cost = this.calculateCost(provider, model, inputTokens, outputTokens);

    const usage: TokenUsage = {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
      cost_usd: cost,
      provider,
      model,
      timestamp: new Date().toISOString(),
    };

    this.tokenUsageHistory.push(usage);
    this.currentCost += cost;

    return usage;
  }

  /**
   * Calculate cost for token usage
   */
  private calculateCost(provider: string, model: string, inputTokens: number, outputTokens: number): number {
    const costs = (PROVIDER_COSTS as any)[provider]?.[model];
    if (!costs) {
      console.warn(`[CostOptimizer] Unknown provider/model: ${provider}/${model}`);
      return 0;
    }

    const inputCost = (inputTokens / 1_000_000) * costs.input;
    const outputCost = (outputTokens / 1_000_000) * costs.output;

    return inputCost + outputCost;
  }

  /**
   * Track cache savings
   */
  trackCacheHit(estimatedCost: number): void {
    this.cacheSavings += estimatedCost;
  }

  /**
   * Check budget and generate alerts
   */
  checkBudget(): Alert[] {
    const alerts: Alert[] = [];

    if (!this.budget) {
      return alerts;
    }

    const budgetUsedPct = this.currentCost / this.budget.max_cost_usd;

    // Warn threshold exceeded
    if (budgetUsedPct >= this.budget.warn_threshold_pct && budgetUsedPct < 1.0) {
      alerts.push({
        id: uuidv4(),
        severity: 'warning',
        type: 'budget_exceeded',
        message: `Budget warning: ${(budgetUsedPct * 100).toFixed(1)}% used ($${this.currentCost.toFixed(4)} / $${this.budget.max_cost_usd})`,
        details: {
          current_cost: this.currentCost,
          budget: this.budget.max_cost_usd,
          percentage: budgetUsedPct,
        },
        timestamp: new Date().toISOString(),
        resolved: false,
      });
    }

    // Budget exceeded
    if (budgetUsedPct >= 1.0) {
      alerts.push({
        id: uuidv4(),
        severity: this.budget.mode === 'strict' ? 'critical' : 'error',
        type: 'budget_exceeded',
        message: `Budget ${this.budget.mode === 'strict' ? 'EXCEEDED' : 'exceeded'}: ${(budgetUsedPct * 100).toFixed(1)}% used ($${this.currentCost.toFixed(4)} / $${this.budget.max_cost_usd})`,
        details: {
          current_cost: this.currentCost,
          budget: this.budget.max_cost_usd,
          percentage: budgetUsedPct,
          mode: this.budget.mode,
        },
        timestamp: new Date().toISOString(),
        resolved: false,
      });

      // Throw error if strict mode
      if (this.budget.mode === 'strict') {
        throw new Error(`Budget exceeded: $${this.currentCost.toFixed(4)} / $${this.budget.max_cost_usd} (strict mode)`);
      }
    }

    return alerts;
  }

  /**
   * Get cost metrics
   */
  getMetrics(): CostMetrics {
    const costByProvider: Record<string, number> = {};
    const costByOperation: Record<string, number> = {};

    for (const usage of this.tokenUsageHistory) {
      costByProvider[usage.provider] = (costByProvider[usage.provider] || 0) + usage.cost_usd;
    }

    const totalAnalyses = this.tokenUsageHistory.length > 0 ? 1 : 0; // Simplification

    return {
      total_cost_usd: this.currentCost,
      budget_used_pct: this.budget ? this.currentCost / this.budget.max_cost_usd : 0,
      cost_by_provider: costByProvider,
      cost_by_operation: costByOperation,
      token_usage: this.tokenUsageHistory,
      cache_savings_usd: this.cacheSavings,
      avg_cost_per_analysis: totalAnalyses > 0 ? this.currentCost / totalAnalyses : 0,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get remaining budget
   */
  getRemainingBudget(): number | undefined {
    if (!this.budget) {
      return undefined;
    }

    return Math.max(0, this.budget.max_cost_usd - this.currentCost);
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.currentCost = 0;
    this.tokenUsageHistory = [];
    this.cacheSavings = 0;
  }
}

/**
 * Factory function
 */
export function createCostOptimizer(
  budget?: CostBudget,
  strategy?: ProviderSelectionStrategy
): CostOptimizer {
  return new CostOptimizer(budget, strategy);
}
