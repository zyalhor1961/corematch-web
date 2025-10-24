/**
 * JobSpec Generator - Génère un JobSpec à partir des données d'un projet
 */

import type { JobSpec } from '../types';
import { detectDomain } from '../config/thresholds';

interface ProjectInfo {
  job_title: string;
  description?: string;
  requirements?: string;
  job_spec_config?: JobSpec | null;
}

/**
 * Génère un JobSpec à partir des informations d'un projet
 *
 * Si le projet a déjà un job_spec_config configuré, l'utilise.
 * Sinon, génère un JobSpec basique à partir du titre/description/requirements.
 */
export function generateJobSpec(project: ProjectInfo): JobSpec {
  // Si un job_spec_config existe déjà, l'utiliser
  if (project.job_spec_config) {
    return project.job_spec_config;
  }

  // Sinon, générer un JobSpec basique
  const title = project.job_title || 'Poste non spécifié';
  const domain = detectDomain(title);

  // Générer must_have basiques depuis les requirements
  const must_have: JobSpec['must_have'] = [];

  if (project.requirements) {
    // Essayer de détecter des requirements structurés
    const reqLines = project.requirements.split('\n').filter(line => line.trim());

    reqLines.slice(0, 5).forEach((req, index) => {
      const cleaned = req.replace(/^[-*•]\s*/, '').trim();
      if (cleaned.length > 10) {
        must_have.push({
          id: `M${index + 1}`,
          desc: cleaned,
          severity: index === 0 ? 'critical' : 'standard',
        });
      }
    });
  }

  // Si aucun must_have, en créer un générique
  if (must_have.length === 0) {
    must_have.push({
      id: 'M1',
      desc: `Expérience pertinente pour le poste de ${title}`,
      severity: 'standard',
    });
  }

  // Skills basiques (vide si non spécifié)
  const skills_required: string[] = [];
  const nice_to_have: string[] = [];

  // Règles de relevance par défaut selon le domaine
  let relevance_rules: JobSpec['relevance_rules'];

  switch (domain) {
    case 'tech':
      relevance_rules = {
        direct: ['développeur', 'dev', 'software', 'ingénieur logiciel', 'programmer'],
        adjacent: ['analyste', 'tech lead', 'architecte', 'devops'],
        peripheral: ['IT', 'informatique', 'support technique'],
      };
      break;
    case 'enseignement':
      relevance_rules = {
        direct: ['professeur', 'enseignant', 'formateur', 'instructeur'],
        adjacent: ['tuteur', 'éducateur', 'animateur pédagogique'],
        peripheral: ['assistant pédagogique', 'surveillant'],
      };
      break;
    case 'btp':
      relevance_rules = {
        direct: ['peintre', 'maçon', 'électricien', 'plombier', 'charpentier'],
        adjacent: ['chef de chantier', 'conducteur de travaux'],
        peripheral: ['ouvrier', 'manœuvre'],
      };
      break;
    case 'management':
      relevance_rules = {
        direct: ['manager', 'directeur', 'chef', 'responsable'],
        adjacent: ['coordinateur', 'superviseur', 'team lead'],
        peripheral: ['assistant', 'adjoint'],
      };
      break;
    case 'sante':
      relevance_rules = {
        direct: ['infirmier', 'médecin', 'aide-soignant', 'kinésithérapeute'],
        adjacent: ['assistant médical', 'préparateur', 'auxiliaire'],
        peripheral: ['secrétaire médical', 'agent hospitalier'],
      };
      break;
    default:
      // Générique basé sur le titre du poste
      const titleWords = title.toLowerCase().split(/\s+/);
      relevance_rules = {
        direct: titleWords,
        adjacent: [...titleWords, 'assistant', 'junior', 'senior'],
        peripheral: ['expérience professionnelle', 'polyvalent'],
      };
  }

  // Poids par défaut (selon le domaine)
  const weights = {
    w_exp: domain === 'tech' ? 0.35 : 0.40,
    w_skills: domain === 'tech' ? 0.45 : 0.35,
    w_nice: 0.20,
    p_adjacent: 0.6,
  };

  // Seuils par défaut
  const thresholds = {
    years_full_score: domain === 'tech' ? 5 : 3,
    shortlist_min: 75,
    consider_min: 60,
  };

  return {
    title,
    must_have,
    skills_required,
    nice_to_have,
    relevance_rules,
    weights,
    thresholds,
  };
}

/**
 * Valide qu'un JobSpec est bien formé
 */
export function validateJobSpec(jobSpec: any): jobSpec is JobSpec {
  return (
    jobSpec &&
    typeof jobSpec.title === 'string' &&
    Array.isArray(jobSpec.must_have) &&
    Array.isArray(jobSpec.skills_required) &&
    jobSpec.relevance_rules &&
    jobSpec.weights &&
    jobSpec.thresholds
  );
}
