import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error('❌ Missing DATABASE_URL or SUPABASE_DB_URL in .env.local');
  console.log('\n💡 Add one of these to your .env.local:');
  console.log('   DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres');
  process.exit(1);
}

async function applyMigration() {
  const client = new Client({ connectionString });

  try {
    console.log('📋 Reading migration file...');
    const migrationPath = path.join(__dirname, '../supabase/migrations/011_fix_my_orgs_view.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('🔌 Connecting to database...');
    await client.connect();

    console.log('🚀 Applying migration to fix my_orgs view...');
    await client.query(sql);

    console.log('✅ Migration applied successfully!');
    console.log('📊 View my_orgs has been fixed with correct columns');

    // Test the view
    console.log('\n🔍 Testing the view...');
    const result = await client.query('SELECT column_name FROM information_schema.columns WHERE table_name = \'my_orgs\' ORDER BY ordinal_position');

    if (result.rows.length > 0) {
      console.log('✅ View columns:');
      result.rows.forEach((row: any) => console.log(`   - ${row.column_name}`));
    }

  } catch (err: any) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
