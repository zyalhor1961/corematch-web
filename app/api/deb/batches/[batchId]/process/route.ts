import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireOrgMembership } from '../../../_helpers';
import OpenAI from 'openai';

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
  const systemPrompt = `Tu es un assistant expert en extraction de données de factures et bons de livraison pour les déclarations douanières (DEB).

Analyse TOUTES les pages de ce document (facture/bon de livraison scanné) et extrais les informations suivantes au format JSON:

- supplier_name: nom du fournisseur
- supplier_vat: numéro TVA intracommunautaire
- supplier_country: code pays ISO 2 lettres (FR, DE, IT, etc.)
- invoice_number: numéro de facture
- invoice_date: date au format YYYY-MM-DD
- delivery_note_number: numéro de bon de livraison (si présent)
- currency: code devise (EUR, USD, etc.)
- total_ht: montant total HT
- shipping_total: frais de port
- lines: tableau des lignes de produits avec:
  - line_no: numéro de ligne (1, 2, 3...)
  - description: description du produit
  - sku: référence produit
  - qty: quantité (nombre)
  - unit: unité (PCE, KG, MTR, etc.)
  - unit_price: prix unitaire (nombre)
  - line_amount: montant total ligne (nombre)
  - hs_code: code HS/douanier (si mentionné)
  - country_of_origin: pays d'origine (code ISO 2 lettres)
  - net_mass_kg: poids net en kg (nombre)

Important:
- Le document peut avoir plusieurs pages, analyse-les TOUTES
- Si une info n'est pas présente, ne la mets pas dans le JSON
- Les montants doivent être des nombres, pas des strings
- Les codes pays doivent être en majuscules (2 lettres)
- Retourne uniquement le JSON, sans texte avant ou après`;

  try {
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    const { pdfToPng } = await import('pdf-to-png-converter');

    // Sauvegarder temporairement le PDF
    const tempDir = os.tmpdir();
    const tempPdfPath = path.join(tempDir, `temp-${Date.now()}.pdf`);
    fs.writeFileSync(tempPdfPath, pdfBuffer);

    console.log('PDF sauvegardé temporairement:', tempPdfPath);

    // Convertir le PDF en images PNG
    const pngPages = await pdfToPng(tempPdfPath, {
      disableFontFace: false,
      useSystemFonts: false,
      viewportScale: 2.0,
    });

    console.log(`PDF converti en ${pngPages.length} image(s)`);

    // Supprimer le fichier temporaire
    fs.unlinkSync(tempPdfPath);

    // Préparer les images pour OpenAI
    const imageMessages = pngPages.map((page) => ({
      type: 'image_url' as const,
      image_url: {
        url: `data:image/png;base64,${page.content.toString('base64')}`,
        detail: 'high' as const
      }
    }));

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',  // Utiliser gpt-4o pour la vision
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Voici un document scanné de ${pngPages.length} page(s). Analyse TOUTES les pages et extrais les données au format JSON:`
            },
            ...imageMessages
          ]
        }
      ],
      temperature: parseFloat(process.env.CM_TEMPERATURE || '0.3'),
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Pas de réponse de OpenAI');
    }

    console.log('Réponse OpenAI:', content.substring(0, 500));

    // Nettoyer le JSON (enlever les backticks markdown si présents)
    const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const extracted = JSON.parse(cleanedContent) as ExtractionResult;

    return extracted;
  } catch (error) {
    console.error('Erreur extraction OpenAI:', error);
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
