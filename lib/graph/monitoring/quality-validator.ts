/**
 * Quality Validator - Output Validation and Confidence Scoring
 *
 * Validates AI outputs and generates quality flags for human review
 */

import type {
  QualityAssessment,
  QualityFlag,
  QualityLevel,
  ConfidenceScore,
} from './types';
import type { EvaluationResult } from '@/lib/cv-analysis/types';

export class QualityValidator {
  constructor(
    private minConfidence: number = 0.6,
    private strictValidation: boolean = false
  ) {}

  /**
   * Validate AI output and calculate quality assessment
   */
  validate(
    result: EvaluationResult,
    providersRaw?: Record<string, EvaluationResult>,
    consensus?: any
  ): QualityAssessment {
    const flags: QualityFlag[] = [];
    const validationErrors: string[] = [];
    const recommendations: string[] = [];

    // Calculate confidence score
    const confidenceScore = this.calculateConfidenceScore(result, providersRaw, consensus);

    // Check evidence quality
    flags.push(...this.validateEvidence(result));

    // Check consistency
    if (providersRaw && Object.keys(providersRaw).length > 1) {
      flags.push(...this.validateConsistency(result, providersRaw, consensus));
    }

    // Check completeness
    flags.push(...this.validateCompleteness(result));

    // Check for suspicious patterns
    flags.push(...this.detectSuspiciousPatterns(result));

    // Determine if human review is required
    const requiresHumanReview = this.shouldRequireHumanReview(confidenceScore, flags);

    // Determine overall quality level
    const qualityLevel = this.determineQualityLevel(confidenceScore, flags);

    // Generate recommendations
    if (confidenceScore.overall < 0.7) {
      recommendations.push('Consider running with premium mode for higher confidence');
    }
    if (confidenceScore.evidence_quality < 0.6) {
      recommendations.push('Evidence quality is low - consider manual review of citations');
    }
    if (flags.some(f => f.type === 'inconsistent_scoring')) {
      recommendations.push('Inconsistent scoring detected - review provider results');
    }

    return {
      quality_level: qualityLevel,
      confidence_score: confidenceScore,
      flags,
      requires_human_review: requiresHumanReview,
      validation_errors: validationErrors,
      recommendations,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Calculate comprehensive confidence score
   */
  private calculateConfidenceScore(
    result: EvaluationResult,
    providersRaw?: Record<string, EvaluationResult>,
    consensus?: any
  ): ConfidenceScore {
    // Evidence quality (0-1)
    const evidenceQuality = this.scoreEvidenceQuality(result);

    // Consistency (0-1) - based on cross-provider agreement
    const consistency = this.scoreConsistency(result, providersRaw, consensus);

    // Completeness (0-1) - all required fields populated
    const completeness = this.scoreCompleteness(result);

    // Overall confidence (weighted average)
    const overall =
      evidenceQuality * 0.4 +
      consistency * 0.3 +
      completeness * 0.3;

    return {
      overall,
      evidence_quality: evidenceQuality,
      consistency,
      completeness,
      breakdown: {
        evidence_quality: evidenceQuality,
        consistency,
        completeness,
      },
    };
  }

  /**
   * Score evidence quality based on quote precision
   */
  private scoreEvidenceQuality(result: EvaluationResult): number {
    const allEvidence: any[] = [];

    // Collect all evidence
    if (result.fails) {
      for (const fail of result.fails) {
        allEvidence.push(...(fail.evidence || []));
      }
    }

    if (result.relevance_summary?.by_experience) {
      for (const exp of result.relevance_summary.by_experience) {
        if ((exp as any).evidence) {
          allEvidence.push(...(exp as any).evidence);
        }
      }
    }

    if (allEvidence.length === 0) {
      return 0.5; // Neutral if no evidence
    }

    // Score each evidence (0-1)
    let totalScore = 0;
    for (const evidence of allEvidence) {
      let score = 0;

      // Has quote?
      if (evidence.quote && evidence.quote.length > 10) {
        score += 0.5;
      }

      // Has field_path?
      if (evidence.field_path) {
        score += 0.3;
      }

      // Quote is not generic?
      if (evidence.quote && !this.isGenericQuote(evidence.quote)) {
        score += 0.2;
      }

      totalScore += score;
    }

    return totalScore / allEvidence.length;
  }

  /**
   * Check if quote is generic/vague
   */
  private isGenericQuote(quote: string): boolean {
    const genericPatterns = [
      /has experience/i,
      /worked on/i,
      /responsible for/i,
      /involved in/i,
      /participated in/i,
    ];

    return genericPatterns.some(pattern => pattern.test(quote));
  }

  /**
   * Score consistency across providers
   */
  private scoreConsistency(
    result: EvaluationResult,
    providersRaw?: Record<string, EvaluationResult>,
    consensus?: any
  ): number {
    if (!providersRaw || Object.keys(providersRaw).length <= 1) {
      return 1.0; // Perfect consistency with single provider
    }

    if (consensus?.agreement_score !== undefined) {
      return consensus.agreement_score;
    }

    // Calculate score variance
    const scores = Object.values(providersRaw).map(r => r.overall_score_0_to_100);
    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    // Convert to consistency score (lower variance = higher consistency)
    // stdDev of 0 = 1.0, stdDev of 20+ = 0.0
    return Math.max(0, 1 - (stdDev / 20));
  }

  /**
   * Score completeness
   */
  private scoreCompleteness(result: EvaluationResult): number {
    let requiredFields = 0;
    let populatedFields = 0;

    // Check required fields
    const checks = [
      { field: result.recommendation, name: 'recommendation' },
      { field: result.overall_score_0_to_100, name: 'overall_score' },
      { field: result.subscores, name: 'subscores' },
      { field: result.relevance_summary, name: 'relevance_summary' },
      { field: result.strengths, name: 'strengths' },
      { field: result.improvements, name: 'improvements' },
    ];

    for (const check of checks) {
      requiredFields++;
      if (check.field !== undefined && check.field !== null) {
        if (Array.isArray(check.field)) {
          if (check.field.length > 0) populatedFields++;
        } else if (typeof check.field === 'object') {
          if (Object.keys(check.field).length > 0) populatedFields++;
        } else {
          populatedFields++;
        }
      }
    }

    return populatedFields / requiredFields;
  }

  /**
   * Validate evidence quality
   */
  private validateEvidence(result: EvaluationResult): QualityFlag[] {
    const flags: QualityFlag[] = [];

    // Check fails have evidence
    if (result.fails && result.fails.length > 0) {
      for (const fail of result.fails) {
        if (!fail.evidence || fail.evidence.length === 0) {
          flags.push({
            type: 'missing_evidence',
            severity: 'medium',
            message: `Must-have failure "${fail.must_have_id}" has no evidence`,
            field_path: `fails[${result.fails.indexOf(fail)}].evidence`,
            suggestion: 'Add specific quotes from CV to support this failure',
            requires_human_review: true,
          });
        } else {
          // Check evidence quality
          for (const evidence of fail.evidence) {
            if (!evidence.quote || evidence.quote.length < 10) {
              flags.push({
                type: 'missing_evidence',
                severity: 'low',
                message: `Weak evidence quote for "${fail.must_have_id}"`,
                field_path: `fails[${result.fails.indexOf(fail)}].evidence`,
                suggestion: 'Provide more specific quotes',
                requires_human_review: false,
              });
            }
          }
        }
      }
    }

    return flags;
  }

  /**
   * Validate consistency across providers
   */
  private validateConsistency(
    result: EvaluationResult,
    providersRaw: Record<string, EvaluationResult>,
    consensus?: any
  ): QualityFlag[] {
    const flags: QualityFlag[] = [];

    // Check recommendation consistency
    const recommendations = Object.values(providersRaw).map(r => r.recommendation);
    const uniqueRecommendations = new Set(recommendations);

    if (uniqueRecommendations.size > 1) {
      flags.push({
        type: 'inconsistent_scoring',
        severity: 'medium',
        message: `Providers disagree on recommendation: ${Array.from(uniqueRecommendations).join(', ')}`,
        suggestion: 'Review individual provider results and consider re-analyzing',
        requires_human_review: true,
      });
    }

    // Check score variance
    const scores = Object.values(providersRaw).map(r => r.overall_score_0_to_100);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const scoreDelta = maxScore - minScore;

    if (scoreDelta > 20) {
      flags.push({
        type: 'inconsistent_scoring',
        severity: 'high',
        message: `Large score variance: ${scoreDelta} points (${minScore}-${maxScore})`,
        suggestion: 'Significant disagreement - consider manual review',
        requires_human_review: true,
      });
    }

    return flags;
  }

  /**
   * Validate completeness
   */
  private validateCompleteness(result: EvaluationResult): QualityFlag[] {
    const flags: QualityFlag[] = [];

    // Check for empty strengths
    if (!result.strengths || result.strengths.length === 0) {
      flags.push({
        type: 'incomplete_analysis',
        severity: 'low',
        message: 'No strengths identified',
        field_path: 'strengths',
        suggestion: 'Every candidate should have some strengths',
        requires_human_review: false,
      });
    }

    // Check for empty improvements
    if (!result.improvements || result.improvements.length === 0) {
      flags.push({
        type: 'incomplete_analysis',
        severity: 'low',
        message: 'No improvements identified',
        field_path: 'improvements',
        suggestion: 'Every candidate should have areas for improvement',
        requires_human_review: false,
      });
    }

    return flags;
  }

  /**
   * Detect suspicious patterns
   */
  private detectSuspiciousPatterns(result: EvaluationResult): QualityFlag[] {
    const flags: QualityFlag[] = [];

    // Perfect score without justification
    if (result.overall_score_0_to_100 === 100) {
      if (!result.strengths || result.strengths.length < 3) {
        flags.push({
          type: 'suspicious_pattern',
          severity: 'medium',
          message: 'Perfect score (100) but insufficient strengths listed',
          suggestion: 'Review scoring rationale',
          requires_human_review: true,
        });
      }
    }

    // Zero score without failures
    if (result.overall_score_0_to_100 === 0) {
      if (!result.fails || result.fails.length === 0) {
        flags.push({
          type: 'suspicious_pattern',
          severity: 'high',
          message: 'Zero score but no failed must-haves',
          suggestion: 'Investigate scoring logic',
          requires_human_review: true,
        });
      }
    }

    return flags;
  }

  /**
   * Determine if human review is required
   */
  private shouldRequireHumanReview(confidence: ConfidenceScore, flags: QualityFlag[]): boolean {
    // Low overall confidence
    if (confidence.overall < this.minConfidence) {
      return true;
    }

    // Any critical or high severity flags
    if (flags.some(f => f.severity === 'critical' || f.severity === 'high')) {
      return true;
    }

    // Multiple medium severity flags
    const mediumFlags = flags.filter(f => f.severity === 'medium');
    if (mediumFlags.length >= 2) {
      return true;
    }

    // Any flags that explicitly require review
    if (flags.some(f => f.requires_human_review)) {
      return true;
    }

    return false;
  }

  /**
   * Determine overall quality level
   */
  private determineQualityLevel(confidence: ConfidenceScore, flags: QualityFlag[]): QualityLevel {
    // Critical issues
    if (flags.some(f => f.severity === 'critical')) {
      return 'critical';
    }

    // Very low confidence
    if (confidence.overall < 0.4) {
      return 'low';
    }

    // High severity flags or low confidence
    if (flags.some(f => f.severity === 'high') || confidence.overall < 0.6) {
      return 'low';
    }

    // Multiple medium flags or medium confidence
    const mediumFlags = flags.filter(f => f.severity === 'medium');
    if (mediumFlags.length >= 2 || confidence.overall < 0.75) {
      return 'medium';
    }

    // High quality
    return 'high';
  }
}

/**
 * Factory function
 */
export function createQualityValidator(
  minConfidence?: number,
  strictValidation?: boolean
): QualityValidator {
  return new QualityValidator(minConfidence, strictValidation);
}
