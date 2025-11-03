/**
 * Script pour appliquer la migration DAF à la base de données distante
 * Usage: npx tsx scripts/apply-daf-migration.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { getSupabaseAdmin } from '../lib/supabase/server';

async function applyMigration() {
  console.log('📦 Connecting to Supabase...');

  const supabase = await getSupabaseAdmin();

  // Read migration file
  const migrationPath = join(process.cwd(), 'supabase', 'migrations', '20250103_daf_documents_schema.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');

  console.log('📄 Applying migration: 20250103_daf_documents_schema.sql');
  console.log(`   Length: ${migrationSQL.length} characters`);

  try {
    // Execute the full SQL migration
    // Note: This uses the raw SQL execution capability
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL }).single();

    if (error) {
      // If exec_sql doesn't exist, we need to apply via Supabase dashboard
      console.error('❌ Error: exec_sql function not available');
      console.log('\n📋 Please apply the migration manually via Supabase Dashboard:');
      console.log('   1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/editor');
      console.log('   2. Copy the SQL from: supabase/migrations/20250103_daf_documents_schema.sql');
      console.log('   3. Run it in the SQL Editor');
      console.log('\n✅ Migration file ready to apply manually');
      return;
    }

    console.log('✅ Migration applied successfully!');

    // Verify table exists
    const { data: tables, error: checkError } = await supabase
      .from('daf_documents')
      .select('id')
      .limit(1);

    if (checkError && checkError.code !== 'PGRST116') {
      console.log('⚠️  Warning: Could not verify table creation:', checkError.message);
    } else {
      console.log('✅ Table daf_documents verified');
    }

    // Verify bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const dafBucket = buckets?.find(b => b.id === 'daf-docs');

    if (dafBucket) {
      console.log('✅ Storage bucket daf-docs verified');
    } else {
      console.log('⚠️  Warning: Bucket daf-docs not found - may need manual creation');
    }

    console.log('\n🎉 Migration complete! Ready to test.');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('\n📋 Please apply the migration manually via Supabase Dashboard:');
    console.log('   1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/editor');
    console.log('   2. Copy the SQL from: supabase/migrations/20250103_daf_documents_schema.sql');
    console.log('   3. Run it in the SQL Editor');
  }
}

applyMigration().catch(console.error);
