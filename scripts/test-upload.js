/**
 * Test IDP Upload Workflow
 *
 * This script tests the complete upload -> analyze -> store workflow
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testUploadWorkflow() {
  console.log('🧪 Testing IDP Upload Workflow\n');

  // Step 1: Create a test file
  const testFilePath = path.join(__dirname, 'test-invoice.pdf');

  if (!fs.existsSync(testFilePath)) {
    console.log('⚠️  Test file not found. Please place a PDF file at:', testFilePath);
    console.log('   Or specify a different file path.');
    return;
  }

  console.log('📄 Test file:', testFilePath);
  const fileBuffer = fs.readFileSync(testFilePath);
  const fileName = 'test-invoice.pdf';

  // Step 2: Upload to storage
  console.log('\n📦 Step 1: Uploading to storage...');
  const timestamp = Date.now();
  const storagePath = `test-org/${timestamp}_${fileName}`;

  const { data: uploadData, error: uploadError } = await supabase
    .storage
    .from('idp-documents')
    .upload(storagePath, fileBuffer, {
      contentType: 'application/pdf',
      cacheControl: '3600'
    });

  if (uploadError) {
    console.error('❌ Upload failed:', uploadError);
    return;
  }

  console.log('✅ File uploaded:', storagePath);

  // Step 3: Create signed URL
  console.log('\n🔗 Step 2: Creating signed URL...');
  const { data: signedUrlData, error: signedUrlError } = await supabase
    .storage
    .from('idp-documents')
    .createSignedUrl(storagePath, 3600);

  if (signedUrlError) {
    console.error('❌ Failed to create signed URL:', signedUrlError);
    return;
  }

  console.log('✅ Signed URL created');
  console.log('   URL:', signedUrlData.signedUrl.substring(0, 80) + '...');

  // Step 4: Get public URL
  const { data: publicUrlData } = supabase
    .storage
    .from('idp-documents')
    .getPublicUrl(storagePath);

  console.log('✅ Public URL:', publicUrlData.publicUrl.substring(0, 80) + '...');

  // Step 5: Insert document record
  console.log('\n💾 Step 3: Creating document record...');
  const { data: document, error: dbError } = await supabase
    .from('idp_documents')
    .insert({
      org_id: '00000000-0000-0000-0000-000000000000', // Test org ID
      filename: `${timestamp}_${fileName}`,
      original_filename: fileName,
      file_size_bytes: fileBuffer.length,
      mime_type: 'application/pdf',
      document_type: 'invoice',
      storage_bucket: 'idp-documents',
      storage_path: storagePath,
      storage_url: publicUrlData.publicUrl,
      status: 'uploaded'
    })
    .select()
    .single();

  if (dbError) {
    console.error('❌ Database error:', dbError);
    // Clean up uploaded file
    await supabase.storage.from('idp-documents').remove([storagePath]);
    return;
  }

  console.log('✅ Document record created');
  console.log('   ID:', document.id);
  console.log('   Status:', document.status);

  // Step 6: Test Azure analysis (call API endpoint)
  console.log('\n🔍 Step 4: Testing Azure analysis...');
  console.log('   Document URL:', signedUrlData.signedUrl.substring(0, 80) + '...');

  try {
    const analyzeResponse = await fetch('http://localhost:3000/api/idp/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentUrl: signedUrlData.signedUrl,
        documentId: document.id,
        orgId: '00000000-0000-0000-0000-000000000000',
        filename: fileName,
        documentType: 'invoice',
        autoDetect: true
      })
    });

    if (!analyzeResponse.ok) {
      const errorText = await analyzeResponse.text();
      console.error('❌ Analysis failed:', errorText);
    } else {
      const result = await analyzeResponse.json();
      console.log('✅ Analysis successful!');
      console.log('   Fields extracted:', result.data.fields.length);
      console.log('   Confidence:', Math.round(result.data.confidence * 100) + '%');
    }
  } catch (error) {
    console.error('❌ Analysis request failed:', error.message);
  }

  // Step 7: Verify document was updated
  console.log('\n🔍 Step 5: Verifying document status...');
  const { data: updatedDoc } = await supabase
    .from('idp_documents')
    .select('*')
    .eq('id', document.id)
    .single();

  if (updatedDoc) {
    console.log('✅ Document status:', updatedDoc.status);
    console.log('   Fields extracted:', updatedDoc.field_count);
    console.log('   Confidence:', updatedDoc.overall_confidence);
    if (updatedDoc.vendor_name) {
      console.log('   Vendor:', updatedDoc.vendor_name);
    }
    if (updatedDoc.total_amount) {
      console.log('   Total:', updatedDoc.total_amount, updatedDoc.currency_code);
    }
  }

  // Step 8: Clean up
  console.log('\n🧹 Cleaning up test data...');
  await supabase.from('idp_documents').delete().eq('id', document.id);
  await supabase.storage.from('idp-documents').remove([storagePath]);
  console.log('✅ Test data cleaned up');

  console.log('\n✅ Test complete!');
}

testUploadWorkflow().catch(console.error);
