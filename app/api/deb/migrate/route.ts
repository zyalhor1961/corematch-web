import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Migrating DEB documents schema...');

    // Create a new table for DEB documents with the correct structure
    await supabaseAdmin.rpc('execute_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS deb_documents (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          org_id UUID NOT NULL,
          doc_type VARCHAR(50) DEFAULT 'invoice' CHECK (doc_type IN ('invoice', 'delivery_note', 'mixed')),
          file_path TEXT,
          filename VARCHAR(255),
          supplier_name VARCHAR(255),
          supplier_vat VARCHAR(50),
          supplier_country VARCHAR(2),
          supplier_address TEXT,
          invoice_number VARCHAR(100),
          invoice_date DATE,
          delivery_note_number VARCHAR(100),
          currency VARCHAR(3) DEFAULT 'EUR',
          incoterm VARCHAR(10),
          transport_mode VARCHAR(50),
          transport_document VARCHAR(100),
          total_ht DECIMAL(10,2),
          total_ttc DECIMAL(10,2),
          shipping_total DECIMAL(10,2),
          status VARCHAR(50) DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'parsed', 'enriched', 'needs_review', 'approved', 'exported', 'error')),
          export_url TEXT,
          pages_count INTEGER DEFAULT 0,
          line_count INTEGER DEFAULT 0,
          confidence_avg DECIMAL(3,2),
          created_by UUID,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_deb_documents_org_id ON deb_documents(org_id);
        CREATE INDEX IF NOT EXISTS idx_deb_documents_status ON deb_documents(status);
        CREATE INDEX IF NOT EXISTS idx_deb_documents_supplier ON deb_documents(supplier_name);
        CREATE INDEX IF NOT EXISTS idx_deb_documents_created_at ON deb_documents(created_at);
        
        -- Create related tables
        CREATE TABLE IF NOT EXISTS deb_document_pages (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          document_id UUID NOT NULL REFERENCES deb_documents(id) ON DELETE CASCADE,
          page_no INTEGER NOT NULL,
          type VARCHAR(50) DEFAULT 'other' CHECK (type IN ('invoice', 'delivery_note', 'other')),
          confidence DECIMAL(3,2),
          raw_ocr_data JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS deb_document_lines (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          document_id UUID NOT NULL REFERENCES deb_documents(id) ON DELETE CASCADE,
          line_no INTEGER NOT NULL,
          description TEXT,
          sku VARCHAR(100),
          qty DECIMAL(10,3),
          unit VARCHAR(20),
          unit_price DECIMAL(10,2),
          line_amount DECIMAL(10,2),
          hs_code VARCHAR(20),
          country_of_origin VARCHAR(2),
          net_mass_kg DECIMAL(10,3),
          shipping_allocated DECIMAL(10,2),
          customs_value_line DECIMAL(10,2),
          source_weight TEXT,
          source_hs TEXT,
          bl_links TEXT[],
          pages_source INTEGER[],
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS deb_document_links (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          document_id UUID NOT NULL REFERENCES deb_documents(id) ON DELETE CASCADE,
          linked_document_id UUID NOT NULL REFERENCES deb_documents(id) ON DELETE CASCADE,
          link_type VARCHAR(50) NOT NULL DEFAULT 'manual' CHECK (link_type IN ('bl_invoice_match', 'manual', 'auto_detected')),
          confidence DECIMAL(3,2) DEFAULT 0.5,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_by UUID,
          UNIQUE(document_id, linked_document_id, link_type)
        );

        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_deb_document_pages_document_id ON deb_document_pages(document_id);
        CREATE INDEX IF NOT EXISTS idx_deb_document_lines_document_id ON deb_document_lines(document_id);
        CREATE INDEX IF NOT EXISTS idx_deb_document_links_document_id ON deb_document_links(document_id);
        CREATE INDEX IF NOT EXISTS idx_deb_document_links_linked_document_id ON deb_document_links(linked_document_id);
      `
    });

    console.log('✅ DEB documents schema created successfully');

    return NextResponse.json({
      success: true,
      message: 'DEB documents schema migrated successfully'
    });

  } catch (error) {
    console.error('❌ Migration error:', error);
    return NextResponse.json(
      { error: 'Failed to migrate schema', details: error.message },
      { status: 500 }
    );
  }
}