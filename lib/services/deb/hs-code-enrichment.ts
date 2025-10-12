/**
 * DEB HS Code Enrichment Service
 *
 * Two-tier enrichment strategy:
 * 1. Priority A: Search internal reference database (auto-learning)
 * 2. Priority B: OpenAI-based suggestion with reasoning
 */

import { openai } from '@/lib/openai/client';
import { supabaseAdmin } from '@/lib/supabase/server';

export interface LineItem {
  lineId: string;
  description: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  valueHT: number;
}

export interface HSCodeSuggestion {
  lineId: string;
  description: string;
  hsCode: string;      // 8-digit HS code
  weightKg: number | null;
  confidence: number;  // 0.0 - 1.0
  source: 'reference_db' | 'openai' | 'azure_extracted';
  reasoning?: string;  // OpenAI reasoning (if applicable)
}

export interface EnrichmentRequest {
  orgId: string;
  documentId: string;
  lineItems: LineItem[];
}

export interface EnrichmentResult {
  documentId: string;
  suggestions: HSCodeSuggestion[];
  referenceHitRate: number; // % of lines found in reference DB
  summary: {
    totalLines: number;
    fromReferenceDB: number;
    fromOpenAI: number;
    failed: number;
  };
}

/**
 * Main enrichment function
 * Processes all line items and returns HS code + weight suggestions
 */
export async function enrichHSCodes(
  request: EnrichmentRequest
): Promise<EnrichmentResult> {
  const suggestions: HSCodeSuggestion[] = [];
  let fromReferenceDB = 0;
  let fromOpenAI = 0;
  let failed = 0;

  console.log(`🔍 Starting HS code enrichment for ${request.lineItems.length} lines...`);

  for (const lineItem of request.lineItems) {
    try {
      // Priority A: Search reference database
      const referenceMatch = await searchReferenceDatabase(
        request.orgId,
        lineItem.description
      );

      if (referenceMatch) {
        console.log(`✅ Reference DB hit: ${lineItem.description} → ${referenceMatch.hsCode}`);
        suggestions.push({
          lineId: lineItem.lineId,
          description: lineItem.description,
          hsCode: referenceMatch.hsCode,
          weightKg: referenceMatch.weightKg,
          confidence: referenceMatch.confidence,
          source: 'reference_db'
        });
        fromReferenceDB++;
        continue;
      }

      // Priority B: OpenAI suggestion
      console.log(`🤖 OpenAI lookup: ${lineItem.description}`);
      const aiSuggestion = await getOpenAISuggestion(lineItem);

      if (aiSuggestion) {
        suggestions.push({
          lineId: lineItem.lineId,
          description: lineItem.description,
          hsCode: aiSuggestion.hsCode,
          weightKg: aiSuggestion.weightKg,
          confidence: aiSuggestion.confidence,
          source: 'openai',
          reasoning: aiSuggestion.reasoning
        });
        fromOpenAI++;
      } else {
        failed++;
        console.warn(`❌ Failed to get HS code for: ${lineItem.description}`);
      }
    } catch (error) {
      console.error(`Error enriching line ${lineItem.lineId}:`, error);
      failed++;
    }
  }

  // Store suggestions in database
  await storeSuggestions(request.documentId, suggestions);

  const referenceHitRate = request.lineItems.length > 0
    ? (fromReferenceDB / request.lineItems.length) * 100
    : 0;

  console.log(`📊 Enrichment complete: ${fromReferenceDB} from DB, ${fromOpenAI} from AI, ${failed} failed`);

  return {
    documentId: request.documentId,
    suggestions,
    referenceHitRate,
    summary: {
      totalLines: request.lineItems.length,
      fromReferenceDB,
      fromOpenAI,
      failed
    }
  };
}

/**
 * Search reference database for matching article
 */
async function searchReferenceDatabase(
  orgId: string,
  description: string
): Promise<{
  hsCode: string;
  weightKg: number;
  confidence: number;
} | null> {
  try {
    const normalized = description.toLowerCase().trim();

    const { data, error } = await supabaseAdmin
      .rpc('search_article_reference', {
        p_org_id: orgId,
        p_description: description
      });

    if (error) {
      console.error('Error searching reference DB:', error);
      return null;
    }

    if (data && data.length > 0) {
      const match = data[0];
      return {
        hsCode: match.hs_code,
        weightKg: match.weight_net_kg,
        confidence: match.confidence_score
      };
    }

    return null;
  } catch (error) {
    console.error('Reference DB search error:', error);
    return null;
  }
}

/**
 * Get HS code suggestion from OpenAI
 */
async function getOpenAISuggestion(
  lineItem: LineItem
): Promise<{
  hsCode: string;
  weightKg: number;
  confidence: number;
  reasoning: string;
} | null> {
  try {
    const prompt = `You are a customs classification expert specializing in HS codes (Harmonized System).

Analyze the following product and provide:
1. The most appropriate 8-digit HS/NC code
2. Estimated net weight per unit in kilograms
3. Brief reasoning for the classification

Product Information:
- Description: ${lineItem.description}
${lineItem.sku ? `- SKU: ${lineItem.sku}` : ''}
- Quantity: ${lineItem.quantity}
- Unit Price: ${lineItem.unitPrice.toFixed(2)} EUR

Return ONLY a JSON object with this exact structure (no markdown, no code blocks):
{
  "hs_code": "XXXXXXXX",
  "weight_kg_estimated": 0.0,
  "reasoning": "Brief explanation of classification"
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a customs classification expert. Always return valid JSON only, without markdown formatting or code blocks.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 500
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Clean up response (remove markdown if present)
    const cleanedContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleanedContent);

    // Validate HS code format
    if (!validateHSCodeFormat(parsed.hs_code)) {
      console.error(`Invalid HS code format: ${parsed.hs_code}`);
      return null;
    }

    return {
      hsCode: parsed.hs_code,
      weightKg: parsed.weight_kg_estimated || 0,
      confidence: 0.70, // Default confidence for AI suggestions
      reasoning: parsed.reasoning || 'AI-based classification'
    };
  } catch (error) {
    console.error('OpenAI suggestion error:', error);
    return null;
  }
}

/**
 * Store enrichment suggestions in database
 */
async function storeSuggestions(
  documentId: string,
  suggestions: HSCodeSuggestion[]
): Promise<void> {
  try {
    // Get all fields for this document
    const { data: fields, error: fieldsError } = await supabaseAdmin
      .from('idp_extracted_fields')
      .select('id, value_text')
      .eq('document_id', documentId)
      .eq('field_category', 'line_item');

    if (fieldsError) {
      console.error('Error fetching document fields:', fieldsError);
      return;
    }

    // Match suggestions to field IDs
    for (const suggestion of suggestions) {
      // Find matching field by description
      const field = fields?.find(f =>
        f.value_text?.toLowerCase().includes(suggestion.description.toLowerCase())
      );

      if (!field) {
        console.warn(`No matching field found for: ${suggestion.description}`);
        continue;
      }

      // Update field with HS code suggestion
      await supabaseAdmin
        .from('idp_extracted_fields')
        .update({
          hs_code_suggested: suggestion.hsCode,
          hs_code_confidence: suggestion.confidence,
          hs_code_source: suggestion.source,
          weight_kg_suggested: suggestion.weightKg,
          weight_source: suggestion.source === 'reference_db' ? 'reference_db' : 'openai_estimated',
          metadata: {
            ...field,
            reasoning: suggestion.reasoning,
            enriched_at: new Date().toISOString()
          }
        })
        .eq('id', field.id);
    }

    console.log(`✅ Stored ${suggestions.length} enrichment suggestions`);
  } catch (error) {
    console.error('Error storing suggestions:', error);
  }
}

/**
 * Validate HS code format (8 digits)
 */
export function validateHSCodeFormat(code: string): boolean {
  if (!code) return false;
  const cleaned = code.replace(/[.\s-]/g, ''); // Remove separators
  return /^\d{8}$/.test(cleaned);
}

/**
 * Format HS code for display (XXXX.XX.XX)
 */
export function formatHSCode(code: string): string {
  const digits = code.replace(/\D/g, '');
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`;
  }
  return code;
}

/**
 * Get enrichment suggestions for a document
 */
export async function getEnrichmentSuggestions(
  documentId: string
): Promise<HSCodeSuggestion[]> {
  try {
    const { data: fields, error } = await supabaseAdmin
      .from('idp_extracted_fields')
      .select('*')
      .eq('document_id', documentId)
      .eq('field_category', 'line_item')
      .not('hs_code_suggested', 'is', null);

    if (error) {
      console.error('Error fetching enrichment suggestions:', error);
      return [];
    }

    return (fields || []).map(field => ({
      lineId: field.id,
      description: field.value_text || '',
      hsCode: field.hs_code_suggested!,
      weightKg: field.weight_kg_suggested,
      confidence: field.hs_code_confidence || 0.7,
      source: field.hs_code_source as 'reference_db' | 'openai' | 'azure_extracted',
      reasoning: field.metadata?.reasoning
    }));
  } catch (error) {
    console.error('Error getting enrichment suggestions:', error);
    return [];
  }
}

/**
 * Batch enrichment for multiple documents
 */
export async function batchEnrichHSCodes(
  orgId: string,
  documentIds: string[]
): Promise<Map<string, EnrichmentResult>> {
  const results = new Map<string, EnrichmentResult>();

  for (const documentId of documentIds) {
    // Fetch line items for document
    const { data: fields } = await supabaseAdmin
      .from('idp_extracted_fields')
      .select('*')
      .eq('document_id', documentId)
      .eq('field_category', 'line_item');

    if (!fields || fields.length === 0) {
      continue;
    }

    const lineItems: LineItem[] = fields.map(field => ({
      lineId: field.id,
      description: field.value_text || '',
      sku: field.metadata?.sku,
      quantity: field.value_number || 1,
      unitPrice: field.metadata?.unit_price || 0,
      valueHT: field.metadata?.line_amount || 0
    }));

    const result = await enrichHSCodes({
      orgId,
      documentId,
      lineItems
    });

    results.set(documentId, result);
  }

  return results;
}
