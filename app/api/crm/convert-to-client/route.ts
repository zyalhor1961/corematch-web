import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Convert a won lead to a client and create a draft invoice
 * POST /api/crm/convert-to-client
 *
 * This is the "One-Click Close" killer feature:
 * - Converts Lead → Client
 * - Creates draft Invoice with deal amount
 * - Returns the new client and invoice IDs
 */
export async function POST(request: NextRequest) {
  try {
    const { leadId, orgId } = await request.json();

    if (!leadId || !orgId) {
      return NextResponse.json(
        { error: 'leadId and orgId are required' },
        { status: 400 }
      );
    }

    // 1. Fetch the lead
    const { data: lead, error: leadError } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    // 2. Check if lead is won
    if (lead.status !== 'won') {
      return NextResponse.json(
        { error: 'Lead must be in "won" status to convert' },
        { status: 400 }
      );
    }

    // 3. Check if client already exists (by email or company name)
    let existingClient = null;
    if (lead.contact_email) {
      const { data: clientByEmail } = await supabaseAdmin
        .from('erp_clients')
        .select('id')
        .eq('org_id', orgId)
        .eq('email', lead.contact_email)
        .single();
      existingClient = clientByEmail;
    }

    if (!existingClient && lead.company_name) {
      const { data: clientByName } = await supabaseAdmin
        .from('erp_clients')
        .select('id')
        .eq('org_id', orgId)
        .eq('name', lead.company_name)
        .single();
      existingClient = clientByName;
    }

    let clientId: string;

    if (existingClient) {
      clientId = existingClient.id;
    } else {
      // 4. Create the client
      const { data: newClient, error: clientError } = await supabaseAdmin
        .from('erp_clients')
        .insert({
          org_id: orgId,
          name: lead.company_name,
          email: lead.contact_email,
          phone: lead.contact_phone,
          website: lead.website,
          contact_name: lead.contact_name,
          // Additional metadata
          notes: `Converti depuis le lead CRM.\n\nRésumé IA: ${lead.ai_summary || 'N/A'}`,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (clientError) {
        console.error('Error creating client:', clientError);
        return NextResponse.json(
          { error: 'Failed to create client: ' + clientError.message },
          { status: 500 }
        );
      }

      clientId = newClient.id;
    }

    // 5. Generate invoice number
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');

    // Get count of invoices this month for numbering
    const { count } = await supabaseAdmin
      .from('erp_invoices')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('created_at', `${year}-${month}-01`);

    const invoiceNumber = `FAC-${year}${month}-${String((count || 0) + 1).padStart(4, '0')}`;

    // 6. Create draft invoice
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // 30 days payment terms

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('erp_invoices')
      .insert({
        org_id: orgId,
        client_id: clientId,
        invoice_number: invoiceNumber,
        status: 'draft',
        invoice_date: today.toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        // Financial data from lead
        subtotal_ht: lead.potential_value,
        total_tax: lead.potential_value * 0.20, // 20% TVA
        total_ttc: lead.potential_value * 1.20,
        currency: lead.currency || 'EUR',
        // Metadata
        notes: `Facture générée automatiquement depuis le lead "${lead.company_name}"`,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (invoiceError) {
      console.error('Error creating invoice:', invoiceError);
      return NextResponse.json(
        { error: 'Failed to create invoice: ' + invoiceError.message },
        { status: 500 }
      );
    }

    // 7. Add activity to lead
    await supabaseAdmin
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        activity_type: 'status_change',
        content: `🎉 Lead converti en client ! Facture ${invoiceNumber} créée (${lead.potential_value}€)`,
      });

    // 8. Update lead with client reference
    await supabaseAdmin
      .from('leads')
      .update({
        probability: 100,
        ai_next_action: `Client créé. Facture ${invoiceNumber} prête à envoyer.`,
      })
      .eq('id', leadId);

    return NextResponse.json({
      success: true,
      clientId,
      invoiceId: invoice.id,
      invoiceNumber,
      message: `Client créé et facture ${invoiceNumber} générée !`,
      isNewClient: !existingClient,
    });

  } catch (error: any) {
    console.error('Conversion error:', error);
    return NextResponse.json(
      { error: error.message || 'Conversion failed' },
      { status: 500 }
    );
  }
}
