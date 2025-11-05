/**
 * GPT Post-Processing pour enrichir les métadonnées Azure DI
 *
 * Utilise GPT-4o pour :
 * - Extraire les champs manquants (emails, etc.)
 * - Corriger les erreurs de détection
 * - Redistribuer les informations dans les bons champs
 */

import OpenAI from 'openai';
import { getSecret } from '@/lib/secrets/1password';

interface GPTEnrichmentInput {
  azureFields: Record<string, any>;
  pdfText: string;
  fileName: string;
}

interface GPTEnrichmentResult {
  email_fournisseur?: string;
  email_client?: string;
  numero_commande?: string;
  conditions_paiement?: string;
  notes?: string;
}

export async function enrichWithGPT(input: GPTEnrichmentInput): Promise<GPTEnrichmentResult> {
  const startTime = Date.now();

  try {
    // Get OpenAI API key from environment or 1Password
    const apiKey = process.env.OPENAI_API_KEY || await getSecret('OPENAI_API_KEY');

    if (!apiKey) {
      console.warn('[GPT Enrichment] No OpenAI API key found, skipping enrichment');
      return {};
    }

    const openai = new OpenAI({ apiKey });

    // Build context from Azure fields
    const azureContext = Object.entries(input.azureFields)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join('\n');

    const prompt = `Tu es un expert en extraction de données de factures. Analyse le texte brut d'une facture PDF et les métadonnées déjà extraites par Azure Document Intelligence.

MÉTADONNÉES AZURE (déjà extraites) :
${azureContext}

TEXTE BRUT DU PDF :
${input.pdfText.substring(0, 4000)}

TÂCHE : Extraire les informations manquantes suivantes (si présentes dans le PDF) :

1. email_fournisseur : Email du fournisseur/vendeur
2. email_client : Email du client/acheteur
3. numero_commande : Numéro de commande ou purchase order
4. conditions_paiement : Conditions de paiement (ex: "Net 30", "Payable à réception", etc.)
5. notes : Toutes notes importantes ou commentaires

IMPORTANT :
- Retourne UNIQUEMENT les champs que tu trouves dans le PDF
- Si un champ est déjà bien rempli dans les métadonnées Azure, ne le retourne pas
- Si tu ne trouves pas un champ, ne l'inclus pas dans la réponse
- Sois précis : vérifie que les emails ont un format valide

Retourne UNIQUEMENT un objet JSON valide avec cette structure :
{
  "email_fournisseur": "vendor@example.com",
  "email_client": "customer@example.com",
  "numero_commande": "PO-12345",
  "conditions_paiement": "Net 30",
  "notes": "Toute note importante"
}`;

    console.log('[GPT Enrichment] Calling GPT-4o for metadata enrichment...');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert en extraction de données de factures. Tu retournes UNIQUEMENT du JSON valide, sans markdown ni formatage.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1, // Low temperature for consistent extraction
      max_tokens: 500,
      response_format: { type: 'json_object' } // Force JSON output
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn('[GPT Enrichment] No response from GPT');
      return {};
    }

    // Parse GPT response
    const enrichedData = JSON.parse(content) as GPTEnrichmentResult;

    const duration = Date.now() - startTime;
    console.log(`[GPT Enrichment] ✓ Enrichment completed in ${duration}ms`);
    console.log('[GPT Enrichment] Enriched fields:', Object.keys(enrichedData));
    console.log('[GPT Enrichment] Data:', enrichedData);

    return enrichedData;

  } catch (error) {
    console.error('[GPT Enrichment] Enrichment failed:', error);
    return {};
  }
}
