import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireOrgMembership } from '../../../_helpers';
import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';

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

    console.log('Analyse du document avec Azure Document Intelligence...');

    // Analyser le document avec le modèle prebuilt-invoice
    const poller = await client.beginAnalyzeDocument('prebuilt-invoice', pdfBuffer);
    const result = await poller.pollUntilDone();

    console.log('Analyse Azure terminée');
    console.log('Documents trouvés:', result.documents?.length || 0);

    const extracted: ExtractionResult = {
      lines: []
    };

    // Extraire les données de la première facture détectée
    if (result.documents && result.documents.length > 0) {
      const doc = result.documents[0];
      const fields = doc.fields;

      console.log('Champs disponibles:', Object.keys(fields || {}));
      console.log('Items:', fields?.Items);

      // Extraire les informations du fournisseur
      extracted.supplier_name = fields?.VendorName?.content;
      extracted.supplier_vat = fields?.VendorTaxId?.content;
      extracted.supplier_country = fields?.VendorAddress?.value?.countryRegion;

      // Extraire les informations de la facture
      extracted.invoice_number = fields?.InvoiceId?.content;
      extracted.invoice_date = fields?.InvoiceDate?.content;
      extracted.currency = fields?.CurrencyCode?.content || fields?.InvoiceTotal?.value?.currencyCode || 'EUR';

      // Extraire les montants (Azure retourne des objets avec {amount, currencyCode})
      extracted.total_ht = typeof fields?.InvoiceTotal?.value === 'object'
        ? fields?.InvoiceTotal?.value?.amount
        : fields?.InvoiceTotal?.value || fields?.SubTotal?.value?.amount;

      extracted.shipping_total = typeof fields?.ShippingCost?.value === 'object'
        ? fields?.ShippingCost?.value?.amount
        : fields?.ShippingCost?.value;

      // Extraire les lignes de produits
      const items = fields?.Items?.values || [];
      console.log('Nombre d\'items:', items.length);

      extracted.lines = items.map((item: any, index: number) => {
        const itemFields = item.properties;
        console.log(`Item ${index + 1}:`, JSON.stringify(itemFields));

        // Extraire les valeurs numériques correctement
        const qty = itemFields?.Quantity?.value;
        const unitPrice = itemFields?.UnitPrice?.value;
        const amount = itemFields?.Amount?.value;

        return {
          line_no: index + 1,
          description: itemFields?.Description?.content || '',
          sku: itemFields?.ProductCode?.content,
          qty: typeof qty === 'number' ? qty : undefined,
          unit: itemFields?.Unit?.content,
          unit_price: typeof unitPrice === 'object' ? unitPrice?.amount : unitPrice,
          line_amount: typeof amount === 'object' ? amount?.amount : amount,
        };
      });

      console.log(`Extraction Azure: ${extracted.lines.length} lignes trouvées`);
      console.log('Données extraites:', JSON.stringify(extracted));
    } else {
      console.log('Aucun document détecté par Azure');
    }

    return extracted;
  } catch (error) {
    console.error('Erreur extraction Azure:', error);
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
