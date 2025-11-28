"""
Dual-Path Ingestion Service
"SQL for Math, Vector for Meaning"

This service implements the three-path routing strategy:
- Path A (Strict): Extract exact numbers → SQL columns
- Path B (Hybrid): Line items → SQL + Vector embeddings
- Path C (Semantic): Context/addresses → Pure vector chunks (SmartChunker)

Updated: Now uses SmartChunker for intelligent document-type-aware chunking.
"""

import os
import re
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from openai import OpenAI
from supabase import create_client, Client

# SmartChunker for polymorphic document chunking
from services.smart_chunker import SmartChunker, EnrichedChunk

logger = logging.getLogger(__name__)

@dataclass
class StrictData:
    """Data that goes directly into SQL columns - never approximated"""
    vendor_name: Optional[str] = None
    vendor_siren: Optional[str] = None
    vendor_siret: Optional[str] = None
    vendor_vat_number: Optional[str] = None
    vendor_iban: Optional[str] = None
    customer_name: Optional[str] = None
    customer_siren: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    due_date: Optional[str] = None
    subtotal_ht: Optional[float] = None
    total_tax: Optional[float] = None
    total_ttc: Optional[float] = None
    currency: str = "EUR"
    payment_terms: Optional[str] = None

@dataclass
class LineItem:
    """Hybrid data: SQL for math, Vector for meaning"""
    description: str
    quantity: float = 1.0
    unit_price: Optional[float] = None
    amount: Optional[float] = None
    tax_rate: Optional[float] = None
    line_number: int = 0

@dataclass
class ContextChunk:
    """Pure semantic data for vector search"""
    content: str
    chunk_type: str  # 'address', 'header', 'footer', 'notes', 'terms'
    page_number: int = 1


class DualPathIngestion:
    """
    Routes invoice data to appropriate storage:
    - Strict fields → SQL columns (for exact queries)
    - Line items → Hybrid table (SQL + Vector)
    - Context → Pure vector chunks (for semantic search)
    """

    def __init__(
        self,
        supabase_url: str = None,
        supabase_key: str = None,
        openai_api_key: str = None
    ):
        self.supabase_url = supabase_url or os.getenv("SUPABASE_URL")
        self.supabase_key = supabase_key or os.getenv("SUPABASE_SERVICE_KEY")
        self.openai_api_key = openai_api_key or os.getenv("OPENAI_API_KEY")

        if self.supabase_url and self.supabase_key:
            self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        else:
            self.supabase = None
            print("⚠️ Supabase not configured - running in mock mode")

        if self.openai_api_key:
            self.openai = OpenAI(api_key=self.openai_api_key)
        else:
            self.openai = None
            print("⚠️ OpenAI not configured - embeddings disabled")

        # Initialize SmartChunker for intelligent document-type-aware chunking
        self.smart_chunker = SmartChunker(openai_api_key=self.openai_api_key)

    def create_embedding(self, text: str) -> List[float]:
        """Create embedding vector for text"""
        if not self.openai or not text:
            return None

        try:
            response = self.openai.embeddings.create(
                model="text-embedding-3-small",
                input=text[:8000]  # Truncate to avoid token limits
            )
            return response.data[0].embedding
        except Exception as e:
            print(f"Embedding error: {e}")
            return None

    def extract_strict_data(self, azure_fields: Dict[str, Any]) -> StrictData:
        """
        PATH A: Extract strict/exact data for SQL columns
        These fields should NEVER be approximated by vector search
        """
        strict = StrictData()

        # Helper to safely extract values
        def get_value(field_name: str, default=None):
            field = azure_fields.get(field_name, {})
            if isinstance(field, dict):
                val = field.get('value', default)
                # Handle currency objects
                if isinstance(val, dict) and 'amount' in val:
                    return val.get('amount')
                return val
            return field if field else default

        # Vendor information
        strict.vendor_name = get_value('VendorName') or get_value('vendor_name')
        strict.vendor_iban = self._extract_iban(azure_fields)
        strict.vendor_siren = self._extract_siren(azure_fields)
        strict.vendor_siret = self._extract_siret(azure_fields)
        strict.vendor_vat_number = get_value('VendorTaxId')

        # Customer information
        strict.customer_name = get_value('CustomerName') or get_value('customer_name')

        # Invoice identification
        strict.invoice_number = get_value('InvoiceId') or get_value('invoice_id')

        # Dates
        strict.invoice_date = get_value('InvoiceDate') or get_value('invoice_date')
        strict.due_date = get_value('DueDate') or get_value('due_date')

        # Financial totals (CRITICAL: must be exact)
        strict.subtotal_ht = get_value('SubTotal') or get_value('net_amount')
        strict.total_tax = get_value('TotalTax') or get_value('tax_amount')
        strict.total_ttc = get_value('InvoiceTotal') or get_value('total_amount')

        # Currency
        invoice_total = azure_fields.get('InvoiceTotal', {})
        if isinstance(invoice_total, dict):
            val = invoice_total.get('value', {})
            if isinstance(val, dict):
                strict.currency = val.get('symbol') or val.get('code') or 'EUR'

        # Payment terms
        strict.payment_terms = get_value('PaymentTerm')

        return strict

    def _extract_iban(self, fields: Dict) -> Optional[str]:
        """Extract IBAN from various possible locations"""
        # Check direct field
        if 'IBAN' in fields:
            return fields['IBAN'].get('value') if isinstance(fields['IBAN'], dict) else fields['IBAN']

        # Search in payment details
        payment = fields.get('PaymentDetails', {})
        if isinstance(payment, dict) and 'value' in payment:
            for item in payment.get('value', []):
                if isinstance(item, dict) and 'IBAN' in item:
                    return item['IBAN'].get('value')

        return None

    def _extract_siren(self, fields: Dict) -> Optional[str]:
        """Extract SIREN (9 digits) from text"""
        # Look in vendor address or raw text
        for field_name in ['VendorAddress', 'VendorAddressRecipient']:
            field = fields.get(field_name, {})
            content = field.get('content', '') if isinstance(field, dict) else str(field)
            # SIREN is 9 consecutive digits
            match = re.search(r'\bSIREN[:\s]*(\d{9})\b', content, re.IGNORECASE)
            if match:
                return match.group(1)
        return None

    def _extract_siret(self, fields: Dict) -> Optional[str]:
        """Extract SIRET (14 digits) from text"""
        for field_name in ['VendorAddress', 'VendorAddressRecipient']:
            field = fields.get(field_name, {})
            content = field.get('content', '') if isinstance(field, dict) else str(field)
            # SIRET is 14 consecutive digits
            match = re.search(r'\bSIRET[:\s]*(\d{14})\b', content, re.IGNORECASE)
            if match:
                return match.group(1)
        return None

    def _match_supplier(self, org_id: str, vendor_siren: Optional[str], vendor_siret: Optional[str]) -> Optional[str]:
        """
        Match invoice vendor to existing supplier by SIREN or SIRET.
        Returns supplier_id if found, None otherwise.
        """
        if not self.supabase or not org_id:
            return None

        # Try SIREN match first (9 digits)
        if vendor_siren:
            try:
                result = self.supabase.table('erp_suppliers')\
                    .select('id')\
                    .eq('org_id', org_id)\
                    .eq('siren', vendor_siren)\
                    .limit(1)\
                    .execute()
                if result.data:
                    print(f"    ✅ Supplier matched by SIREN: {vendor_siren}")
                    return result.data[0]['id']
            except Exception as e:
                print(f"    ⚠️ SIREN lookup error: {e}")

        # Try SIRET match (14 digits)
        if vendor_siret:
            try:
                result = self.supabase.table('erp_suppliers')\
                    .select('id')\
                    .eq('org_id', org_id)\
                    .eq('siret', vendor_siret)\
                    .limit(1)\
                    .execute()
                if result.data:
                    print(f"    ✅ Supplier matched by SIRET: {vendor_siret}")
                    return result.data[0]['id']
            except Exception as e:
                print(f"    ⚠️ SIRET lookup error: {e}")

            # Also try extracting SIREN from SIRET (first 9 digits) for fallback
            if len(vendor_siret) == 14 and not vendor_siren:
                extracted_siren = vendor_siret[:9]
                try:
                    result = self.supabase.table('erp_suppliers')\
                        .select('id')\
                        .eq('org_id', org_id)\
                        .eq('siren', extracted_siren)\
                        .limit(1)\
                        .execute()
                    if result.data:
                        print(f"    ✅ Supplier matched by SIREN (from SIRET): {extracted_siren}")
                        return result.data[0]['id']
                except Exception as e:
                    print(f"    ⚠️ SIREN from SIRET lookup error: {e}")

        return None

    def extract_line_items(self, azure_fields: Dict[str, Any]) -> List[LineItem]:
        """
        PATH B: Extract line items for hybrid storage
        SQL columns for math, Vector embedding for semantic search
        """
        items = []
        items_field = azure_fields.get('Items', {})

        if isinstance(items_field, dict):
            items_list = items_field.get('value', [])
        else:
            items_list = items_field if isinstance(items_field, list) else []

        for idx, item in enumerate(items_list):
            if isinstance(item, dict):
                item_value = item.get('value', item)
                if isinstance(item_value, dict):
                    line = LineItem(
                        description=self._get_nested_value(item_value, 'Description', ''),
                        quantity=float(self._get_nested_value(item_value, 'Quantity', 1) or 1),
                        unit_price=self._safe_float(self._get_nested_value(item_value, 'UnitPrice')),
                        amount=self._safe_float(self._get_nested_value(item_value, 'Amount')),
                        tax_rate=self._safe_float(self._get_nested_value(item_value, 'Tax')),
                        line_number=idx + 1
                    )
                    if line.description:
                        items.append(line)

        return items

    def _get_nested_value(self, obj: Dict, key: str, default=None):
        """Safely get nested value from Azure field structure"""
        if key not in obj:
            return default
        field = obj[key]
        if isinstance(field, dict):
            val = field.get('value', default)
            # Handle currency objects like {code: 'USD', amount: 20.0, symbol: '$'}
            if isinstance(val, dict) and 'amount' in val:
                return val.get('amount')
            return val
        # Handle direct currency objects at field level
        if isinstance(field, dict) and 'amount' in field:
            return field.get('amount')
        return field

    def _safe_float(self, value) -> Optional[float]:
        """Safely convert to float"""
        if value is None:
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None

    def extract_context_chunks(
        self,
        azure_fields: Dict[str, Any],
        page_content: str = None
    ) -> List[ContextChunk]:
        """
        PATH C: Extract context for pure semantic storage
        Addresses, headers, footers, terms - anything not structured
        """
        chunks = []

        # Vendor Address
        vendor_addr = azure_fields.get('VendorAddress', {})
        if vendor_addr:
            content = vendor_addr.get('content') if isinstance(vendor_addr, dict) else str(vendor_addr)
            if content:
                chunks.append(ContextChunk(
                    content=f"Vendor Address: {content}",
                    chunk_type='address',
                    page_number=vendor_addr.get('page', 1) if isinstance(vendor_addr, dict) else 1
                ))

        # Customer Address
        customer_addr = azure_fields.get('CustomerAddress', {}) or azure_fields.get('BillingAddress', {})
        if customer_addr:
            content = customer_addr.get('content') if isinstance(customer_addr, dict) else str(customer_addr)
            if content:
                chunks.append(ContextChunk(
                    content=f"Customer Address: {content}",
                    chunk_type='address',
                    page_number=customer_addr.get('page', 1) if isinstance(customer_addr, dict) else 1
                ))

        # Shipping Address (if different)
        ship_addr = azure_fields.get('ShippingAddress', {})
        if ship_addr:
            content = ship_addr.get('content') if isinstance(ship_addr, dict) else str(ship_addr)
            if content:
                chunks.append(ContextChunk(
                    content=f"Shipping Address: {content}",
                    chunk_type='address',
                    page_number=ship_addr.get('page', 1) if isinstance(ship_addr, dict) else 1
                ))

        # Payment Terms / Notes
        for field_name in ['PaymentTerm', 'Notes', 'ServiceAddress']:
            field = azure_fields.get(field_name, {})
            if field:
                content = field.get('content') if isinstance(field, dict) else str(field)
                if content and len(content) > 10:
                    chunks.append(ContextChunk(
                        content=content,
                        chunk_type='terms' if 'Payment' in field_name else 'notes',
                        page_number=field.get('page', 1) if isinstance(field, dict) else 1
                    ))

        return chunks

    def smart_chunk_document(
        self,
        doc_type: str,
        azure_fields: Dict[str, Any],
        full_text: str = None,
        filename: str = None
    ) -> List[EnrichedChunk]:
        """
        PATH C (Enhanced): Use SmartChunker for intelligent document chunking.

        Selects chunking strategy based on document type:
        - INVOICE/QUOTATION: Preserve tables as single chunks
        - CONTRACT: Semantic chunking respecting clause boundaries
        - CV/RESUME: Header-based section splitting
        - GENERIC: Recursive character splitting

        Args:
            doc_type: Document type (INVOICE, CONTRACT, CV, etc.)
            azure_fields: Extracted fields from Azure Document Intelligence
            full_text: Full document text (if available)
            filename: Original filename for metadata

        Returns:
            List of EnrichedChunks ready for embedding
        """
        # Build metadata for chunk enrichment
        metadata = {
            "filename": filename,
        }

        # Extract metadata from Azure fields
        vendor_field = azure_fields.get('VendorName') or azure_fields.get('vendor_name')
        if isinstance(vendor_field, dict):
            metadata['vendor'] = vendor_field.get('value', 'Unknown')
        elif vendor_field:
            metadata['vendor'] = vendor_field

        date_field = azure_fields.get('InvoiceDate') or azure_fields.get('invoice_date')
        if isinstance(date_field, dict):
            metadata['date'] = date_field.get('value', 'Unknown')
        elif date_field:
            metadata['date'] = date_field

        invoice_num = azure_fields.get('InvoiceId') or azure_fields.get('invoice_id')
        if isinstance(invoice_num, dict):
            metadata['invoice_number'] = invoice_num.get('value')
        elif invoice_num:
            metadata['invoice_number'] = invoice_num

        total_field = azure_fields.get('InvoiceTotal') or azure_fields.get('total_amount')
        if isinstance(total_field, dict):
            val = total_field.get('value')
            if isinstance(val, dict) and 'amount' in val:
                metadata['total_amount'] = val.get('amount')
            else:
                metadata['total_amount'] = val
        elif total_field:
            metadata['total_amount'] = total_field

        # Build full text from pages if not provided
        if not full_text:
            pages_meta = azure_fields.get('_metadata', {}).get('pages', [])
            if pages_meta:
                text_parts = []
                for page in pages_meta:
                    for line in page.get('lines', []):
                        text_parts.append(line.get('content', ''))
                full_text = '\n'.join(text_parts)

        # Fallback: concatenate field contents
        if not full_text:
            text_parts = []
            for key, value in azure_fields.items():
                if key.startswith('_'):
                    continue
                if isinstance(value, dict):
                    content = value.get('content') or value.get('value')
                    if content and isinstance(content, str):
                        text_parts.append(content)
                elif isinstance(value, str):
                    text_parts.append(value)
            full_text = '\n'.join(text_parts)

        if not full_text:
            logger.warning("No text available for smart chunking")
            return []

        # Extract tables from Azure data for financial documents
        azure_tables = None
        items_field = azure_fields.get('Items', {})
        if isinstance(items_field, dict) and items_field.get('value'):
            # Convert line items to table format for SmartChunker
            items = items_field.get('value', [])
            if items:
                azure_tables = [{
                    'cells': [],
                    'row_count': len(items) + 1,  # +1 for header
                    'column_count': 4,
                    'page_number': 1
                }]
                # Build cells from line items
                # Header row
                headers = ['Description', 'Quantity', 'Unit Price', 'Amount']
                for col_idx, header in enumerate(headers):
                    azure_tables[0]['cells'].append({
                        'row_index': 0,
                        'column_index': col_idx,
                        'content': header
                    })
                # Data rows
                for row_idx, item in enumerate(items):
                    item_val = item.get('value', item) if isinstance(item, dict) else {}
                    if isinstance(item_val, dict):
                        desc = self._get_nested_value(item_val, 'Description', '')
                        qty = self._get_nested_value(item_val, 'Quantity', '')
                        unit = self._get_nested_value(item_val, 'UnitPrice', '')
                        amt = self._get_nested_value(item_val, 'Amount', '')

                        for col_idx, val in enumerate([desc, qty, unit, amt]):
                            azure_tables[0]['cells'].append({
                                'row_index': row_idx + 1,
                                'column_index': col_idx,
                                'content': str(val) if val else ''
                            })

        # Use SmartChunker with document type routing
        chunks = self.smart_chunker.route_and_chunk(
            doc_type=doc_type or 'GENERIC',
            text=full_text,
            azure_data={'tables': azure_tables, **azure_fields} if azure_tables else azure_fields,
            metadata=metadata
        )

        logger.info(f"SmartChunker produced {len(chunks)} chunks for {doc_type}")
        return chunks

    def ingest_invoice(
        self,
        invoice_id: str,
        azure_fields: Dict[str, Any],
        page_content: str = None,
        org_id: str = None,
        doc_type: str = "INVOICE",
        filename: str = None
    ) -> Dict[str, Any]:
        """
        Main ingestion method: Routes data through all three paths

        Args:
            invoice_id: UUID of the invoice record
            azure_fields: Extracted fields from Azure Document Intelligence
            page_content: Full text content (optional)
            org_id: Organization ID for supplier matching
            doc_type: Document type for smart chunking (INVOICE, CONTRACT, etc.)
            filename: Original filename for metadata enrichment
        """
        print(f"🔄 Starting Dual-Path Ingestion for invoice {invoice_id}")
        results = {
            'strict_updated': False,
            'line_items_count': 0,
            'context_chunks_count': 0,
            'supplier_matched': False,
            'supplier_id': None,
            'errors': []
        }

        if not self.supabase:
            results['errors'].append("Supabase not configured")
            return results

        try:
            # PATH A: Strict Data → SQL Columns
            print("  📊 Path A: Extracting strict data...")
            strict = self.extract_strict_data(azure_fields)
            strict_dict = {k: v for k, v in strict.__dict__.items() if v is not None}

            # For inbound invoices, also set client_name = vendor_name for display purposes
            # (client_name shows "who the invoice is from" in the list view)
            if strict_dict.get('vendor_name'):
                strict_dict['client_name'] = strict_dict['vendor_name']

            # Map to duplicate columns for backward compatibility
            if strict_dict.get('invoice_date'):
                strict_dict['date_issued'] = strict_dict['invoice_date']
            if strict_dict.get('total_ttc'):
                strict_dict['total_amount'] = strict_dict['total_ttc']

            # Keep invoice_number - composite unique constraint (org_id, invoice_type, invoice_number)
            # allows same number across different types/orgs
            # Only remove if it would cause issues (e.g., empty string)
            if strict_dict.get('invoice_number') == '':
                strict_dict.pop('invoice_number', None)

            if strict_dict:
                try:
                    self.supabase.table('invoices').update(strict_dict).eq('id', invoice_id).execute()
                    results['strict_updated'] = True
                    print(f"    ✅ Updated {len(strict_dict)} strict fields")
                except Exception as update_err:
                    error_msg = str(update_err)
                    # Handle duplicate invoice_number by removing it and retrying
                    if '23505' in error_msg and 'invoice_number' in error_msg:
                        print(f"    ⚠️ Duplicate invoice_number detected, skipping invoice_number update")
                        strict_dict.pop('invoice_number', None)
                        if strict_dict:
                            self.supabase.table('invoices').update(strict_dict).eq('id', invoice_id).execute()
                            results['strict_updated'] = True
                            print(f"    ✅ Updated {len(strict_dict)} strict fields (without invoice_number)")
                    else:
                        raise update_err

            # SUPPLIER MATCHING: Auto-link to existing supplier by SIREN/SIRET
            if org_id:
                print("  🔗 Supplier Matching: Looking for existing supplier...")
                supplier_id = self._match_supplier(
                    org_id,
                    strict.vendor_siren,
                    strict.vendor_siret
                )
                if supplier_id:
                    # Auto-link invoice to supplier
                    self.supabase.table('invoices').update({'supplier_id': supplier_id}).eq('id', invoice_id).execute()
                    results['supplier_matched'] = True
                    results['supplier_id'] = supplier_id
                    print(f"    ✅ Invoice auto-linked to supplier: {supplier_id}")
                else:
                    print(f"    ℹ️ No matching supplier found for SIREN={strict.vendor_siren} SIRET={strict.vendor_siret}")
            else:
                print("  ⚠️ No org_id provided, skipping supplier matching")

            # PATH B: Line Items → Hybrid Storage
            print("  📦 Path B: Extracting line items...")
            line_items = self.extract_line_items(azure_fields)

            # Delete existing line items for this invoice
            self.supabase.table('invoice_lines').delete().eq('invoice_id', invoice_id).execute()

            for item in line_items:
                # Create embedding for the description
                embedding = self.create_embedding(item.description) if item.description else None

                line_data = {
                    'invoice_id': invoice_id,
                    'description': item.description,
                    'quantity': item.quantity,
                    'unit_price': item.unit_price,
                    'amount': item.amount,
                    'tax_rate': item.tax_rate,
                    'line_number': item.line_number,
                }

                if embedding:
                    line_data['embedding'] = embedding

                self.supabase.table('invoice_lines').insert(line_data).execute()
                results['line_items_count'] += 1

            print(f"    ✅ Inserted {results['line_items_count']} line items with embeddings")

            # PATH C: Context → Smart Semantic Chunks (using SmartChunker)
            print(f"  📝 Path C: Smart chunking ({doc_type})...")

            # Use SmartChunker for intelligent document-type-aware chunking
            smart_chunks = self.smart_chunk_document(
                doc_type=doc_type,
                azure_fields=azure_fields,
                full_text=page_content,
                filename=filename
            )

            # Delete existing chunks for this invoice
            self.supabase.table('invoice_context_chunks').delete().eq('invoice_id', invoice_id).execute()

            for chunk in smart_chunks:
                # Create embedding for the enriched content (includes metadata header)
                embedding = self.create_embedding(chunk.content)

                chunk_data = {
                    'invoice_id': invoice_id,
                    'content': chunk.content,  # Enriched content with [Doc: X | Vendor: Y] header
                    'chunk_type': chunk.chunk_type,  # 'table', 'text', 'clause', 'section'
                    'page_number': chunk.page_number,
                }

                # Store raw content separately for display purposes
                if chunk.raw_content != chunk.content:
                    chunk_data['raw_content'] = chunk.raw_content

                if embedding:
                    chunk_data['embedding'] = embedding

                self.supabase.table('invoice_context_chunks').insert(chunk_data).execute()
                results['context_chunks_count'] += 1

            # Log chunk type distribution
            chunk_types = {}
            for c in smart_chunks:
                chunk_types[c.chunk_type] = chunk_types.get(c.chunk_type, 0) + 1
            print(f"    ✅ Inserted {results['context_chunks_count']} smart chunks: {chunk_types}")

        except Exception as e:
            print(f"  ❌ Ingestion error: {e}")
            results['errors'].append(str(e))

        print(f"✅ Dual-Path Ingestion complete: {results}")
        return results


# Convenience function for integration with agent_graph.py
def process_dual_path(
    invoice_id: str,
    azure_fields: Dict[str, Any],
    org_id: str = None,
    doc_type: str = "INVOICE",
    filename: str = None
) -> Dict[str, Any]:
    """
    Process invoice through dual-path ingestion with smart chunking.

    Args:
        invoice_id: UUID of the invoice record
        azure_fields: Extracted fields from Azure Document Intelligence
        org_id: Organization ID for supplier matching
        doc_type: Document type for smart chunking (INVOICE, CONTRACT, etc.)
        filename: Original filename for metadata enrichment

    Returns:
        Dict with ingestion results (line_items_count, context_chunks_count, etc.)
    """
    ingestion = DualPathIngestion()
    return ingestion.ingest_invoice(
        invoice_id,
        azure_fields,
        org_id=org_id,
        doc_type=doc_type,
        filename=filename
    )
