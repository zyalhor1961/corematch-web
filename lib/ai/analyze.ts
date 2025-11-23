/**
 * Module d'analyse IA générique
 * Utilisé par le moteur de réconciliation pour extraire des informations structurées
 */

import OpenAI from 'openai';

interface AnalyzeOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Analyse un prompt avec l'IA et retourne une réponse structurée
 */
export async function analyzeWithAI(
  prompt: string,
  options: AnalyzeOptions = {}
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const openai = new OpenAI({ apiKey });

  const response = await openai.chat.completions.create({
    model: options.model || 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'Tu es un assistant spécialisé dans l\'analyse de données financières et bancaires. Tu réponds toujours en JSON valide.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: options.temperature ?? 0.1,
    max_tokens: options.maxTokens || 500,
  });

  return response.choices[0]?.message?.content || '{}';
}

/**
 * Analyse un libellé bancaire pour extraire les informations structurées
 */
export async function analyzeBankLabel(label: string): Promise<{
  type: string;
  counterparty?: string;
  reference?: string;
  amount_hint?: number;
  confidence: number;
}> {
  const prompt = `Analyse ce libellé bancaire et extrais les informations structurées.
Libellé: "${label}"

Réponds en JSON avec:
- type: (virement, prélèvement, carte, chèque, frais, salaire, impôt, autre)
- counterparty: nom du tiers si identifiable
- reference: numéro de référence/facture si présent
- amount_hint: montant si mentionné dans le libellé
- confidence: score de confiance de 0 à 1

JSON:`;

  try {
    const response = await analyzeWithAI(prompt);
    const parsed = JSON.parse(response);
    return {
      type: parsed.type || 'autre',
      counterparty: parsed.counterparty,
      reference: parsed.reference,
      amount_hint: parsed.amount_hint,
      confidence: parsed.confidence || 0.5,
    };
  } catch {
    return {
      type: 'autre',
      confidence: 0,
    };
  }
}
