/**
 * Critical unit tests for CV analysis system
 */

import { describe, it, expect } from 'vitest';
import { monthsBetween, calculateUnionMonths } from '../src/utils/dates';
import { skillsMatch, calculateSkillsMatch, normalizeSkill } from '../src/utils/skills-normalizer';
import { aggregateResults } from '../src/analysis/aggregate';
import type { EvaluationOutput } from '../src/analysis/evaluator';

describe('Critical Tests', () => {
  describe('Date Calculations', () => {
    it('should handle overlapping periods correctly', () => {
      const periods = [
        { debut_iso: '2020-01', fin_iso: '2021-12', en_cours: false },
        { debut_iso: '2021-06', fin_iso: '2022-06', en_cours: false }  // 6 months overlap
      ];

      const totalMonths = calculateUnionMonths(periods);

      // Should be 30 months (2020-01 to 2022-06), not 36 (24 + 12)
      expect(totalMonths).toBe(30);
    });

    it('should handle en_cours correctly with analysis_date', () => {
      const start = '2023-01';
      const now = new Date().toISOString().split('T')[0].substring(0, 7); // Current YYYY-MM

      const months = monthsBetween(start, null, true);

      // Should calculate from start to now
      expect(months).toBeGreaterThan(12); // More than 1 year
    });

    it('should handle gaps between periods', () => {
      const periods = [
        { debut_iso: '2020-01', fin_iso: '2020-12', en_cours: false }, // 12 months
        { debut_iso: '2022-01', fin_iso: '2022-12', en_cours: false }  // 12 months, gap of 1 year
      ];

      const totalMonths = calculateUnionMonths(periods);

      // Should be 24 months (no overlap, 1 year gap not counted)
      expect(totalMonths).toBe(24);
    });
  });

  describe('Must-Have Rules', () => {
    it('should force REJECT when critical must-have fails', () => {
      const openaiResult: EvaluationOutput = {
        meets_all_must_have: false,
        fails: [
          {
            rule_id: 'M1',
            reason: 'Critère critique: moins de 5 ans d\'expérience',
            evidence: []
          }
        ],
        relevance_summary: {
          months_direct: 36,
          months_adjacent: 0,
          months_peripheral: 0,
          months_non_pertinent: 0,
          by_experience: []
        },
        subscores: {
          experience_years_relevant: 3.0,
          skills_match_0_to_100: 90,
          nice_to_have_0_to_100: 50
        },
        overall_score_0_to_100: 75,
        recommendation: 'SHORTLIST', // Would be SHORTLIST without critical fail
        strengths: [],
        improvements: []
      };

      const geminiResult: EvaluationOutput = {
        ...openaiResult,
        meets_all_must_have: false,
        fails: [
          {
            rule_id: 'M1',
            reason: 'Expérience insuffisante (critique)',
            evidence: []
          }
        ],
        recommendation: 'CONSIDER'
      };

      const result = aggregateResults(openaiResult, geminiResult);

      // Even if one model says SHORTLIST, critical fail should force REJECT
      expect(result.final_decision.recommendation).toBe('REJECT');
    });

    it('should NOT reject if non-critical must-have fails', () => {
      const openaiResult: EvaluationOutput = {
        meets_all_must_have: false,
        fails: [
          {
            rule_id: 'M2',
            reason: 'Nice-to-have: manque Docker',
            evidence: []
          }
        ],
        relevance_summary: {
          months_direct: 60,
          months_adjacent: 12,
          months_peripheral: 0,
          months_non_pertinent: 0,
          by_experience: []
        },
        subscores: {
          experience_years_relevant: 5.0,
          skills_match_0_to_100: 95,
          nice_to_have_0_to_100: 40
        },
        overall_score_0_to_100: 82,
        recommendation: 'SHORTLIST',
        strengths: [],
        improvements: []
      };

      const geminiResult: EvaluationOutput = {
        ...openaiResult,
        recommendation: 'SHORTLIST'
      };

      const result = aggregateResults(openaiResult, geminiResult);

      // Should remain SHORTLIST (high score, non-critical fail)
      expect(result.final_decision.recommendation).toBe('SHORTLIST');
    });
  });

  describe('Taxonomie ADJACENTE', () => {
    it('should add ADJACENTE experiences as strengths', () => {
      const openaiResult: EvaluationOutput = {
        meets_all_must_have: true,
        fails: [],
        relevance_summary: {
          months_direct: 36,
          months_adjacent: 24,
          months_peripheral: 0,
          months_non_pertinent: 0,
          by_experience: [
            {
              titre: 'Data Analyst',
              relevance: 'ADJACENTE',
              reason: 'Compétences en data transférables au poste de Data Scientist',
              evidence: [{ quote: 'Analyse de données avec Python', field_path: 'experiences[0]' }]
            }
          ]
        },
        subscores: {
          experience_years_relevant: 4.0,
          skills_match_0_to_100: 85,
          nice_to_have_0_to_100: 60
        },
        overall_score_0_to_100: 78,
        recommendation: 'SHORTLIST',
        strengths: [],
        improvements: []
      };

      const geminiResult: EvaluationOutput = { ...openaiResult };

      const result = aggregateResults(openaiResult, geminiResult);

      // Should have automatic strength for ADJACENTE experience
      const hasAdjacentStrength = result.final_decision.strengths.some(s =>
        s.point.includes('Expérience adjacente') || s.point.includes('Data Analyst')
      );

      expect(hasAdjacentStrength).toBe(true);
    });

    it('should filter out improvements about adjacent experiences', () => {
      const openaiResult: EvaluationOutput = {
        meets_all_must_have: true,
        fails: [],
        relevance_summary: {
          months_direct: 36,
          months_adjacent: 24,
          months_peripheral: 0,
          months_non_pertinent: 0,
          by_experience: [
            {
              titre: 'Chef de Projet IT',
              relevance: 'ADJACENTE',
              reason: 'Gestion de projet transférable',
              evidence: []
            }
          ]
        },
        subscores: {
          experience_years_relevant: 4.0,
          skills_match_0_to_100: 85,
          nice_to_have_0_to_100: 60
        },
        overall_score_0_to_100: 78,
        recommendation: 'SHORTLIST',
        strengths: [],
        improvements: [
          {
            point: 'Manque d\'expérience directe en développement',
            why: 'L\'expérience de Chef de Projet IT est adjacente mais pas directe',
            suggested_action: 'Acquérir une expérience en développement'
          }
        ]
      };

      const geminiResult: EvaluationOutput = { ...openaiResult };

      const result = aggregateResults(openaiResult, geminiResult);

      // Should NOT have improvements about adjacent experience
      const hasAdjacentImprovement = result.final_decision.improvements.some(imp =>
        imp.point.includes('Chef de Projet') || imp.why.includes('adjacent')
      );

      expect(hasAdjacentImprovement).toBe(false);
    });
  });

  describe('Skills Matching', () => {
    it('should match skills with lowercase and accents', () => {
      expect(skillsMatch('JavaScript', 'javascript')).toBe(true);
      expect(skillsMatch('Développement', 'developpement')).toBe(true);
      expect(skillsMatch('PostgreSQL', 'postgres')).toBe(true);
    });

    it('should match skills with aliases', () => {
      expect(skillsMatch('React', 'ReactJS')).toBe(true);
      expect(skillsMatch('Node.js', 'NodeJS')).toBe(true);
      expect(skillsMatch('Kubernetes', 'k8s')).toBe(true);
      expect(skillsMatch('TypeScript', 'TS')).toBe(true);
    });

    it('should calculate match percentage correctly', () => {
      const candidateSkills = ['JavaScript', 'React', 'Node.js', 'Python'];
      const requiredSkills = ['javascript', 'reactjs', 'typescript'];

      const result = calculateSkillsMatch(candidateSkills, requiredSkills);

      // Should match 2 out of 3 (JavaScript=javascript, React=reactjs)
      expect(result.percentage).toBe(67); // 2/3 = 66.67 rounded to 67
      expect(result.matched).toHaveLength(2);
      expect(result.missing).toContain('typescript');
    });
  });

  describe('Model Disagreements', () => {
    it('should track disagreements when models diverge', () => {
      const openaiResult: EvaluationOutput = {
        meets_all_must_have: true,
        fails: [],
        relevance_summary: {
          months_direct: 48,
          months_adjacent: 12,
          months_peripheral: 0,
          months_non_pertinent: 0,
          by_experience: []
        },
        subscores: {
          experience_years_relevant: 4.5,
          skills_match_0_to_100: 90,
          nice_to_have_0_to_100: 60
        },
        overall_score_0_to_100: 85,
        recommendation: 'SHORTLIST',
        strengths: [],
        improvements: []
      };

      const geminiResult: EvaluationOutput = {
        ...openaiResult,
        subscores: {
          ...openaiResult.subscores,
          skills_match_0_to_100: 70 // 20 points difference
        },
        overall_score_0_to_100: 72,
        recommendation: 'CONSIDER'
      };

      const result = aggregateResults(openaiResult, geminiResult);

      // Should have disagreements tracked
      expect(result.debug.model_disagreements.length).toBeGreaterThan(0);

      // Should have disagreement on skills_match (>10 points diff)
      const skillsDisagreement = result.debug.model_disagreements.find(
        d => d.field === 'subscores.skills_match_0_to_100'
      );
      expect(skillsDisagreement).toBeDefined();
    });
  });
});
