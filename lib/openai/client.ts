import OpenAI from 'openai';
import { CVAnalysisResult, PageClassificationResult, ExtractionResult } from '@/lib/types';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing env.OPENAI_API_KEY');
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeCV(
  cvText: string, 
  jobTitle?: string, 
  requirements?: string
): Promise<CVAnalysisResult> {
  const prompt = `
Analyze this CV and provide a score from 0-100 with explanation.

${jobTitle ? `Job Title: ${jobTitle}` : ''}
${requirements ? `Requirements: ${requirements}` : ''}

CV Content:
${cvText}

Return ONLY a JSON object with this structure:
{
  "score": number (0-100),
  "explanation": "detailed explanation of the score",
  "name": "extracted candidate name",
  "email": "extracted email if found",
  "phone": "extracted phone if found",
  "skills": ["extracted", "skills", "array"]
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a professional CV analyzer. Always return valid JSON only.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.3,
    max_tokens: 1000
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to parse OpenAI response: ${error}`);
  }
}

export async function classifyPages(
  ocrPages: Array<{ pageNumber: number; content: string }>
): Promise<PageClassificationResult> {
  const prompt = `
Analyze these OCR'd document pages and classify each page as 'invoice', 'delivery_note', or 'other'.
Then group related pages into document segments (invoice A + delivery_note A, invoice B + delivery_note B, etc.)

Pages:
${ocrPages.map(p => `Page ${p.pageNumber}:\n${p.content.substring(0, 1000)}`).join('\n\n')}

Return ONLY a JSON object with this structure:
{
  "pages": [
    {
      "pageNumber": 1,
      "type": "invoice",
      "confidence": 0.95
    }
  ],
  "segments": [
    {
      "type": "invoice",
      "pages": [1, 2],
      "identifier": "INV-001"
    }
  ]
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a document classification expert. Always return valid JSON only.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.1,
    max_tokens: 2000
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to parse OpenAI response: ${error}`);
  }
}

export async function extractInvoiceData(
  invoiceText: string,
  blText?: string,
  existingProducts?: Array<{ sku: string; default_hs_code?: string; default_net_mass_kg?: number }>
): Promise<ExtractionResult> {
  const productsContext = existingProducts 
    ? `\nExisting product database:\n${existingProducts.map(p => `${p.sku}: HS ${p.default_hs_code}, ${p.default_net_mass_kg}kg`).join('\n')}`
    : '';

  const prompt = `
Extract structured data from this invoice. Map weights from delivery note if provided.
Use existing product database for HS codes and weights when available.

Invoice:
${invoiceText}

${blText ? `\nDelivery Note:\n${blText}` : ''}

${productsContext}

Return ONLY a JSON object with this structure:
{
  "supplier_name": "Company Name",
  "supplier_vat": "VAT number",
  "supplier_country": "FR",
  "invoice_number": "INV-001",
  "invoice_date": "2024-01-15",
  "currency": "EUR",
  "incoterm": "DDP",
  "total_ht": 1000.00,
  "shipping_total": 50.00,
  "lines": [
    {
      "line_no": 1,
      "description": "Product description",
      "sku": "SKU-001",
      "qty": 10,
      "unit": "PCS",
      "unit_price": 15.50,
      "line_amount": 155.00,
      "hs_code": "8471609000",
      "country_of_origin": "CN",
      "net_mass_kg": 2.5,
      "pages_source": [1, 2]
    }
  ]
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are a document extraction expert specializing in invoices and customs data. Always return valid JSON only.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.1,
    max_tokens: 3000
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to parse OpenAI response: ${error}`);
  }
}