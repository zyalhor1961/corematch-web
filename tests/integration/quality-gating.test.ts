/**
 * Tests d'intégration pour Evidence Quality Gating (MCP Point #5)
 *
 * Valide:
 * - Scoring des evidences (0-2)
 * - Détection evidences vagues
 * - Quality gating (proceed/reject/fallback)
 * - Extraction des evidences depuis résultats
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import type { Evidence } from '@/lib/cv-analysis/types';
import {
  scoreEvidence,
  scoreEvidenceQuality,
  applyQualityGating,
  validateEvidenceQuality,
  filterEvidencesByQuality,
} from '@/lib/mcp/quality';

// ============================================================================
// Helpers & Fixtures
// ============================================================================

const strongEvidence: Evidence = {
  quote: 'Développement applications React/Node.js pendant 3 ans',
  field_path: 'experiences[0].missions[0]',
};

const mediumEvidence: Evidence = {
  quote: 'Lead développement applications React/Node.js pendant 3 années',
  field_path: '', // Pas de field_path
};

const weakEvidence: Evidence = {
  quote: 'a de l\'expérience',
  field_path: '',
};

const mockEvaluationResult = {
  relevance_summary: {
    by_experience: [
      {
        index: 0,
        titre: 'Développeur Full Stack',
        relevance: 'DIRECTE',
        reason: 'Correspond au poste',
        evidence: [strongEvidence, mediumEvidence],
      },
      {
        index: 1,
        titre: 'Développeur Frontend',
        relevance: 'ADJACENTE',
        reason: 'Expérience connexe',
        evidence: [weakEvidence],
      },
    ],
  },
  strengths: [
    {
      point: 'Expertise React',
      evidence: [strongEvidence],
    },
  ],
  fails: [],
};

// ============================================================================
// TESTS - Evidence Scoring
// ============================================================================

describe('Evidence Quality Gating - Scoring', () => {
  describe('scoreEvidence', () => {
    it('should score strong evidence (2)', () => {
      const result = scoreEvidence(strongEvidence);

      expect(result.quality_score).toBe(2);
      expect(result.reason).toContain('Citation exacte');
    });

    it('should score medium evidence (1)', () => {
      const result = scoreEvidence(mediumEvidence);

      expect(result.quality_score).toBe(1);
      expect(result.reason).toContain('Citation précise');
    });

    it('should score weak evidence (0)', () => {
      const result = scoreEvidence(weakEvidence);

      expect(result.quality_score).toBe(0);
      expect(result.reason).toContain('vague');
    });

    it('should detect vague quotes', () => {
      const vague: Evidence = {
        quote: 'a travaillé avec React',
        field_path: 'experiences[0]',
      };

      const result = scoreEvidence(vague);
      expect(result.quality_score).toBe(0);
    });
  });

  describe('scoreEvidenceQuality', () => {
    it('should calculate quality metrics for evidence set', () => {
      const evidences = [strongEvidence, strongEvidence, mediumEvidence, weakEvidence];
      const result = scoreEvidenceQuality(evidences);

      expect(result.total_evidences).toBe(4);
      expect(result.strong_count).toBe(2);
      expect(result.medium_count).toBe(1);
      expect(result.weak_count).toBe(1);
      // (2+2+1+0) / 4 = 1.25
      expect(result.average_quality).toBeCloseTo(1.25, 2);
      // (5/8) * 100 = 62.5%
      expect(result.quality_percentage).toBeCloseTo(62.5, 1);
    });

    it('should handle empty evidence array', () => {
      const result = scoreEvidenceQuality([]);

      expect(result.total_evidences).toBe(0);
      expect(result.average_quality).toBe(0);
      expect(result.quality_percentage).toBe(0);
    });
  });
});

// ============================================================================
// TESTS - Quality Gating
// ============================================================================

describe('Evidence Quality Gating - Gating', () => {
  describe('applyQualityGating', () => {
    it('should approve high quality results', () => {
      const highQualityResult = {
        relevance_summary: {
          by_experience: [
            {
              evidence: [strongEvidence, strongEvidence, mediumEvidence],
            },
          ],
        },
      };

      const decision = applyQualityGating(highQualityResult, {
        min_average_quality: 1.0,
        min_quality_percentage: 50,
        min_strong_evidences: 1,
      });

      expect(decision.approved).toBe(true);
      expect(decision.action).toBe('proceed');
      expect(decision.quality_result.strong_count).toBe(2);
    });

    it('should reject low quality results', () => {
      const lowQualityResult = {
        relevance_summary: {
          by_experience: [
            {
              evidence: [weakEvidence, weakEvidence],
            },
          ],
        },
      };

      const decision = applyQualityGating(lowQualityResult, {
        min_average_quality: 1.0,
        min_quality_percentage: 50,
        min_strong_evidences: 1,
        enable_fallback: false,
      });

      expect(decision.approved).toBe(false);
      expect(decision.action).toBe('reject');
      expect(decision.reason).toContain('insuffisante');
    });

    it('should trigger fallback for low quality when enabled', () => {
      const lowQualityResult = {
        relevance_summary: {
          by_experience: [
            {
              evidence: [weakEvidence],
            },
          ],
        },
      };

      const decision = applyQualityGating(lowQualityResult, {
        min_average_quality: 1.0,
        min_quality_percentage: 50,
        min_strong_evidences: 1,
        enable_fallback: true,
      });

      expect(decision.approved).toBe(false);
      expect(decision.action).toBe('fallback_reextract');
    });

    it('should handle no evidences', () => {
      const noEvidenceResult = {
        relevance_summary: {
          by_experience: [],
        },
      };

      const decision = applyQualityGating(noEvidenceResult);

      expect(decision.approved).toBe(false);
      expect(decision.action).toBe('fallback_reextract');
      expect(decision.reason).toContain('Aucune evidence');
    });
  });

  describe('validateEvidenceQuality', () => {
    it('should validate quality above threshold', () => {
      const evidences = [strongEvidence, strongEvidence, mediumEvidence];
      const isValid = validateEvidenceQuality(evidences, 50);

      expect(isValid).toBe(true);
    });

    it('should reject quality below threshold', () => {
      const evidences = [weakEvidence, weakEvidence];
      const isValid = validateEvidenceQuality(evidences, 50);

      expect(isValid).toBe(false);
    });
  });

  describe('filterEvidencesByQuality', () => {
    it('should filter evidences by minimum score', () => {
      const evidences = [strongEvidence, mediumEvidence, weakEvidence];

      const strong = filterEvidencesByQuality(evidences, 2);
      expect(strong).toHaveLength(1);

      const mediumAndAbove = filterEvidencesByQuality(evidences, 1);
      expect(mediumAndAbove).toHaveLength(2);

      const all = filterEvidencesByQuality(evidences, 0);
      expect(all).toHaveLength(3);
    });
  });
});

// ============================================================================
// TESTS - Integration Scenarios
// ============================================================================

describe('Evidence Quality Gating - Integration', () => {
  it('should extract and score evidences from full evaluation result', () => {
    const decision = applyQualityGating(mockEvaluationResult, {
      min_average_quality: 0.8,
      min_quality_percentage: 40,
      min_strong_evidences: 1,
    });

    expect(decision.approved).toBe(true);
    expect(decision.quality_result.total_evidences).toBeGreaterThan(0);
    expect(decision.quality_result.strong_count).toBeGreaterThan(0);
  });

  it('should provide detailed quality metrics', () => {
    const decision = applyQualityGating(mockEvaluationResult);

    expect(decision.quality_result).toHaveProperty('total_evidences');
    expect(decision.quality_result).toHaveProperty('weak_count');
    expect(decision.quality_result).toHaveProperty('medium_count');
    expect(decision.quality_result).toHaveProperty('strong_count');
    expect(decision.quality_result).toHaveProperty('average_quality');
    expect(decision.quality_result).toHaveProperty('quality_percentage');
  });
});
