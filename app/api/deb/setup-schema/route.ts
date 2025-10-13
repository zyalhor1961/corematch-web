import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyAuth } from '@/lib/auth/middleware';

/**
 * POST /api/deb/setup-schema
 *
 * SECURITY: ADMIN ONLY - Sets up DEB database schema
 * This endpoint executes privileged database operations and should
 * ONLY be accessible to master administrators.
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY FIX: Verify authentication and require MASTER ADMIN
    const { user, error: authError } = await verifyAuth(request);

    if (!user || authError) {
      console.error('❌ Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Authentication required', details: authError },
        { status: 401 }
      );
    }

    // CRITICAL: Only master admin can execute setup operations
    if (!user.isMasterAdmin) {
      console.error('❌ Access denied: Not a master admin:', user.email);
      return NextResponse.json(
        {
          error: 'Access denied: Master administrator privileges required',
          code: 'ADMIN_REQUIRED'
        },
        { status: 403 }
      );
    }

    console.log('✅ Master admin verified:', user.email);
    console.log('Setting up DEB schema...');

    // Create document_links table if it doesn't exist
    await supabaseAdmin.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS document_links (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          linked_document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          link_type VARCHAR(50) NOT NULL DEFAULT 'manual',
          confidence DECIMAL(3,2) DEFAULT 0.5,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_by UUID REFERENCES auth.users(id),
          UNIQUE(document_id, linked_document_id, link_type)
        );
      `
    });

    // Create indexes for better performance
    await supabaseAdmin.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_document_links_document_id ON document_links(document_id);
        CREATE INDEX IF NOT EXISTS idx_document_links_linked_document_id ON document_links(linked_document_id);
        CREATE INDEX IF NOT EXISTS idx_document_links_type ON document_links(link_type);
      `
    });

    // Add some additional columns to document_lines if needed
    await supabaseAdmin.rpc('exec_sql', {
      sql: `
        ALTER TABLE document_lines 
        ADD COLUMN IF NOT EXISTS customs_value_line DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS source_weight TEXT,
        ADD COLUMN IF NOT EXISTS source_hs TEXT,
        ADD COLUMN IF NOT EXISTS bl_links TEXT[],
        ADD COLUMN IF NOT EXISTS pages_source INTEGER[];
      `
    });

    // Add delivery_note_number to documents table
    await supabaseAdmin.rpc('exec_sql', {
      sql: `
        ALTER TABLE documents 
        ADD COLUMN IF NOT EXISTS delivery_note_number VARCHAR(100),
        ADD COLUMN IF NOT EXISTS transport_mode VARCHAR(50),
        ADD COLUMN IF NOT EXISTS transport_document VARCHAR(100);
      `
    });

    console.log('DEB schema setup completed');

    return NextResponse.json({
      success: true,
      message: 'DEB schema setup completed successfully'
    });

  } catch (error) {
    console.error('Schema setup error:', error);
    return NextResponse.json(
      { error: 'Failed to setup schema' },
      { status: 500 }
    );
  }
}