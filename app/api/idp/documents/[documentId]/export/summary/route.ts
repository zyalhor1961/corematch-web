import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

function parseFrenchDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const frenchMonths: { [key: string]: string } = {
    'janvier': '01', 'fsvrier': '02', 'fevrier': '02', 'mars': '03', 'avril': '04',
    'mai': '05', 'juin': '06', 'juillet': '07', 'aot': '08', 'aout': '08',
    'septembre': '09', 'octobre': '10', 'novembre': '11', 'dcembre': '12', 'decembre': '12'
  };
  const frenchPattern = /(\d{1,2})\s+([a-z]+)\s+(\d{4})/i;
  const match = dateStr.match(frenchPattern);
  if (match) {
    const day = match[1].padStart(2, '0');
    const monthName = match[2].toLowerCase();
    const year = match[3];
    const month = frenchMonths[monthName];
    if (month) return `${year}-${month}-${day}`;
  }
  const numericPattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/;
  const numMatch = dateStr.match(numericPattern);
  if (numMatch) {
    const day = numMatch[1].padStart(2, '0');
    const month = numMatch[2].padStart(2, '0');
    const year = numMatch[3];
    return `${year}-${month}-${day}`;
  }
  const isoPattern = /(\d{4})-(\d{2})-(\d{2})/;
  if (isoPattern.test(dateStr)) return dateStr.substring(0, 10);
  return null;
}

function extractByPatterns(fields: any[], patterns: string[]): string | null {
  const lowerPatterns = patterns.map(p => p.toLowerCase());
  for (const f of fields) {
    const name = (f.field_name || f.name || '').toLowerCase();
    if (lowerPatterns.some(p => name.includes(p))) {
      const v = f.value_text ?? f.value;
      if (v && v.toString().trim()) return v.toString().trim();
    }
  }
  return null;
}

function findIBAN(texts: string[]): string | null {
  const IBAN_REGEX = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/;
  for (const t of texts) {
    const m = t.toUpperCase().match(IBAN_REGEX);
    if (m) return m[0];
  }
  return null;
}

function findEmail(texts: string[]): string | null {
  const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
  for (const t of texts) {
    const m = t.match(EMAIL_REGEX);
    if (m) return m[0];
  }
  return null;
}

function findPhone(texts: string[]): string | null {
  const PHONE_REGEX = /\+?\d[\d\s().-]{6,}/;
  for (const t of texts) {
    const m = t.match(PHONE_REGEX);
    if (m) return m[0];
  }
  return null;
}

function extractCountry(address: string | null): string | null {
  if (!address) return null;
  const parts = address.split(/\n|,|;/).map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const last = parts[parts.length - 1];
  if (last.length <= 3 && /^[A-Z]{2,3}$/i.test(last)) return last.toUpperCase();
  return last;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { documentId } = await params;

    // Load document
    const { data: doc } = await supabase
      .from('idp_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    // Load fields
    const { data: fields = [] } = await supabase
      .from('idp_extracted_fields')
      .select('*')
      .eq('document_id', documentId)
      .order('page_number', { ascending: true })
      .order('created_at', { ascending: true });

    const texts = fields.map((f: any) => f.value_text).filter(Boolean) as string[];

    // Core header fields (with fallback to document columns)
    const invoiceNumber = doc?.invoice_number || extractByPatterns(fields, [
      'invoiceid','invoice number','invoice no','invoice #','numero facture','numéro facture','n° facture','numéro de la facture'
    ]);
    const vendorName = doc?.vendor_name || extractByPatterns(fields,[
      'vendorname','vendor','seller','supplier','fournisseur','vendeur','sold by','merchant'
    ]);
    const vendorVat = doc?.vendor_vat || extractByPatterns(fields,[ 'vendortaxid','vat','tva','numéro tva','numero tva' ]);
    const documentDateRaw = doc?.document_date || extractByPatterns(fields,[
      'invoicedate','invoice date','issue date','date de la facture','date facture'
    ]);
    const documentDate = typeof documentDateRaw === 'string' && documentDateRaw.length === 10
      ? documentDateRaw
      : parseFrenchDate(documentDateRaw || '') || null;
    const orderNumber = extractByPatterns(fields,[ 'purchaseorder','purchase order','po number','order number','commande' ]);
    const vendorEmail = extractByPatterns(fields,[ 'email','e-mail','courriel','mail' ]) || findEmail(texts);
    const vendorPhone = extractByPatterns(fields,[ 'phone','telephone','téléphone','tel' ]) || findPhone(texts);
    const vendorAddress = extractByPatterns(fields,[ 'vendoraddress','supplieraddress','address','adresse','bill from','billed by' ]) || null;
    const vendorCountry = extractCountry(vendorAddress);
    const placeOfDelivery = extractByPatterns(fields,[ 'delivery address','ship to','shipping address','lieu de livraison','adresse de livraison' ]) || null;
    const paymentTerms = extractByPatterns(fields,[ 'payment terms','terms','conditions de paiement','echance' ]);
    const vendorIban = extractByPatterns(fields,[ 'iban' ]) || findIBAN(texts);

    // Amounts and charges
    const totalAmount = doc?.total_amount ?? Number(extractByPatterns(fields,[ 'amountdue','invoicetotal','total  payer','montant total','totalpayer','ttc' ]) || NaN);
    const taxAmount = doc?.tax_amount ?? Number(extractByPatterns(fields,[ 'taxamount','totaltax','tva','montant tva' ]) || NaN);
    const netAmount = doc?.net_amount ?? Number(extractByPatterns(fields,[ 'subtotal','net','montant ht','total ht','ht' ]) || NaN);
    const charges = Number(extractByPatterns(fields,[ 'shipping','freight','delivery cost','frais','port','transport','charges' ]) || NaN);
    const totalWeight = Number(extractByPatterns(fields,[ 'total weight','poids total','gross weight total','poids brut total' ]) || NaN);

    const summary = {
      documentId,
      vendor_name: vendorName || null,
      invoice_number: invoiceNumber || null,
      document_date: documentDate,
      vendor_vat: vendorVat || null,
      vendor_country: vendorCountry || null,
      place_of_delivery: placeOfDelivery,
      tax_amount: isNaN(taxAmount as any) ? null : taxAmount,
      net_amount: isNaN(netAmount as any) ? null : netAmount,
      total_amount: isNaN(totalAmount as any) ? null : totalAmount,
      vendor_email: vendorEmail || null,
      vendor_phone: vendorPhone || null,
      order_number: orderNumber || null,
      vendor_iban: vendorIban || null,
      payment_terms: paymentTerms || null,
      vendor_address: vendorAddress || null,
      charges: isNaN(charges as any) ? null : charges,
      total_weight: isNaN(totalWeight as any) ? null : totalWeight,
      currency_code: doc?.currency_code || null
    };

    return NextResponse.json({ success: true, data: summary });
  } catch (error: any) {
    console.error('Summary export error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal error' }, { status: 500 });
  }
}

