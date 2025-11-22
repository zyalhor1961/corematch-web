import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');
    const status = searchParams.get('status');
    const clientId = searchParams.get('client_id');

    if (!orgId) {
      return NextResponse.json({ success: false, error: 'org_id required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let query = supabase
      .from('erp_quotes')
      .select(`
        *,
        client:erp_clients(id, name, email, company_name)
      `)
      .eq('org_id', orgId)
      .order('quote_date', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data: quotes, error } = await query;

    if (error) {
      console.error('Error fetching quotes:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        quotes: quotes || [],
        total: quotes?.length || 0,
      },
    });
  } catch (err: any) {
    console.error('Quotes API error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { org_id, client_id, items, notes, valid_until, ...quoteData } = body;

    if (!org_id) {
      return NextResponse.json({ success: false, error: 'org_id required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate quote number
    const { count } = await supabase
      .from('erp_quotes')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', org_id);

    const quoteNumber = `DEV-${String((count || 0) + 1).padStart(5, '0')}`;

    // Calculate totals
    let totalHt = 0;
    let totalTva = 0;
    if (items && Array.isArray(items)) {
      for (const item of items) {
        const lineTotal = (item.quantity || 1) * (item.unit_price || 0);
        totalHt += lineTotal;
        totalTva += lineTotal * ((item.vat_rate || 20) / 100);
      }
    }

    const { data: quote, error } = await supabase
      .from('erp_quotes')
      .insert({
        org_id,
        client_id,
        quote_number: quoteNumber,
        quote_date: new Date().toISOString().split('T')[0],
        valid_until: valid_until || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'draft',
        total_ht: totalHt,
        total_tva: totalTva,
        total_ttc: totalHt + totalTva,
        notes,
        ...quoteData,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating quote:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Insert quote lines if provided
    if (items && Array.isArray(items) && items.length > 0 && quote) {
      const lines = items.map((item: any, index: number) => ({
        quote_id: quote.id,
        description: item.description || '',
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        vat_rate: item.vat_rate || 20,
        line_total: (item.quantity || 1) * (item.unit_price || 0),
        position: index + 1,
      }));

      await supabase.from('erp_quote_lines').insert(lines);
    }

    return NextResponse.json({ success: true, data: quote });
  } catch (err: any) {
    console.error('Quote creation error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
