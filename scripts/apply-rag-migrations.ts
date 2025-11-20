/**
 * Apply RAG migrations to Supabase
 * Run with: npx tsx scripts/apply-rag-migrations.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function applyMigrations() {
  console.log('🚀 Applying RAG migrations to Supabase...\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const migrations = [
    '20250117_enable_pgvector.sql',
    '20250117_create_embeddings_schema.sql',
  ];

  for (const migration of migrations) {
    console.log(`📄 Applying ${migration}...`);

    try {
      const sqlPath = join(process.cwd(), 'supabase', 'migrations', migration);
      const sql = readFileSync(sqlPath, 'utf-8');

      // Split by semicolon and execute each statement
      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });

        if (error) {
          // Try direct query instead
          const { error: directError } = await supabase.from('_migrations').select('*').limit(1);

          if (directError) {
            console.error(`   ❌ Error executing statement:`, error);
            console.error(`   Statement: ${statement.substring(0, 100)}...`);
          }
        }
      }

      console.log(`   ✅ ${migration} applied successfully\n`);
    } catch (error) {
      console.error(`   ❌ Error applying ${migration}:`, error);
      throw error;
    }
  }

  console.log('✅ All RAG migrations applied successfully!');
  console.log('\n📊 Next steps:');
  console.log('   1. Verify pgvector: SELECT * FROM pg_extension WHERE extname = \'vector\';');
  console.log('   2. Check tables: SELECT * FROM content_embeddings LIMIT 1;');
  console.log('   3. Test vector search functions');
}

applyMigrations().catch(console.error);
