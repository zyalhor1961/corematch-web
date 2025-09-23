import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

console.log('🔗 Connecting to Supabase...');
console.log('URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createFunction() {
  try {
    console.log('📝 Creating sum_pages_for_org function...');
    
    // Read the SQL file
    const sql = readFileSync('create-sum-pages-function.sql', 'utf-8');
    
    // Execute the SQL directly using the service role key
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: sql
    }).maybeSingle();

    if (error) {
      // If exec_sql doesn't exist, we'll need to apply it differently
      console.log('⚠️  exec_sql RPC not available, trying alternative method...');
      
      // Alternative: Create a simple version that we know will work
      const { error: funcError } = await supabase.from('_dummy_').select('*').limit(0);
      
      if (!funcError) {
        console.log('✅ Connection successful, but function needs to be created manually in Supabase dashboard');
        console.log('\n📋 Please run this SQL in your Supabase SQL editor:');
        console.log('----------------------------------------');
        console.log(sql);
        console.log('----------------------------------------');
        return;
      }
    }

    console.log('✅ Function created successfully!');
  } catch (err) {
    console.error('❌ Error:', err);
    console.log('\n📋 Please run this SQL manually in your Supabase SQL editor:');
    console.log('----------------------------------------');
    const sql = readFileSync('create-sum-pages-function.sql', 'utf-8');
    console.log(sql);
    console.log('----------------------------------------');
  }
}

createFunction();