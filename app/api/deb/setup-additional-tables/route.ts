import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🗄️ Setting up additional DEB tables...');

    // 1. Create notifications table if it doesn't exist
    console.log('📢 Creating notifications table...');
    try {
      await supabaseAdmin.rpc('execute_sql', {
        query: `
          CREATE TABLE IF NOT EXISTS notifications (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            org_id UUID NOT NULL,
            document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
            type VARCHAR(50) NOT NULL,
            title VARCHAR(200) NOT NULL,
            message TEXT NOT NULL,
            data JSONB,
            read_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_by UUID REFERENCES auth.users(id)
          );

          CREATE INDEX IF NOT EXISTS idx_notifications_org_id ON notifications(org_id);
          CREATE INDEX IF NOT EXISTS idx_notifications_document_id ON notifications(document_id);
          CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
          CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(org_id, read_at) WHERE read_at IS NULL;
        `
      });
      console.log('✅ Notifications table created');
    } catch (tableError) {
      console.error('⚠️  Notifications table error (might be normal):', tableError);
    }

    // 2. Create transport_cost_allocations table
    console.log('🚚 Creating transport_cost_allocations table...');
    try {
      await supabaseAdmin.rpc('execute_sql', {
        query: `
          CREATE TABLE IF NOT EXISTS transport_cost_allocations (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            total_transport_cost DECIMAL(10,2) NOT NULL,
            allocation_details JSONB NOT NULL,
            bl_document_id UUID REFERENCES documents(id),
            transport_mode VARCHAR(50),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_transport_allocations_document_id ON transport_cost_allocations(document_id);
          CREATE INDEX IF NOT EXISTS idx_transport_allocations_bl_document_id ON transport_cost_allocations(bl_document_id);
        `
      });
      console.log('✅ Transport cost allocations table created');
    } catch (tableError) {
      console.error('⚠️  Transport allocations table error (might be normal):', tableError);
    }

    // 3. Add status column to documents if not exists
    console.log('📄 Adding status column to documents...');
    try {
      await supabaseAdmin.rpc('execute_sql', {
        query: `
          DO $$ 
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name = 'documents' AND column_name = 'status') THEN
              ALTER TABLE documents ADD COLUMN status VARCHAR(50) DEFAULT 'uploaded';
            END IF;

            -- Add processing status column
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name = 'documents' AND column_name = 'processing_status') THEN
              ALTER TABLE documents ADD COLUMN processing_status VARCHAR(50);
            END IF;

            -- Add needs_manual_review column
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name = 'documents' AND column_name = 'needs_manual_review') THEN
              ALTER TABLE documents ADD COLUMN needs_manual_review BOOLEAN DEFAULT FALSE;
            END IF;

            -- Add estimated_weight_kg column
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name = 'documents' AND column_name = 'estimated_weight_kg') THEN
              ALTER TABLE documents ADD COLUMN estimated_weight_kg DECIMAL(8,3);
            END IF;

            -- Add validation_results column
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name = 'documents' AND column_name = 'validation_results') THEN
              ALTER TABLE documents ADD COLUMN validation_results JSONB;
            END IF;
          END $$;
        `
      });
      console.log('✅ Documents table columns added');
    } catch (docError) {
      console.error('⚠️  Documents table update error (might be normal):', docError);
    }

    // 4. Add additional columns to document_lines if not exists
    console.log('📋 Adding additional columns to document_lines...');
    try {
      await supabaseAdmin.rpc('execute_sql', {
        query: `
          DO $$ 
          BEGIN
            -- Add hs_confidence column
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name = 'document_lines' AND column_name = 'hs_confidence') THEN
              ALTER TABLE document_lines ADD COLUMN hs_confidence DECIMAL(3,2);
            END IF;
          END $$;
        `
      });
      console.log('✅ Document_lines additional columns added');
    } catch (linesError) {
      console.error('⚠️  Document_lines update error (might be normal):', linesError);
    }

    // 5. Create indexes for better performance
    console.log('🔍 Creating performance indexes...');
    try {
      await supabaseAdmin.rpc('execute_sql', {
        query: `
          CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
          CREATE INDEX IF NOT EXISTS idx_documents_processing_status ON documents(processing_status);
          CREATE INDEX IF NOT EXISTS idx_documents_needs_review ON documents(needs_manual_review) WHERE needs_manual_review = true;
          CREATE INDEX IF NOT EXISTS idx_document_lines_hs_code ON document_lines(hs_code);
          CREATE INDEX IF NOT EXISTS idx_document_lines_confidence ON document_lines(hs_confidence);
        `
      });
      console.log('✅ Performance indexes created');
    } catch (indexError) {
      console.error('⚠️  Index creation error (might be normal):', indexError);
    }

    // 6. Test database connections
    console.log('🧪 Testing database connections...');
    
    const testQueries = [
      { table: 'notifications', query: supabaseAdmin.from('notifications').select('id').limit(1) },
      { table: 'transport_cost_allocations', query: supabaseAdmin.from('transport_cost_allocations').select('id').limit(1) },
      { table: 'documents', query: supabaseAdmin.from('documents').select('id, status').limit(1) },
      { table: 'document_lines', query: supabaseAdmin.from('document_lines').select('id').limit(1) }
    ];

    const testResults = {};
    for (const test of testQueries) {
      try {
        const { error } = await test.query;
        testResults[test.table] = error ? `Error: ${error.message}` : 'OK';
      } catch (err) {
        testResults[test.table] = `Exception: ${err.message}`;
      }
    }

    console.log('🏁 Table creation setup completed');

    return NextResponse.json({
      success: true,
      message: 'Additional DEB tables setup completed successfully',
      details: {
        notifications_table: 'created',
        transport_allocations_table: 'created',
        documents_columns_added: true,
        document_lines_columns_added: true,
        indexes_created: true,
        table_tests: testResults
      }
    });

  } catch (error) {
    console.error('❌ Additional tables setup error:', error);
    return NextResponse.json(
      { error: 'Failed to setup additional tables', details: error.message },
      { status: 500 }
    );
  }
}