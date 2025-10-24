/**
 * Claude Provider - Implémentation concrète
 *
 * Utilise Anthropic Claude 3.5 Sonnet pour l'analyse de CV
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  CV_JSON,
  JobSpec,
  EvaluationResult,
  ProviderResult,
  ProviderName,
} from '../types';
import { BaseProvider, type BaseProviderConfig } from './base-provider';
import { calculateProviderCost } from '../config';
import { validateEvaluationResult } from '../validators';

/**
 * Claude Provider
 */
export class ClaudeProvider extends BaseProvider {
  private client: Anthropic;

  constructor(config: BaseProviderConfig) {
    super('claude', config);
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  /**
   * Analyser un CV avec Claude 3.5 Sonnet
   */
  async analyze(cvJson: CV_JSON, jobSpec: JobSpec): Promise<ProviderResult> {
    const startTime = Date.now();

    try {
      console.log(`[${this.name}] Starting analysis with model ${this.config.model}...`);

      // Construire les prompts
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(cvJson, jobSpec);

      // Appel API Claude
      const message = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      // Extraire le résultat
      const content = message.content[0];
      if (content.type !== 'text') {
        throw new Error('[Claude] Expected text response');
      }

      const messageContent = content.text;
      if (!messageContent) {
        throw new Error('[Claude] Empty response from API');
      }

      const result = JSON.parse(messageContent) as EvaluationResult;

      // Valider le résultat
      const validation = validateEvaluationResult(result);
      if (!validation.valid) {
        console.error(`[${this.name}] Validation failed:`, validation.errorMessage);
        throw new Error(`[${this.name}] Invalid output: ${validation.errorMessage}`);
      }

      // Calculer le coût
      const tokensInput = message.usage.input_tokens;
      const tokensOutput = message.usage.output_tokens;
      const cost = calculateProviderCost(this.name, this.config.model, tokensInput, tokensOutput);

      const executionTime = Date.now() - startTime;

      console.log(`[${this.name}] ✅ Analysis completed in ${executionTime}ms`);
      console.log(`[${this.name}] Tokens: ${tokensInput} input, ${tokensOutput} output`);
      console.log(`[${this.name}] Cost: $${cost.toFixed(4)}`);

      return {
        provider: this.name,
        model: this.config.model,
        result,
        execution_time_ms: executionTime,
        tokens_used: {
          input: tokensInput,
          output: tokensOutput,
        },
        cost_usd: cost,
      };
    } catch (error) {
      this.logError(error, 'analyze');

      const executionTime = Date.now() - startTime;

      return {
        provider: this.name,
        model: this.config.model,
        result: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        execution_time_ms: executionTime,
      };
    }
  }

  /**
   * Extraire un CV (Pass 1) avec claude-3-haiku (plus rapide et moins cher)
   */
  async extract(cvText: string): Promise<CV_JSON> {
    console.log(`[${this.name}] Extracting CV with claude-3-haiku...`);

    const systemPrompt = `Tu es un extracteur de CV expert. Ta mission est d'extraire TOUTES les informations d'un CV en JSON structuré.

**SCHÉMA JSON REQUIS (STRICTEMENT OBLIGATOIRE):**
{
  "identite": {
    "prenom": "string (requis)",
    "nom": "string (requis)",
    "email": "string (optionnel)",
    "telephone": "string (optionnel)",
    "adresse": "string (optionnel)",
    "linkedin": "string (optionnel)",
    "github": "string (optionnel)"
  },
  "experiences": [
    {
      "index": 0,
      "titre": "string (requis)",
      "employeur": "string (optionnel)",
      "date_debut": "YYYY-MM ou INFORMATION_MANQUANTE",
      "date_fin": "YYYY-MM ou 'en cours' ou null",
      "missions": ["liste de strings"],
      "lieu": "string (optionnel)",
      "type_contrat": "CDI|CDD|Freelance|Stage|Alternance|INFORMATION_MANQUANTE"
    }
  ],
  "formations": [
    {
      "index": 0,
      "intitule": "string (requis)",
      "etablissement": "string (optionnel)",
      "annee": "string",
      "lieu": "string (optionnel)",
      "niveau": "Bac|Bac+2|Bac+3|Bac+5|Doctorat|INFORMATION_MANQUANTE"
    }
  ],
  "competences": ["array de strings"],
  "langues": [
    {
      "langue": "string (requis)",
      "niveau": "Natif|Courant|Professionnel|Intermédiaire|Débutant|INFORMATION_MANQUANTE"
    }
  ],
  "certifications": [
    {
      "nom": "string (requis)",
      "organisme": "string (optionnel)",
      "date": "string (optionnel)"
    }
  ],
  "projets": [
    {
      "titre": "string (requis)",
      "description": "string (optionnel)",
      "technologies": ["array de strings"],
      "url": "string (optionnel)"
    }
  ]
}

**RÈGLES STRICTES:**
1. N'INVENTE RIEN - Si une info manque, utilise "INFORMATION_MANQUANTE" ou omets le champ optionnel
2. Respecte EXACTEMENT le schéma ci-dessus
3. Pour les dates: format "YYYY-MM" strictement (ex: "2021-01", "2023-12")
4. Indexe les expériences et formations à partir de 0 (index: 0, 1, 2, ...)
5. Si une date de fin est "actuel", "présent" ou "aujourd'hui", utilise "en cours"
6. "competences" DOIT être un array de strings, pas un objet
7. Extrais TOUTES les compétences techniques mentionnées
8. Les champs requis marqués "(requis)" sont OBLIGATOIRES

Réponds UNIQUEMENT avec le JSON structuré, sans markdown ni commentaire.`;

    const userPrompt = `Extrait toutes les informations de ce CV en JSON en respectant EXACTEMENT le schéma fourni:

${cvText}`;

    const message = await this.client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4096,
      temperature: 0,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('[Claude] Expected text response during extraction');
    }

    const messageContent = content.text;
    if (!messageContent) {
      throw new Error('[Claude] Empty response during extraction');
    }

    const extracted = JSON.parse(messageContent) as CV_JSON;
    extracted.texte_brut = cvText;

    console.log(`[${this.name}] ✅ CV extracted successfully`);

    return extracted;
  }

  /**
   * Arbitrer entre plusieurs résultats (Juge)
   */
  async arbitrate(
    providersResults: Record<ProviderName, EvaluationResult>,
    jobSpec: JobSpec
  ): Promise<EvaluationResult> {
    console.log(`[${this.name}] Starting arbitration...`);

    const systemPrompt = `Tu es l'arbitre d'un jury composé de plusieurs IA d'évaluation de candidatures.

**TA MISSION:**
Analyser les évaluations fournies par chaque modèle et produire un verdict final cohérent.

**RÈGLES D'ARBITRAGE:**
1. Si deux modèles s'accordent, privilégie leur décision
2. Si un modèle est extrême (score ±30 pts vs moyenne), signale-le et corrige
3. Si une compétence apparaît dans ≥2 modèles → validée
4. Si un must-have est rejeté par tous → échec critique maintenu
5. Toujours renvoyer un JSON final conforme au schéma

**PROCESSUS:**
1. Compare les scores et recommandations
2. Identifie les écarts significatifs (>15 pts)
3. Analyse les preuves (evidence) de chaque modèle
4. Justifie tes choix d'arbitrage
5. Produis une évaluation finale unifiée

Réponds UNIQUEMENT avec le JSON final, sans markdown.`;

    const userPrompt = `JOB_SPEC:
${JSON.stringify(jobSpec, null, 2)}

ÉVALUATIONS DES MODÈLES:
${JSON.stringify(providersResults, null, 2)}

Produis le verdict final en résolvant les désaccords.`;

    const message = await this.client.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: 0.1,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('[Claude] Expected text response during arbitration');
    }

    const messageContent = content.text;
    if (!messageContent) {
      throw new Error('[Claude] Empty response during arbitration');
    }

    const verdict = JSON.parse(messageContent) as EvaluationResult;

    console.log(`[${this.name}] ✅ Arbitration completed`);

    return verdict;
  }
}

/**
 * Factory pour créer une instance ClaudeProvider
 */
export function createClaudeProvider(): ClaudeProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('[Claude] ANTHROPIC_API_KEY environment variable is required');
  }

  return new ClaudeProvider({
    apiKey,
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0,
    maxTokens: 4096,
  });
}
