import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  onSupplierInvoiceValidated,
  reverseEntriesForSource,
  regenerateEntriesForInvoice
} from '@/lib/accounting';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface RouteParams {
  params: Promise<{ purchaseId: string }>;
}

/**
 * GET /api/erp/purchases/[purchaseId]
 * Get a single supplier invoice with accounting entries
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { purchaseId } = await params;
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');

    if (!orgId) {
      return NextResponse.json({ success: false, error: 'org_id required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch supplier invoice with supplier info
    const { data: purchase, error } = await supabase
      .from('erp_supplier_invoices')
      .select(`
        *,
        supplier:erp_suppliers(id, name, company_name, email, address)
      `)
      .eq('id', purchaseId)
      .eq('org_id', orgId)
      .single();

    if (error || !purchase) {
      return NextResponse.json({ success: false, error: 'Facture fournisseur non trouvée' }, { status: 404 });
    }

    // Fetch linked accounting entries
    const { data: accountingEntries } = await supabase
      .from('erp_journal_entries')
      .select(`
        id,
        entry_number,
        entry_date,
        description,
        total_debit,
        total_credit,
        status,
        journal:erp_journals(journal_code, journal_name)
      `)
      .eq('org_id', orgId)
      .eq('source_type', 'supplier_invoice')
      .eq('source_id', purchaseId)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      success: true,
      data: {
        ...purchase,
        accounting_entries: accountingEntries || [],
      },
    });
  } catch (err: any) {
    console.error('Purchase GET error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/erp/purchases/[purchaseId]
 * Update a supplier invoice - handles status changes with accounting triggers
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { purchaseId } = await params;
    const body = await request.json();
    const { org_id } = body;

    if (!org_id) {
      return NextResponse.json({ success: false, error: 'org_id required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch current purchase
    const { data: currentPurchase, error: fetchError } = await supabase
      .from('erp_supplier_invoices')
      .select(`
        *,
        supplier:erp_suppliers(id, name, company_name)
      `)
      .eq('id', purchaseId)
      .eq('org_id', org_id)
      .single();

    if (fetchError || !currentPurchase) {
      return NextResponse.json({ success: false, error: 'Facture fournisseur non trouvée' }, { status: 404 });
    }

    const oldStatus = currentPurchase.status;
    const newStatus = body.status;

    // Prepare update data
    const updateData: Record<string, any> = {};
    const allowedFields = [
      'supplier_id', 'invoice_number', 'invoice_date', 'due_date',
      'total_ht', 'total_tva', 'total_ttc', 'notes', 'status',
      'expense_category', 'reference'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Recalculate balance if totals changed
    if (body.total_ttc !== undefined) {
      updateData.balance_due = body.total_ttc - (currentPurchase.paid_amount || 0);
    }

    // Update supplier invoice
    const { data: updatedPurchase, error: updateError } = await supabase
      .from('erp_supplier_invoices')
      .update(updateData)
      .eq('id', purchaseId)
      .select(`
        *,
        supplier:erp_suppliers(id, name, company_name)
      `)
      .single();

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    let accountingResult = null;

    // Handle status change for accounting
    if (newStatus && newStatus !== oldStatus) {
      // VALIDATION: Trigger accounting entry generation
      if ((newStatus === 'validated' || newStatus === 'approved') &&
          (oldStatus === 'received' || oldStatus === 'draft')) {

        const result = await onSupplierInvoiceValidated(supabase, {
          id: purchaseId,
          org_id: org_id,
          invoice_number: updatedPurchase.invoice_number,
          invoice_date: updatedPurchase.invoice_date,
          total_ht: updatedPurchase.total_ht || 0,
          total_tva: updatedPurchase.total_tva || 0,
          total_ttc: updatedPurchase.total_ttc || 0,
          supplier_id: updatedPurchase.supplier_id,
          supplier_name: updatedPurchase.supplier?.company_name || updatedPurchase.supplier?.name,
          expense_category: updatedPurchase.expense_category,
        });

        accountingResult = result;

        if (!result.success) {
          console.warn('[Purchase] Accounting entry generation warning:', result.error);
        }
      }

      // MODIFICATION after validation: Reverse and regenerate
      if (oldStatus !== 'received' && oldStatus !== 'draft' &&
          (body.total_ht !== undefined || body.total_ttc !== undefined)) {

        const result = await regenerateEntriesForInvoice(supabase, {
          id: purchaseId,
          org_id: org_id,
          type: 'supplier',
          invoice_number: updatedPurchase.invoice_number,
          invoice_date: updatedPurchase.invoice_date,
          total_ht: updatedPurchase.total_ht || 0,
          total_tva: updatedPurchase.total_tva || 0,
          total_ttc: updatedPurchase.total_ttc || 0,
          supplier_id: updatedPurchase.supplier_id,
          supplier_name: updatedPurchase.supplier?.company_name || updatedPurchase.supplier?.name,
          expense_category: updatedPurchase.expense_category,
        });

        accountingResult = result;
      }

      // CANCELLATION: Reverse accounting entries
      if (newStatus === 'cancelled' &&
          (oldStatus === 'validated' || oldStatus === 'approved')) {

        const result = await reverseEntriesForSource(
          supabase,
          org_id,
          'supplier_invoice',
          purchaseId,
          new Date().toISOString().split('T')[0],
          'Annulation de la facture fournisseur'
        );

        accountingResult = { reversals: result };
      }
    }

    // Fetch accounting entries for response
    const { data: accountingEntries } = await supabase
      .from('erp_journal_entries')
      .select(`
        id,
        entry_number,
        entry_date,
        description,
        total_debit,
        total_credit,
        status
      `)
      .eq('org_id', org_id)
      .eq('source_type', 'supplier_invoice')
      .eq('source_id', purchaseId)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      success: true,
      data: {
        ...updatedPurchase,
        accounting_entries: accountingEntries || [],
        accounting_result: accountingResult,
      },
    });
  } catch (err: any) {
    console.error('Purchase PATCH error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/erp/purchases/[purchaseId]
 * Delete a supplier invoice (only if not yet validated)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { purchaseId } = await params;
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');

    if (!orgId) {
      return NextResponse.json({ success: false, error: 'org_id required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check purchase exists and status
    const { data: purchase, error: fetchError } = await supabase
      .from('erp_supplier_invoices')
      .select('id, status')
      .eq('id', purchaseId)
      .eq('org_id', orgId)
      .single();

    if (fetchError || !purchase) {
      return NextResponse.json({ success: false, error: 'Facture fournisseur non trouvée' }, { status: 404 });
    }

    if (purchase.status !== 'received' && purchase.status !== 'draft') {
      return NextResponse.json({
        success: false,
        error: 'Seules les factures en attente ou brouillon peuvent être supprimées. Utilisez le statut "cancelled" pour annuler.'
      }, { status: 400 });
    }

    // Delete purchase
    const { error: deleteError } = await supabase
      .from('erp_supplier_invoices')
      .delete()
      .eq('id', purchaseId);

    if (deleteError) {
      return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Facture fournisseur supprimée avec succès',
    });
  } catch (err: any) {
    console.error('Purchase DELETE error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
