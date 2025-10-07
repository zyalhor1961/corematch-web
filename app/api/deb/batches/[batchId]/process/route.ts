import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireOrgMembership } from '../../../_helpers';
import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';
import OpenAI from 'openai';

export const maxDuration = 60; // Timeout de 60 secondes

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ExtractedLine {
  line_no: number;
  description: string;
  sku?: string;
  qty?: number;
  unit?: string;
  unit_price?: number;
  line_amount?: number;
  hs_code?: string;
  country_of_origin?: string;
  net_mass_kg?: number;
}

interface ExtractionResult {
  supplier_name?: string;
  supplier_vat?: string;
  supplier_country?: string;
  invoice_number?: string;
  invoice_date?: string;
  delivery_note_number?: string;
  currency?: string;
  total_ht?: number;
  shipping_total?: number;
  lines: ExtractedLine[];
}

async function loadBatchOrg(batchId: string) {
  const { data, error } = await supabaseAdmin
    .from('deb_batches')
    .select('org_id')
    .eq('id', batchId)
    .maybeSingle();

  if (error) {
    console.error('Erreur lecture deb_batches', error);
    throw new Error('Batch introuvable');
  }

  return data;
}

async function extractPdfData(pdfBuffer: Buffer): Promise<ExtractionResult> {
  try {
    const endpoint = process.env.AZURE_FORM_RECOGNIZER_ENDPOINT?.replace('/api/projects/Corematch-DEB', '') || '';
    const key = process.env.AZURE_FORM_RECOGNIZER_KEY || '';

    if (!endpoint || !key) {
      throw new Error('Azure Form Recognizer credentials not configured');
    }

    const client = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(key));

    console.log('Étape 1: Extraction du texte avec Azure...');

    // Analyser avec prebuilt-read pour obtenir tout le texte
    const poller = await client.beginAnalyzeDocument('prebuilt-read', pdfBuffer);
    const result = await poller.pollUntilDone();

    // Extraire tout le texte du document
    let fullText = '';
    if (result.content) {
      fullText = result.content;
    }

    console.log('Texte extrait:', fullText.substring(0, 300));
    console.log('Étape 2: Analyse du texte avec OpenAI...');

    const systemPrompt = `Tu es un expert en extraction de données de factures pour les déclarations DEB.
À partir du texte OCR de la facture, retourne UNIQUEMENT un JSON valide (sans markdown, sans backticks) avec:
{
  "supplier_name": "nom du fournisseur",
  "supplier_vat": "numéro TVA",
  "supplier_country": "code pays 2 lettres (FR, DE, IT...)",
  "invoice_number": "numéro facture",
  "invoice_date": "YYYY-MM-DD",
  "delivery_note_number": "numéro BL si présent",
  "currency": "EUR",
  "total_ht": montant_total_nombre,
  "shipping_total": frais_port_nombre,
  "lines": [
    {
      "line_no": 1,
      "description": "description produit",
      "sku": "référence",
      "qty": quantité_nombre,
      "unit": "PCE",
      "unit_price": prix_unitaire_nombre,
      "line_amount": montant_ligne_nombre
    }
  ]
}

IMPORTANT: Retourne UNIQUEMENT le JSON, rien d'autre. Les nombres doivent être des nombres, pas des strings.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Voici le texte extrait de la facture:\n\n${fullText}\n\nExtrais les données au format JSON:` }
      ],
      temperature: 0.1,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Pas de réponse de OpenAI');
    }

    console.log('Réponse OpenAI:', content.substring(0, 500));

    // Nettoyer le JSON
    const cleanedContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const extracted = JSON.parse(cleanedContent) as ExtractionResult;

    console.log(`Extraction terminée: ${extracted.lines?.length || 0} lignes trouvées`);

    return extracted;
  } catch (error) {
    console.error('Erreur extraction:', error);
    throw error;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const { batchId } = params;
    if (!batchId) {
      return NextResponse.json({ error: 'batchId requis' }, { status: 400 });
    }

    const batch = await loadBatchOrg(batchId);
    if (!batch) {
      return NextResponse.json({ error: 'Batch introuvable' }, { status: 404 });
    }

    const membership = await requireOrgMembership(batch.org_id, ['org_admin', 'org_manager']);
    if ('error' in membership) {
      return NextResponse.json({ error: membership.error }, { status: membership.status });
    }

    // Mettre à jour le statut du batch
    await supabaseAdmin
      .from('deb_batches')
      .update({ status: 'processing' })
      .eq('id', batchId);

    // Récupérer les documents du batch
    const { data: documents, error: docsError } = await supabaseAdmin
      .from('documents')
      .select('id, storage_object_path')
      .eq('batch_id', batchId);

    if (docsError || !documents || documents.length === 0) {
      return NextResponse.json({ error: 'Aucun document trouvé' }, { status: 404 });
    }

    // Traiter chaque document
    for (const doc of documents) {
      try {
        // Mettre à jour le statut du document
        await supabaseAdmin
          .from('documents')
          .update({ status: 'processing' })
          .eq('id', doc.id);

        // Télécharger le PDF depuis le storage
        const { data: pdfData, error: downloadError } = await supabaseAdmin.storage
          .from('deb-docs')
          .download(doc.storage_object_path);

        if (downloadError || !pdfData) {
          throw new Error('Impossible de télécharger le PDF: ' + downloadError?.message);
        }

        // Convertir Blob en Buffer
        const arrayBuffer = await pdfData.arrayBuffer();
        const pdfBuffer = Buffer.from(arrayBuffer);

        console.log('PDF téléchargé, taille:', pdfBuffer.length, 'bytes');

        // Extraire les données avec OpenAI
        const extracted = await extractPdfData(pdfBuffer);

        // Mettre à jour le document avec les données extraites
        await supabaseAdmin
          .from('documents')
          .update({
            supplier_name: extracted.supplier_name,
            supplier_vat: extracted.supplier_vat,
            supplier_country: extracted.supplier_country,
            invoice_number: extracted.invoice_number,
            invoice_date: extracted.invoice_date,
            delivery_note_number: extracted.delivery_note_number,
            currency: extracted.currency || 'EUR',
            total_ht: extracted.total_ht,
            shipping_total: extracted.shipping_total,
            status: 'parsed',
            pages_count: 1
          })
          .eq('id', doc.id);

        // Insérer les lignes extraites
        if (extracted.lines && extracted.lines.length > 0) {
          const linesToInsert = extracted.lines.map(line => ({
            document_id: doc.id,
            ...line
          }));

          const { error: linesError } = await supabaseAdmin
            .from('document_lines')
            .insert(linesToInsert);

          if (linesError) {
            console.error('Erreur insertion lignes:', linesError);
          }
        }

      } catch (docError) {
        console.error(`Erreur traitement document ${doc.id}:`, docError);
        await supabaseAdmin
          .from('documents')
          .update({
            status: 'error',
          })
          .eq('id', doc.id);
      }
    }

    // Mettre à jour le batch
    await supabaseAdmin
      .from('deb_batches')
      .update({
        status: 'ready',
        processed_documents: documents.length
      })
      .eq('id', batchId);

    return NextResponse.json({
      success: true,
      message: 'Traitement terminé',
      documents_processed: documents.length
    });

  } catch (error) {
    console.error('Erreur POST /api/deb/batches/[batchId]/process', error);
    return NextResponse.json({ error: 'Erreur inattendue' }, { status: 500 });
  }
}
