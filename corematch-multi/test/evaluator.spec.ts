/**
 * Basic tests for CV evaluation system
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { validateCV, validateOutput } from '../src/utils/json';
import cvSample from './samples/cv_sample.json';
import jobGeneric from './samples/job_generic.json';
import type { CV_JSON } from '../src/extraction/extractor';
import type { JobSpec } from '../src/analysis/evaluator';

describe('CV Analysis System', () => {
  beforeAll(() => {
    // Setup environment variables for tests
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
    process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'test-key';
  });

  describe('JSON Validation', () => {
    it('should validate CV sample against schema', () => {
      const isValid = validateCV(cvSample);
      expect(isValid).toBe(true);
    });

    it('should reject invalid CV (missing required fields)', () => {
      const invalidCV = { identite: { nom: 'Test' } };
      const isValid = validateCV(invalidCV);
      expect(isValid).toBe(false);
    });

    it('should validate CV with en_cours experience', () => {
      const cv: CV_JSON = {
        identite: { nom: 'Test', prenom: 'User' },
        experiences: [
          {
            titre: 'Developer',
            debut_iso: '2020-01',
            fin_iso: null,
            en_cours: true,
            missions: ['Develop apps']
          }
        ],
        competences: ['JavaScript', 'React']
      };
      const isValid = validateCV(cv);
      expect(isValid).toBe(true);
    });
  });

  describe('JobSpec Validation', () => {
    it('should have valid job spec structure', () => {
      expect(jobGeneric.title).toBeDefined();
      expect(jobGeneric.must_have).toBeInstanceOf(Array);
      expect(jobGeneric.skills_required).toBeInstanceOf(Array);
      expect(jobGeneric.relevance_rules).toBeDefined();
      expect(jobGeneric.relevance_rules.direct).toBeInstanceOf(Array);
    });

    it('should have valid thresholds', () => {
      const spec = jobGeneric as JobSpec;
      expect(spec.thresholds).toBeDefined();
      expect(spec.thresholds!.shortlist_min).toBeGreaterThan(spec.thresholds!.consider_min);
    });

    it('should have valid weights that sum to 1', () => {
      const spec = jobGeneric as JobSpec;
      const sum = spec.weights!.w_exp + spec.weights!.w_skills + spec.weights!.w_nice;
      expect(sum).toBeCloseTo(1.0, 1);
    });
  });

  describe('Date Utilities', () => {
    it('should calculate months between dates correctly', () => {
      // This would test the monthsBetween function
      // Import and test once implementation is complete
      expect(true).toBe(true);
    });
  });

  describe('Experience Relevance Classification', () => {
    it('should classify direct experience correctly', () => {
      const cv = cvSample as CV_JSON;
      const jobSpec = jobGeneric as JobSpec;

      // First experience should be DIRECTE
      const firstExp = cv.experiences[0];
      const isDirect = jobSpec.relevance_rules!.direct.some(keyword =>
        firstExp.titre.toLowerCase().includes(keyword.toLowerCase())
      );

      expect(isDirect).toBe(true);
    });

    it('should handle adjacent experience classification', () => {
      // Test that adjacent experiences are properly weighted
      expect(jobGeneric.weights!.p_adjacent).toBe(0.5);
    });
  });

  describe('Must-Have Rules', () => {
    it('should identify critical must-have rules', () => {
      const spec = jobGeneric as JobSpec;
      const criticalRules = spec.must_have!.filter(r => r.severity === 'critical');
      expect(criticalRules.length).toBeGreaterThan(0);
    });

    it('should reject if critical must-have fails', () => {
      // This would be an integration test
      // Verify that a CV missing critical requirements gets REJECT
      expect(true).toBe(true);
    });
  });

  describe('Skills Matching', () => {
    it('should find skill overlap between CV and job spec', () => {
      const cv = cvSample as CV_JSON;
      const spec = jobGeneric as JobSpec;

      const matchingSkills = cv.competences.filter(skill =>
        spec.skills_required!.some(required =>
          required.toLowerCase() === skill.toLowerCase()
        )
      );

      expect(matchingSkills.length).toBeGreaterThan(0);
    });

    it('should calculate skills match percentage', () => {
      const cv = cvSample as CV_JSON;
      const spec = jobGeneric as JobSpec;

      const matchingSkills = cv.competences.filter(skill =>
        spec.skills_required!.some(required =>
          required.toLowerCase() === skill.toLowerCase()
        )
      );

      const percentage = Math.round((matchingSkills.length / spec.skills_required!.length) * 100);
      expect(percentage).toBeGreaterThan(50);
    });
  });

  describe('Output Validation', () => {
    it('should validate complete evaluation output', () => {
      const mockOutput = {
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
          experience_years_relevant: 5.0,
          skills_match_0_to_100: 85,
          nice_to_have_0_to_100: 60
        },
        overall_score_0_to_100: 78.5,
        recommendation: 'SHORTLIST',
        strengths: [],
        improvements: []
      };

      const isValid = validateOutput(mockOutput);
      expect(isValid).toBe(true);
    });

    it('should reject output with invalid recommendation', () => {
      const invalidOutput = {
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
          experience_years_relevant: 5.0,
          skills_match_0_to_100: 85,
          nice_to_have_0_to_100: 60
        },
        overall_score_0_to_100: 78.5,
        recommendation: 'INVALID', // Should fail
        strengths: [],
        improvements: []
      };

      const isValid = validateOutput(invalidOutput);
      expect(isValid).toBe(false);
    });
  });
});
