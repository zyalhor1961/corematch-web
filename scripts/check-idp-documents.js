/**
 * Check IDP Documents in Database
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDocuments() {
  console.log('📊 Checking IDP Documents...\n');

  // Check idp_documents table
  const { data: docs, error: docsError, count } = await supabase
    .from('idp_documents')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(10);

  if (docsError) {
    console.error('❌ Error querying documents:', docsError);
    return;
  }

  console.log(`📄 Found ${count} total documents in idp_documents table\n`);

  if (docs && docs.length > 0) {
    console.log('Latest documents:');
    docs.forEach((doc, idx) => {
      console.log(`\n${idx + 1}. ${doc.filename}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Type: ${doc.document_type}`);
      console.log(`   Status: ${doc.status}`);
      console.log(`   Org: ${doc.org_id}`);
      console.log(`   Created: ${doc.created_at}`);
      if (doc.vendor_name) console.log(`   Vendor: ${doc.vendor_name}`);
      if (doc.total_amount) console.log(`   Amount: ${doc.total_amount} ${doc.currency_code}`);
    });
  } else {
    console.log('⚠️  No documents found in database');
    console.log('\nTo upload a document, use the Upload button in the dashboard');
    console.log('Or test the upload API directly');
  }

  // Check storage bucket
  console.log('\n\n📦 Checking Storage Bucket...\n');
  const { data: buckets, error: bucketsError } = await supabase
    .storage
    .listBuckets();

  if (bucketsError) {
    console.error('❌ Error listing buckets:', bucketsError);
  } else {
    const idpBucket = buckets.find(b => b.name === 'idp-documents');
    if (idpBucket) {
      console.log('✅ idp-documents bucket exists');
      console.log(`   Public: ${idpBucket.public}`);

      // List files in bucket
      const { data: files, error: filesError } = await supabase
        .storage
        .from('idp-documents')
        .list('', { limit: 10 });

      if (filesError) {
        console.error('❌ Error listing files:', filesError);
      } else {
        console.log(`\n   Files in bucket: ${files.length}`);
        files.forEach((file, idx) => {
          console.log(`   ${idx + 1}. ${file.name}`);
        });
      }
    } else {
      console.log('❌ idp-documents bucket NOT found');
      console.log('\n⚠️  Please create the bucket:');
      console.log('   1. Go to Supabase Dashboard > Storage');
      console.log('   2. Click "New Bucket"');
      console.log('   3. Name: idp-documents');
      console.log('   4. Set to Public or configure RLS');
    }
  }

  // Check extracted fields
  const { data: fields, error: fieldsError, count: fieldsCount } = await supabase
    .from('idp_extracted_fields')
    .select('*', { count: 'exact' })
    .limit(5);

  console.log(`\n\n🔍 Extracted Fields: ${fieldsCount || 0} total`);

  if (fields && fields.length > 0) {
    fields.forEach((field, idx) => {
      console.log(`${idx + 1}. ${field.field_name}: ${field.value_text} (${(field.confidence * 100).toFixed(0)}%)`);
    });
  }
}

checkDocuments();
