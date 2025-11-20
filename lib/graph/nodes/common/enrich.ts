/**
 * Common Enrichment Nodes
 * Reusable nodes for AI-powered data enrichment
 */

import type { NodeFunction } from '../../core/types';
import OpenAI from 'openai';
import { getSecret } from '@/lib/secrets/1password';
import { ingestDocument as ingestRAG } from '@/lib/rag';

/**
 * Enrich extraction with GPT
 */
export const enrichWithGPT: NodeFunction<
  {
    extractionResult: any;
    prompt?: string;
    model?: string;
    temperature?: number;
  },
  { enrichedData: any; gptResponse: string; cost: number }
> = async (state, input) => {
  try {
    const { extractionResult, model = 'gpt-4o-mini', temperature = 0.3 } = input;

    const apiKey = process.env.OPENAI_API_KEY || await getSecret('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('No OpenAI API key found');
    }

    const openai = new OpenAI({ apiKey });

    const defaultPrompt = `Analyze this extracted document data and enrich it with:
1. Standardized field names
2. Missing information inference
3. Data quality improvements
4. Calculated fields

Extraction data:
${JSON.stringify(extractionResult, null, 2)}

Return a JSON object with enriched data.`;

    const prompt = input.prompt || defaultPrompt;

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a data enrichment assistant. Extract and structure information from documents.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT');
    }

    let enrichedData: any;
    try {
      enrichedData = JSON.parse(content);
    } catch {
      enrichedData = { rawResponse: content };
    }

    const cost = (response.usage?.total_tokens || 0) * 0.000002; // Approximate cost

    return {
      success: true,
      data: {
        enrichedData,
        gptResponse: content,
        cost,
      },
      stateUpdates: {
        enrichedData,
        gptEnrichment: enrichedData,
      },
      metadataUpdates: {
        gptEnrichmentCost: cost,
        gptEnrichmentTokens: response.usage?.total_tokens || 0,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'GPT enrichment failed',
    };
  }
};

/**
 * Generate embeddings and store in RAG
 */
export const generateRAGEmbeddings: NodeFunction<
  {
    text: string;
    orgId: string;
    sourceId: string;
    contentType: string;
    sourceTable: string;
    sourceMetadata?: Record<string, any>;
  },
  { success: boolean; chunksCreated: number; cost: number }
> = async (state, input) => {
  try {
    const { text, orgId, sourceId, contentType, sourceTable, sourceMetadata } = input;

    if (!text || text.trim().length === 0) {
      return {
        success: true,
        data: { success: false, chunksCreated: 0, cost: 0 },
        stateUpdates: {
          ragSkipped: true,
          ragReason: 'No text to process',
        },
      };
    }

    const ragResult = await ingestRAG(text, {
      org_id: orgId,
      source_id: sourceId,
      content_type: contentType,
      source_table: sourceTable,
      source_metadata: sourceMetadata || {},
    });

    if (!ragResult.success) {
      throw new Error(ragResult.error || 'RAG ingestion failed');
    }

    return {
      success: true,
      data: {
        success: true,
        chunksCreated: ragResult.chunks_created || 0,
        cost: ragResult.cost || 0,
      },
      stateUpdates: {
        ragResult,
        ragChunksCreated: ragResult.chunks_created,
      },
      metadataUpdates: {
        ragCost: ragResult.cost || 0,
      },
    };
  } catch (error) {
    // Non-blocking - continue even if RAG fails
    return {
      success: true,
      data: { success: false, chunksCreated: 0, cost: 0 },
      stateUpdates: {
        ragError: error instanceof Error ? error.message : 'RAG failed',
      },
    };
  }
};

/**
 * Classify text with GPT
 */
export const classifyWithGPT: NodeFunction<
  {
    text: string;
    categories: string[];
    model?: string;
  },
  { category: string; confidence: number; reasoning?: string }
> = async (state, input) => {
  try {
    const { text, categories, model = 'gpt-4o-mini' } = input;

    const apiKey = process.env.OPENAI_API_KEY || await getSecret('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('No OpenAI API key found');
    }

    const openai = new OpenAI({ apiKey });

    const prompt = `Classify the following text into one of these categories: ${categories.join(', ')}

Text:
${text}

Return a JSON object with:
- category: the chosen category
- confidence: confidence score 0-1
- reasoning: brief explanation`;

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a text classification assistant.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT');
    }

    const classification = JSON.parse(content);

    return {
      success: true,
      data: classification,
      stateUpdates: {
        gptClassification: classification,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'GPT classification failed',
    };
  }
};

/**
 * Extract entities with GPT
 */
export const extractEntities: NodeFunction<
  {
    text: string;
    entityTypes: string[];
    model?: string;
  },
  { entities: Array<{ type: string; value: string; confidence: number }> }
> = async (state, input) => {
  try {
    const { text, entityTypes, model = 'gpt-4o-mini' } = input;

    const apiKey = process.env.OPENAI_API_KEY || await getSecret('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('No OpenAI API key found');
    }

    const openai = new OpenAI({ apiKey });

    const prompt = `Extract the following entities from the text: ${entityTypes.join(', ')}

Text:
${text}

Return a JSON object with an "entities" array containing objects with:
- type: entity type
- value: extracted value
- confidence: confidence score 0-1`;

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are an entity extraction assistant.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT');
    }

    const extracted = JSON.parse(content);

    return {
      success: true,
      data: extracted,
      stateUpdates: {
        extractedEntities: extracted.entities || [],
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Entity extraction failed',
    };
  }
};

/**
 * Translate text
 */
export const translateText: NodeFunction<
  {
    text: string;
    targetLanguage: string;
    sourceLanguage?: string;
    model?: string;
  },
  { translatedText: string; detectedLanguage?: string }
> = async (state, input) => {
  try {
    const { text, targetLanguage, sourceLanguage, model = 'gpt-4o-mini' } = input;

    const apiKey = process.env.OPENAI_API_KEY || await getSecret('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('No OpenAI API key found');
    }

    const openai = new OpenAI({ apiKey });

    const prompt = sourceLanguage
      ? `Translate the following text from ${sourceLanguage} to ${targetLanguage}:\n\n${text}`
      : `Translate the following text to ${targetLanguage}:\n\n${text}`;

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a professional translator. Return only the translated text.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT');
    }

    return {
      success: true,
      data: {
        translatedText: content,
      },
      stateUpdates: {
        translatedText: content,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Translation failed',
    };
  }
};

/**
 * Summarize text
 */
export const summarizeText: NodeFunction<
  {
    text: string;
    maxLength?: number;
    style?: 'brief' | 'detailed' | 'bullet-points';
    model?: string;
  },
  { summary: string; originalLength: number; summaryLength: number }
> = async (state, input) => {
  try {
    const { text, maxLength = 500, style = 'brief', model = 'gpt-4o-mini' } = input;

    const apiKey = process.env.OPENAI_API_KEY || await getSecret('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('No OpenAI API key found');
    }

    const openai = new OpenAI({ apiKey });

    const stylePrompts = {
      brief: 'Provide a brief summary in 2-3 sentences.',
      detailed: 'Provide a detailed summary covering all key points.',
      'bullet-points': 'Provide a summary as bullet points highlighting the main ideas.',
    };

    const prompt = `${stylePrompts[style]} Maximum length: ${maxLength} characters.

Text:
${text}`;

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a text summarization assistant.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.5,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT');
    }

    return {
      success: true,
      data: {
        summary: content,
        originalLength: text.length,
        summaryLength: content.length,
      },
      stateUpdates: {
        summary: content,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Summarization failed',
    };
  }
};
