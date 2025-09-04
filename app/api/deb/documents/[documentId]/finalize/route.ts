import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  try {
    const { documentId } = await params;
    const data = await request.json();
    
    console.log('💾 Finalizing document processing:', documentId);
    console.log('Processing data received:', JSON.stringify(data, null, 2));

    // 1. Mettre à jour le document principal
    const { error: docUpdateError } = await supabaseAdmin
      .from('documents')
      .update({
        // Informations extraites de la facture
        supplier_name: data.vendor_name,
        supplier_vat: data.vendor_vat,
        supplier_address: data.vendor_address,
        invoice_number: data.invoice_id,
        invoice_date: data.invoice_date,
        total_ht: data.subtotal,
        total_ttc: data.invoice_total,
        shipping_total: data.shipping_total,
        
        // Informations de livraison
        delivery_city: data.delivery_city,
        department: data.department,
        
        // Informations de transport
        transport_mode: data.bl_matching?.best_match?.bl?.transport_mode,
        transport_document: data.bl_matching?.best_match?.bl?.transport_document,
        delivery_note_number: data.bl_matching?.best_match?.bl?.bl_number,
        
        // Métadonnées de traitement
        processing_status: data.processing_status,
        needs_manual_review: data.needs_manual_review,
        estimated_weight_kg: data.estimated_total_weight_kg,
        line_count: data.items?.length || 0,
        
        // Résultats de validation
        validation_results: data.validations,
        
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);

    if (docUpdateError) {
      console.error('Error updating document:', docUpdateError);
      return NextResponse.json(
        { error: 'Failed to update document' },
        { status: 500 }
      );
    }

    // 2. Sauvegarder les lignes d'articles
    if (data.items && data.items.length > 0) {
      // Supprimer les anciennes lignes
      await supabaseAdmin
        .from('document_lines')
        .delete()
        .eq('document_id', documentId);

      // Insérer les nouvelles lignes
      const linesToInsert = data.items.map((item: any, index: number) => ({
        document_id: documentId,
        line_number: item.line_number || (index + 1),
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        line_amount: item.amount,
        hs_code: item.hs_lookup?.hs_code,
        hs_confidence: item.hs_lookup?.confidence,
        country_of_origin: item.country_of_origin,
        net_mass_kg: item.weight_info?.weight_kg,
        customs_value_line: item.amount,
        
        // Métadonnées de recherche
        source_weight: item.weight_info?.source_text,
        source_hs: item.hs_lookup?.matched_keyword,
        
        created_at: new Date().toISOString()
      }));

      const { error: linesError } = await supabaseAdmin
        .from('document_lines')
        .insert(linesToInsert);

      if (linesError) {
        console.error('Error inserting document lines:', linesError);
        // Continue quand même, ce n'est pas bloquant
      } else {
        console.log(`✅ Inserted ${linesToInsert.length} document lines`);
      }
    }

    // 3. Créer les liens avec les BL si correspondances trouvées
    if (data.bl_matching?.potential_matches?.length > 0) {
      const linksToInsert = data.bl_matching.potential_matches
        .filter((match: any) => match.confidence_score >= 50)
        .map((match: any) => ({
          document_id: documentId,
          linked_document_id: match.bl.id, // Assumant que les BL sont aussi dans la table documents
          link_type: match.confidence_score >= 80 ? 'auto_matched' : 'suggested',
          confidence: match.confidence_score / 100,
          notes: `Matched by criteria: ${match.matching_criteria.join(', ')}`,
          created_at: new Date().toISOString()
        }));

      if (linksToInsert.length > 0) {
        const { error: linksError } = await supabaseAdmin
          .from('document_links')
          .insert(linksToInsert);

        if (linksError) {
          console.error('Error creating document links:', linksError);
        } else {
          console.log(`✅ Created ${linksToInsert.length} document links`);
        }
      }
    }

    // 4. Sauvegarder la répartition des frais de transport
    if (data.transport_cost_distribution) {
      const { error: transportError } = await supabaseAdmin
        .from('transport_cost_allocations')
        .insert({
          document_id: documentId,
          total_transport_cost: data.transport_cost_distribution.total_transport_cost,
          allocation_details: data.transport_cost_distribution.items_distribution,
          created_at: new Date().toISOString()
        });

      if (transportError) {
        console.error('Error saving transport cost allocation:', transportError);
        // Pas bloquant, continuer
      }
    }

    // 5. Créer des notifications pour actions requises
    const notifications = [];

    // Items nécessitant révision des codes HS
    const hsReviewItems = data.items?.filter((item: any) => item.hs_lookup?.needs_manual_review) || [];
    if (hsReviewItems.length > 0) {
      notifications.push({
        org_id: data.org_id,
        document_id: documentId,
        type: 'hs_codes_review',
        title: 'Codes HS à vérifier',
        message: `${hsReviewItems.length} articles nécessitent une vérification manuelle des codes HS`,
        data: { items: hsReviewItems.map((item: any) => ({ 
          line_number: item.line_number, 
          description: item.description 
        })) },
        created_at: new Date().toISOString()
      });
    }

    // Validations échouées
    const failedValidations = data.validations?.filter((v: any) => 
      (v.errors && v.errors.length > 0) || !v.result?.valid
    ) || [];
    if (failedValidations.length > 0) {
      notifications.push({
        org_id: data.org_id,
        document_id: documentId,
        type: 'validation_errors',
        title: 'Erreurs de validation détectées',
        message: `Le document présente ${failedValidations.length} problèmes de validation`,
        data: { validations: failedValidations },
        created_at: new Date().toISOString()
      });
    }

    if (notifications.length > 0) {
      const { error: notifError } = await supabaseAdmin
        .from('notifications')
        .insert(notifications);

      if (notifError) {
        console.error('Error creating notifications:', notifError);
      } else {
        console.log(`✅ Created ${notifications.length} notifications`);
      }
    }

    console.log('✅ Document processing finalized successfully');

    return NextResponse.json({
      success: true,
      document_updated: true,
      lines_saved: data.items?.length || 0,
      links_created: data.bl_matching?.potential_matches?.length || 0,
      notifications_created: notifications.length,
      processing_summary: {
        needs_manual_review: data.needs_manual_review,
        hs_codes_found: data.items?.filter((item: any) => !item.hs_lookup?.needs_manual_review).length || 0,
        hs_codes_need_review: hsReviewItems.length,
        bl_matches_found: data.bl_matching?.potential_matches?.length || 0,
        auto_linked_bl: data.bl_matching?.auto_linked || false,
        estimated_weight_kg: data.estimated_total_weight_kg,
        transport_cost_allocated: !!data.transport_cost_distribution
      }
    });

  } catch (error) {
    console.error('❌ Document finalization error:', error);
    return NextResponse.json(
      { error: 'Failed to finalize document processing' },
      { status: 500 }
    );
  }
}