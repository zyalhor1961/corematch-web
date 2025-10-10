/**
 * Create IDP Storage Bucket
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

async function createBucket() {
  console.log('📦 Creating idp-documents bucket...\n');

  const { data, error } = await supabase
    .storage
    .createBucket('idp-documents', {
      public: true,
      fileSizeLimit: 52428800, // 50MB
      allowedMimeTypes: ['application/pdf']
    });

  if (error) {
    if (error.message.includes('already exists')) {
      console.log('✅ Bucket already exists');
    } else {
      console.error('❌ Error creating bucket:', error);
      process.exit(1);
    }
  } else {
    console.log('✅ Bucket created successfully!');
  }

  // Set up RLS policies
  console.log('\n🔒 Setting up RLS policies...');
  console.log('Note: You may need to set these manually in Supabase Dashboard > Storage > idp-documents > Policies\n');
  console.log('Recommended policies:');
  console.log('1. SELECT: Allow authenticated users to read files from their org');
  console.log('2. INSERT: Allow authenticated users to upload files');
  console.log('3. DELETE: Allow org admins to delete files');
}

createBucket();
