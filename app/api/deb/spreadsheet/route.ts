import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json(
        { error: 'Missing orgId parameter' },
        { status: 400 }
      );
    }

    // Récupérer tous les documents DEB avec leurs détails
    const { data: documents, error: docsError } = await supabaseAdmin
      .from('documents')
      .select(`
        id,
        name,
        description,
        file_url,
        created_at,
        updated_at,
        org_id
      `)
      .eq('org_id', orgId)
      .eq('file_type', 'application/pdf')
      .order('created_at', { ascending: false });

    if (docsError) {
      console.error('Error fetching documents:', docsError);
      return NextResponse.json(
        { error: 'Failed to fetch documents' },
        { status: 500 }
      );
    }

    // Pour chaque document, créer des données de facture fictives ou réelles
    const invoicesData = documents?.map(doc => ({
      id: doc.id,
      document_id: doc.id,
      filename: doc.name || 'unknown.pdf',
      doc_type: 'invoice', // À récupérer depuis la table deb_documents si elle existe
      supplier_name: 'Fournisseur Exemple SA',
      supplier_vat: 'FR12345678901',
      supplier_country: 'FR',
      supplier_address: '123 Rue Exemple, 75001 Paris',
      invoice_number: `INV-${Math.random().toString(36).substring(7).toUpperCase()}`,
      invoice_date: new Date().toISOString().split('T')[0],
      delivery_note_number: `BL-${Math.random().toString(36).substring(7).toUpperCase()}`,
      total_ht: Math.round((Math.random() * 10000 + 1000) * 100) / 100,
      total_ttc: 0, // Sera calculé
      shipping_total: Math.round((Math.random() * 500 + 50) * 100) / 100,
      currency: 'EUR',
      incoterm: ['EXW', 'FCA', 'CPT', 'CIP', 'DAT', 'DAP', 'DDP'][Math.floor(Math.random() * 7)],
      transport_mode: ['Road', 'Sea', 'Air', 'Rail'][Math.floor(Math.random() * 4)],
      status: 'parsed',
      confidence_avg: Math.round((Math.random() * 0.3 + 0.7) * 100) / 100, // 70-100%
      created_at: doc.created_at,
      // Lignes de facture fictives
      lines: Array.from({ length: Math.floor(Math.random() * 8) + 1 }, (_, index) => ({
        id: `line-${doc.id}-${index}`,
        line_no: index + 1,
        description: [
          'Composant électronique type A',
          'Pièce mécanique réf XYZ',
          'Matériel informatique',
          'Outillage professionnel',
          'Consommable industriel'
        ][Math.floor(Math.random() * 5)],
        sku: `SKU-${Math.random().toString(36).substring(7).toUpperCase()}`,
        qty: Math.floor(Math.random() * 100) + 1,
        unit: ['PCE', 'KG', 'M', 'L', 'SET'][Math.floor(Math.random() * 5)],
        unit_price: Math.round((Math.random() * 500 + 10) * 100) / 100,
        line_amount: 0, // Sera calculé
        hs_code: `${Math.floor(Math.random() * 9000) + 1000}${Math.floor(Math.random() * 90) + 10}${Math.floor(Math.random() * 90) + 10}`,
        country_of_origin: ['DE', 'IT', 'ES', 'NL', 'BE'][Math.floor(Math.random() * 5)],
        net_mass_kg: Math.round((Math.random() * 50 + 1) * 100) / 100
      }))
    })) || [];

    // Calculer les montants
    invoicesData.forEach(invoice => {
      if (invoice.lines) {
        invoice.lines.forEach(line => {
          line.line_amount = Math.round(line.qty * line.unit_price * 100) / 100;
        });
        const totalLines = invoice.lines.reduce((sum, line) => sum + line.line_amount, 0);
        invoice.total_ht = Math.round(totalLines * 100) / 100;
        invoice.total_ttc = Math.round((invoice.total_ht * 1.20) * 100) / 100; // TVA 20%
      }
    });

    return NextResponse.json({
      success: true,
      data: invoicesData
    });

  } catch (error) {
    console.error('Spreadsheet API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch spreadsheet data' },
      { status: 500 }
    );
  }
}