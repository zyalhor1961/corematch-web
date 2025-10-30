import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

    const { documentId } = await params;

    // Get document details
    const { data: document, error: docError } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Get signed URL for the document
    const { data: signedUrlData, error: urlError } = await supabaseAdmin.storage
      .from('deb-docs')
      .createSignedUrl(document.file_url, 3600);

    if (urlError || !signedUrlData?.signedUrl) {
      return NextResponse.json(
        { error: 'Failed to get document URL' },
        { status: 500 }
      );
    }

    console.log('Starting AI analysis for document:', documentId);

    // Update status to processing
    await supabaseAdmin
      .from('documents')
      .update({ status: 'processing' })
      .eq('id', documentId);

    // Analyze document with OpenAI Vision API
    const analysisResult = await analyzeDocumentWithAI(signedUrlData.signedUrl, document.name);

    if (!analysisResult.success) {
      await supabaseAdmin
        .from('documents')
        .update({ status: 'error' })
        .eq('id', documentId);

      return NextResponse.json(
        { error: analysisResult.error },
        { status: 500 }
      );
    }

    const extractedData = analysisResult.data;

    // Update document with extracted information
    await supabaseAdmin
      .from('documents')
      .update({
        status: 'parsed',
        doc_type: extractedData.document_type,
        supplier_name: extractedData.supplier_name,
        supplier_vat: extractedData.supplier_vat,
        supplier_country: extractedData.supplier_country,
        supplier_address: extractedData.supplier_address,
        invoice_number: extractedData.invoice_number,
        invoice_date: extractedData.invoice_date,
        delivery_note_number: extractedData.delivery_note_number,
        total_ht: extractedData.total_ht,
        total_ttc: extractedData.total_ttc,
        shipping_total: extractedData.shipping_total,
        currency: extractedData.currency || 'EUR',
        incoterm: extractedData.incoterm,
        transport_mode: extractedData.transport_mode,
        pages_count: extractedData.pages_count || 1,
        confidence_avg: extractedData.confidence
      })
      .eq('id', documentId);

    // Insert document lines if extracted
    if (extractedData.lines && extractedData.lines.length > 0) {
      const lines = extractedData.lines.map((line: any, index: number) => ({
        document_id: documentId,
        line_no: index + 1,
        description: line.description,
        sku: line.sku,
        qty: line.quantity,
        unit: line.unit,
        unit_price: line.unit_price,
        line_amount: line.line_amount,
        hs_code: line.hs_code,
        country_of_origin: line.country_of_origin,
        net_mass_kg: line.net_mass_kg
      }));

      await supabaseAdmin
        .from('deb_document_lines')
        .insert(lines);
    }

    // Check for potential BL matching
    if (extractedData.document_type === 'delivery_note' || extractedData.document_type === 'mixed') {
      await findAndLinkRelatedDocuments(documentId, extractedData);
    }

    console.log('AI analysis completed for document:', documentId);

    return NextResponse.json({
      success: true,
      data: {
        message: 'Document analyzed successfully',
        documentId,
        extractedData
      }
    });

  } catch (error) {
    console.error('Document analysis error:', error);
    
    // Update status to error
    await supabaseAdmin
      .from('documents')
      .update({ status: 'error' })
      .eq('id', params.documentId);

    return NextResponse.json(
      { error: 'Failed to analyze document' },
      { status: 500 }
    );
  }
}

async function analyzeDocumentWithAI(documentUrl: string, filename: string) {
  try {
    const prompt = `Analysez ce document PDF et extrayez toutes les informations pertinentes pour l'import/export et les déclarations DEB (Déclaration d'Échanges de Biens).

CONTEXTE: Ce document peut être une facture commerciale, un bon de livraison, ou un document mixte. Je dois extraire les informations pour automatiser les déclarations douanières françaises.

INSTRUCTIONS DÉTAILLÉES:
1. Identifiez d'abord le type de document (invoice, delivery_note, ou mixed)
2. Extrayez toutes les informations du fournisseur
3. Extrayez tous les détails de facturation et shipping
4. Pour chaque ligne de produit, extrayez le maximum d'informations
5. Détectez les codes HS/tarifs si présents
6. Identifiez les incoterms et informations de transport

FORMAT DE RÉPONSE (JSON strict):
{
  "document_type": "invoice|delivery_note|mixed",
  "confidence": 0.95,
  "pages_count": 2,
  "supplier_name": "Nom complet du fournisseur",
  "supplier_vat": "Numéro TVA intracommunautaire",
  "supplier_country": "Code pays ISO (FR, DE, etc.)",
  "supplier_address": "Adresse complète",
  "invoice_number": "Numéro de facture",
  "invoice_date": "2024-01-15",
  "delivery_note_number": "Numéro BL si présent",
  "total_ht": 1250.50,
  "total_ttc": 1500.60,
  "shipping_total": 45.00,
  "currency": "EUR",
  "incoterm": "DDP|EXW|FOB|etc.",
  "transport_mode": "Road|Sea|Air|Rail",
  "lines": [
    {
      "line_no": 1,
      "description": "Description du produit",
      "sku": "REF-12345",
      "quantity": 10,
      "unit": "PCE",
      "unit_price": 125.50,
      "line_amount": 1255.00,
      "hs_code": "84143011",
      "country_of_origin": "DE",
      "net_mass_kg": 15.5,
      "customs_value": 1255.00
    }
  ],
  "additional_info": {
    "delivery_address": "Adresse de livraison si différente",
    "purchase_order": "Numéro de commande",
    "container_number": "Conteneur si transport maritime",
    "transport_document": "Numéro document transport"
  }
}

RÈGLES IMPORTANTES:
- Si une information n'est pas trouvée, utilisez null
- Les montants doivent être en format numérique (pas de string)
- Les dates au format YYYY-MM-DD
- Les codes pays en ISO 2 lettres (FR, DE, IT, etc.)
- Soyez très précis sur les quantités et unités
- Pour les codes HS, ne devinez pas, laissez null si incertain

Analysez maintenant ce document et retournez uniquement le JSON:`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-vision-preview',
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert en documents commerciaux internationaux et déclarations douanières. Tu analyses les factures et bons de livraison pour automatiser les déclarations DEB. Tu réponds uniquement avec du JSON valide, sans explication.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image_url',
              image_url: {
                url: documentUrl,
                detail: 'high'
              }
            }
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.1
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    console.log('OpenAI response:', response);

    // Parse JSON response
    const extractedData = JSON.parse(response);

    return {
      success: true,
      data: extractedData
    };

  } catch (error) {
    console.error('AI analysis error:', error);
    return {
      success: false,
      error: `AI analysis failed: ${error.message}`
    };
  }
}

async function findAndLinkRelatedDocuments(documentId: string, extractedData: any) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

    // Search for related documents based on:
    // 1. Same supplier
    // 2. Similar dates (±30 days)
    // 3. Similar amounts or product references

    const { data: document } = await supabaseAdmin
      .from('documents')
      .select('org_id, invoice_date, total_ht')
      .eq('id', documentId)
      .single();

    if (!document) return;

    // Find potential matches
    const { data: relatedDocs } = await supabaseAdmin
      .from('documents')
      .select('id, doc_type, invoice_number, delivery_note_number, total_ht')
      .eq('org_id', document.org_id)
      .eq('supplier_name', extractedData.supplier_name)
      .neq('id', documentId)
      .gte('invoice_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .lte('invoice_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());

    if (relatedDocs && relatedDocs.length > 0) {
      // Logic to match BL with invoices
      for (const relatedDoc of relatedDocs) {
        const amountDifference = Math.abs((relatedDoc.total_ht || 0) - (extractedData.total_ht || 0));
        const amountTolerance = (extractedData.total_ht || 0) * 0.1; // 10% tolerance

        if (amountDifference <= amountTolerance) {
          // Create a link between documents
          await supabaseAdmin
            .from('deb_document_links')
            .insert({
              document_id: documentId,
              linked_document_id: relatedDoc.id,
              link_type: 'bl_invoice_match',
              confidence: 0.8,
              created_at: new Date().toISOString()
            });

          console.log(`Linked documents: ${documentId} <-> ${relatedDoc.id}`);
        }
      }
    }

  } catch (error) {
    console.error('Document linking error:', error);
  }
}