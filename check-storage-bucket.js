/**
 * Check if Supabase storage bucket exists
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://glexllbywdvlxpbanjmn.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsZXhsbGJ5d2R2bHhwYmFuam1uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjQxNTI4NCwiZXhwIjoyMDcxOTkxMjg0fQ.7nnnTWg974XtP704A-5FNSKglMK1iMLOmN0BQz9Pdok';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function checkBucket() {
  console.log('Checking Supabase storage buckets...\n');

  try {
    // List all buckets
    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) {
      console.error('❌ Error listing buckets:', error);
      return;
    }

    console.log('📦 Available buckets:');
    buckets.forEach(bucket => {
      console.log(`  • ${bucket.name} (${bucket.public ? 'public' : 'private'})`);
    });

    // Check if idp-documents bucket exists
    const idpBucket = buckets.find(b => b.name === 'idp-documents');

    if (idpBucket) {
      console.log('\n✅ idp-documents bucket exists');
      console.log(`   - Public: ${idpBucket.public}`);
      console.log(`   - ID: ${idpBucket.id}`);
    } else {
      console.log('\n❌ idp-documents bucket NOT FOUND');
      console.log('\nYou need to create it in Supabase Dashboard:');
      console.log('1. Go to: https://supabase.com/dashboard/project/glexllbywdvlxpbanjmn/storage/buckets');
      console.log('2. Click "New bucket"');
      console.log('3. Name: idp-documents');
      console.log('4. Set as Private (not public)');
      console.log('5. Save');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkBucket();
