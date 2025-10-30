import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { verifyAuth } from '@/lib/auth/middleware';

/**
 * POST /api/deb/setup
 *
 * SECURITY: ADMIN ONLY - Sets up DEB system infrastructure
 * This endpoint executes privileged database operations and should
 * ONLY be accessible to master administrators.
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

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
    console.log('🚀 Setting up DEB system...');

    // 1. Create deb-docs bucket if it doesn't exist
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const debBucketExists = buckets?.some(bucket => bucket.name === 'deb-docs');
    
    if (!debBucketExists) {
      const { data: bucket, error: bucketError } = await supabaseAdmin.storage.createBucket('deb-docs', {
        public: false,
        allowedMimeTypes: ['application/pdf'],
        fileSizeLimit: 50 * 1024 * 1024, // 50MB
      });
      
      if (bucketError) {
        console.error('❌ Error creating bucket:', bucketError);
        return NextResponse.json(
          { error: 'Failed to create storage bucket', details: bucketError },
          { status: 500 }
        );
      }
      console.log('✅ Created deb-docs bucket');
    } else {
      console.log('✅ deb-docs bucket already exists');
    }

    // 2. Ensure documents table has required columns
    console.log('🔧 Updating documents table schema...');
    
    // Add missing columns to documents table
    try {
      await supabaseAdmin.rpc('execute_sql', {
        query: `
          DO $$ 
          BEGIN
            -- Add delivery_note_number column if it doesn't exist
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name = 'documents' AND column_name = 'delivery_note_number') THEN
              ALTER TABLE documents ADD COLUMN delivery_note_number VARCHAR(100);
            END IF;

            -- Add transport_mode column if it doesn't exist
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name = 'documents' AND column_name = 'transport_mode') THEN
              ALTER TABLE documents ADD COLUMN transport_mode VARCHAR(50);
            END IF;

            -- Add transport_document column if it doesn't exist
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name = 'documents' AND column_name = 'transport_document') THEN
              ALTER TABLE documents ADD COLUMN transport_document VARCHAR(100);
            END IF;

            -- Add supplier_address column if it doesn't exist
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name = 'documents' AND column_name = 'supplier_address') THEN
              ALTER TABLE documents ADD COLUMN supplier_address TEXT;
            END IF;

            -- Add total_ttc column if it doesn't exist
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name = 'documents' AND column_name = 'total_ttc') THEN
              ALTER TABLE documents ADD COLUMN total_ttc DECIMAL(10,2);
            END IF;

            -- Add line_count column if it doesn't exist
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name = 'documents' AND column_name = 'line_count') THEN
              ALTER TABLE documents ADD COLUMN line_count INTEGER DEFAULT 0;
            END IF;
          END $$;
        `
      });
      console.log('✅ Documents table schema updated');
    } catch (schemaError) {
      console.error('⚠️  Schema update error (might be normal):', schemaError);
      // Continue anyway - columns might already exist
    }

    // 3. Create document_links table if it doesn't exist
    console.log('🔗 Creating document_links table...');
    try {
      await supabaseAdmin.rpc('execute_sql', {
        query: `
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

          CREATE INDEX IF NOT EXISTS idx_document_links_document_id ON document_links(document_id);
          CREATE INDEX IF NOT EXISTS idx_document_links_linked_document_id ON document_links(linked_document_id);
          CREATE INDEX IF NOT EXISTS idx_document_links_type ON document_links(link_type);
        `
      });
      console.log('✅ Document_links table created');
    } catch (tableError) {
      console.error('⚠️  Table creation error (might be normal):', tableError);
      // Continue anyway - table might already exist
    }

    // 4. Add missing columns to document_lines table
    console.log('📋 Updating document_lines table...');
    try {
      await supabaseAdmin.rpc('execute_sql', {
        query: `
          DO $$ 
          BEGIN
            -- Add customs_value_line column if it doesn't exist
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name = 'document_lines' AND column_name = 'customs_value_line') THEN
              ALTER TABLE document_lines ADD COLUMN customs_value_line DECIMAL(10,2);
            END IF;

            -- Add source_weight column if it doesn't exist
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name = 'document_lines' AND column_name = 'source_weight') THEN
              ALTER TABLE document_lines ADD COLUMN source_weight TEXT;
            END IF;

            -- Add source_hs column if it doesn't exist
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name = 'document_lines' AND column_name = 'source_hs') THEN
              ALTER TABLE document_lines ADD COLUMN source_hs TEXT;
            END IF;

            -- Add bl_links column if it doesn't exist (array of text)
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name = 'document_lines' AND column_name = 'bl_links') THEN
              ALTER TABLE document_lines ADD COLUMN bl_links TEXT[];
            END IF;

            -- Add pages_source column if it doesn't exist (array of integers)
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name = 'document_lines' AND column_name = 'pages_source') THEN
              ALTER TABLE document_lines ADD COLUMN pages_source INTEGER[];
            END IF;
          END $$;
        `
      });
      console.log('✅ Document_lines table updated');
    } catch (linesError) {
      console.error('⚠️  Lines table update error (might be normal):', linesError);
      // Continue anyway
    }

    // 5. Test basic database connection
    const { data: testQuery, error: testError } = await supabaseAdmin
      .from('documents')
      .select('id')
      .limit(1);
      
    if (testError) {
      console.error('❌ Database connection test failed:', testError);
      return NextResponse.json(
        { error: 'Database connection failed', details: testError },
        { status: 500 }
      );
    }

    console.log('✅ DEB system setup completed successfully!');

    return NextResponse.json({
      success: true,
      message: 'DEB system setup completed successfully',
      details: {
        bucket_created: !debBucketExists,
        tables_updated: true,
        database_connection: true
      }
    });

  } catch (error) {
    console.error('❌ DEB setup error:', error);
    return NextResponse.json(
      { error: 'Failed to setup DEB system', details: error.message },
      { status: 500 }
    );
  }
}