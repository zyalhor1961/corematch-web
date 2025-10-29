/**
 * Tests d'intégration pour Smart Cost Optimizer (MCP Point #6)
 *
 * Valide:
 * - Scoring confiance extraction (0-100)
 * - Auto-upgrade eco→balanced si confiance < 70%
 * - Auto-downgrade premium→balanced si confiance > 95%
 * - Calcul métriques de coût et économies
 */

import { describe, it, expect } from '@jest/globals';
import type { CV_JSON } from '@/lib/cv-analysis/types';
import {
  scoreExtractionConfidence,
  optimizeAnalysisMode,
  calculateCostMetrics,
  recommendMode,
} from '@/lib/mcp/quality';

// ============================================================================
// Fixtures - CVs avec différents niveaux de confiance
// ============================================================================

const highConfidenceCV: CV_JSON = {
  identite: {
    prenom: 'Marie',
    nom: 'Dupont',
    email: 'marie.dupont@example.com',
  },
  experiences: [
    {
      index: 0,
      titre: 'Développeur Full Stack',
      employeur: 'TechCorp',
      date_debut: '2020-01',
      date_fin: '2024-12',
      missions: [
        'Développement applications React/Node.js',
        'Architecture microservices',
      ],
    },
    {
      index: 1,
      titre: 'Développeur Frontend',
      employeur: 'StartupXYZ',
      date_debut: '2018-06',
      date_fin: '2019-12',
      missions: ['Développement React'],
    },
  ],
  formations: [
    {
      index: 0,
      intitule: 'Master Informatique',
      etablissement: 'Université Paris-Saclay',
      annee: '2018',
    },
  ],
  competences: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Docker'],
  langues: [{ langue: 'Français', niveau: 'Natif' }],
};

const lowConfidenceCV: CV_JSON = {
  identite: {
    prenom: 'INFORMATION_MANQUANTE',
    nom: 'Dubois',
  },
  experiences: [
    {
      index: 0,
      titre: 'INFORMATION_MANQUANTE',
      date_debut: '2020',
      date_fin: 'INFORMATION_MANQUANTE',
    },
  ],
  formations: [],
  competences: ['React'],
  langues: [],
};

const mediumConfidenceCV: CV_JSON = {
  identite: {
    prenom: 'Jean',
    nom: 'Martin',
    // email manquant
  },
  experiences: [
    {
      index: 0,
      titre: 'Développeur',
      employeur: 'INFORMATION_MANQUANTE', // Employeur manquant
      date_debut: '2020-01',
      date_fin: null,
      missions: ['Dev'], // Mission trop courte
    },
    {
      index: 1,
      titre: 'INFORMATION_MANQUANTE', // Titre manquant
      date_debut: '2018-01',
      date_fin: '2019-12',
    },
  ],
  formations: [
    {
      index: 0,
      intitule: 'Licence Info',
      etablissement: 'INFORMATION_MANQUANTE',
      annee: 'INFORMATION_MANQUANTE', // Année manquante
    },
  ],
  competences: ['JavaScript', 'HTML'], // Peu de compétences
};

// ============================================================================
// TESTS - Extraction Confidence Scoring
// ============================================================================

describe('Cost Optimizer - Extraction Confidence', () => {
  describe('scoreExtractionConfidence', () => {
    it('should score high confidence CV (80-100%)', () => {
      const score = scoreExtractionConfidence(highConfidenceCV);

      expect(score.overall_confidence).toBeGreaterThanOrEqual(80);
      expect(score.identity_confidence).toBeGreaterThan(70);
      expect(score.experiences_confidence).toBeGreaterThan(70);
      expect(score.formations_confidence).toBeGreaterThan(70);
      expect(score.competences_confidence).toBeGreaterThan(70);
      expect(score.missing_fields).toHaveLength(0);
      expect(score.issues).toHaveLength(0);
    });

    it('should score low confidence CV (< 50%)', () => {
      const score = scoreExtractionConfidence(lowConfidenceCV);

      expect(score.overall_confidence).toBeLessThan(50);
      expect(score.missing_fields.length).toBeGreaterThan(0);
      expect(score.issues.length).toBeGreaterThan(0);
    });

    it('should score medium confidence CV (50-80%)', () => {
      const score = scoreExtractionConfidence(mediumConfidenceCV);

      expect(score.overall_confidence).toBeGreaterThanOrEqual(50);
      expect(score.overall_confidence).toBeLessThan(80);
    });

    it('should detect missing identity fields', () => {
      const cvMissingIdentity: CV_JSON = {
        identite: {
          prenom: 'INFORMATION_MANQUANTE',
          nom: 'INFORMATION_MANQUANTE',
        },
        experiences: [],
        formations: [],
        competences: [],
      };

      const score = scoreExtractionConfidence(cvMissingIdentity);

      expect(score.identity_confidence).toBeLessThan(50);
      expect(score.missing_fields).toContain('identite.prenom');
      expect(score.missing_fields).toContain('identite.nom');
    });

    it('should detect invalid dates', () => {
      const cvInvalidDates: CV_JSON = {
        identite: {
          prenom: 'Test',
          nom: 'User',
        },
        experiences: [
          {
            index: 0,
            titre: 'Dev',
            date_debut: 'invalid-date',
            date_fin: null,
          },
        ],
        formations: [],
        competences: ['React'],
      };

      const score = scoreExtractionConfidence(cvInvalidDates);

      expect(score.issues.some((i) => i.includes('invalide'))).toBe(true);
    });
  });
});

// ============================================================================
// TESTS - Mode Optimization
// ============================================================================

describe('Cost Optimizer - Mode Optimization', () => {
  describe('optimizeAnalysisMode', () => {
    it('should upgrade eco to balanced for low confidence', () => {
      const decision = optimizeAnalysisMode(lowConfidenceCV, 'eco', {
        upgrade_eco_threshold: 70,
      });

      expect(decision.original_mode).toBe('eco');
      expect(decision.recommended_mode).toBe('balanced');
      expect(decision.adjusted).toBe(true);
      expect(decision.reason).toContain('Upgrade eco→balanced');
    });

    it('should keep eco for high confidence', () => {
      const decision = optimizeAnalysisMode(highConfidenceCV, 'eco', {
        upgrade_eco_threshold: 70,
      });

      expect(decision.original_mode).toBe('eco');
      expect(decision.recommended_mode).toBe('eco');
      expect(decision.adjusted).toBe(false);
      expect(decision.reason).toContain('suffisante');
    });

    it('should downgrade premium to balanced for high confidence', () => {
      const decision = optimizeAnalysisMode(highConfidenceCV, 'premium', {
        downgrade_premium_threshold: 85,
      });

      expect(decision.original_mode).toBe('premium');
      expect(decision.recommended_mode).toBe('balanced');
      expect(decision.adjusted).toBe(true);
      expect(decision.reason).toContain('Downgrade premium→balanced');
    });

    it('should keep premium for low/medium confidence', () => {
      const decision = optimizeAnalysisMode(mediumConfidenceCV, 'premium', {
        downgrade_premium_threshold: 95,
      });

      expect(decision.original_mode).toBe('premium');
      expect(decision.recommended_mode).toBe('premium');
      expect(decision.adjusted).toBe(false);
    });

    it('should always keep balanced mode', () => {
      const decisionLow = optimizeAnalysisMode(lowConfidenceCV, 'balanced');
      expect(decisionLow.recommended_mode).toBe('balanced');
      expect(decisionLow.adjusted).toBe(false);

      const decisionHigh = optimizeAnalysisMode(highConfidenceCV, 'balanced');
      expect(decisionHigh.recommended_mode).toBe('balanced');
      expect(decisionHigh.adjusted).toBe(false);
    });

    it('should respect auto-adjustment disabled', () => {
      const decision = optimizeAnalysisMode(lowConfidenceCV, 'eco', {
        enable_auto_adjustment: false,
      });

      expect(decision.recommended_mode).toBe('eco');
      expect(decision.adjusted).toBe(false);
      expect(decision.reason).toContain('désactivé');
    });
  });

  describe('recommendMode', () => {
    it('should recommend eco for high confidence (>= 80%)', () => {
      const mode = recommendMode(highConfidenceCV);
      expect(mode).toBe('eco');
    });

    it('should recommend balanced for medium confidence (60-80%)', () => {
      const mode = recommendMode(mediumConfidenceCV);
      expect(mode).toBe('balanced');
    });

    it('should recommend premium for low confidence (< 60%)', () => {
      const mode = recommendMode(lowConfidenceCV);
      expect(mode).toBe('premium');
    });
  });
});

// ============================================================================
// TESTS - Cost Metrics
// ============================================================================

describe('Cost Optimizer - Cost Metrics', () => {
  describe('calculateCostMetrics', () => {
    it('should calculate savings for downgrade premium→balanced', () => {
      const decision = optimizeAnalysisMode(highConfidenceCV, 'premium', {
        downgrade_premium_threshold: 85,
      });
      const metrics = calculateCostMetrics(decision);

      expect(metrics.mode_original).toBe('premium');
      expect(metrics.mode_adjusted).toBe('balanced');
      expect(metrics.estimated_cost_original_usd).toBe(0.025);
      expect(metrics.estimated_cost_adjusted_usd).toBe(0.013);
      expect(metrics.savings_usd).toBeGreaterThan(0);
      expect(metrics.savings_percentage).toBeGreaterThan(0);
    });

    it('should calculate cost increase for upgrade eco→balanced', () => {
      const decision = optimizeAnalysisMode(lowConfidenceCV, 'eco', {
        upgrade_eco_threshold: 70,
      });
      const metrics = calculateCostMetrics(decision);

      expect(metrics.mode_original).toBe('eco');
      expect(metrics.mode_adjusted).toBe('balanced');
      expect(metrics.estimated_cost_original_usd).toBe(0.005);
      expect(metrics.estimated_cost_adjusted_usd).toBe(0.013);
      expect(metrics.savings_usd).toBeLessThan(0); // Negative = cost increase
    });

    it('should show zero savings when no adjustment', () => {
      const decision = optimizeAnalysisMode(mediumConfidenceCV, 'balanced');
      const metrics = calculateCostMetrics(decision);

      expect(metrics.savings_usd).toBe(0);
      expect(metrics.savings_percentage).toBe(0);
    });
  });
});

// ============================================================================
// TESTS - Integration Scenarios
// ============================================================================

describe('Cost Optimizer - Integration', () => {
  it('should provide complete decision with confidence score', () => {
    const decision = optimizeAnalysisMode(highConfidenceCV, 'eco');

    expect(decision).toHaveProperty('original_mode');
    expect(decision).toHaveProperty('recommended_mode');
    expect(decision).toHaveProperty('adjusted');
    expect(decision).toHaveProperty('reason');
    expect(decision).toHaveProperty('confidence_score');

    expect(decision.confidence_score).toHaveProperty('overall_confidence');
    expect(decision.confidence_score).toHaveProperty('identity_confidence');
    expect(decision.confidence_score).toHaveProperty('experiences_confidence');
    expect(decision.confidence_score).toHaveProperty('formations_confidence');
    expect(decision.confidence_score).toHaveProperty('competences_confidence');
    expect(decision.confidence_score).toHaveProperty('missing_fields');
    expect(decision.confidence_score).toHaveProperty('issues');
  });

  it('should optimize cost while maintaining quality', () => {
    // High quality CV → Can use eco
    const ecoDecision = optimizeAnalysisMode(highConfidenceCV, 'premium');
    expect(ecoDecision.recommended_mode).toBe('balanced'); // Downgrade

    // Low quality CV → Need balanced
    const balancedDecision = optimizeAnalysisMode(lowConfidenceCV, 'eco');
    expect(balancedDecision.recommended_mode).toBe('balanced'); // Upgrade
  });
});
