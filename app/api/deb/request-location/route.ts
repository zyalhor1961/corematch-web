import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    console.log('📍 Location request received for document:', data.document_id);

    // Créer une notification/tâche pour demander les informations à l'utilisateur
    const { error: insertError } = await supabaseAdmin
      .from('notifications')
      .insert({
        org_id: data.org_id,
        document_id: data.document_id,
        type: 'location_required',
        title: 'Informations de livraison requises',
        message: `Le document "${data.document_name || 'Document'}" nécessite la saisie du département et de la ville de livraison pour le traitement DEB.`,
        data: {
          document_id: data.document_id,
          vendor_name: data.vendor_name,
          invoice_number: data.invoice_id,
          shipping_address: data.shipping_address,
          status: 'awaiting_location'
        },
        created_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Error creating notification:', insertError);
      return NextResponse.json(
        { error: 'Failed to create location request' },
        { status: 500 }
      );
    }

    // Mettre à jour le statut du document
    const { error: updateError } = await supabaseAdmin
      .from('documents')
      .update({
        status: 'awaiting_location',
        updated_at: new Date().toISOString()
      })
      .eq('id', data.document_id);

    if (updateError) {
      console.error('Error updating document status:', updateError);
    }

    console.log('✅ Location request created successfully');

    return NextResponse.json({
      success: true,
      message: 'Location request sent to user',
      document_id: data.document_id,
      notification_created: true
    });

  } catch (error) {
    console.error('❌ Request location error:', error);
    return NextResponse.json(
      { error: 'Failed to process location request' },
      { status: 500 }
    );
  }
}