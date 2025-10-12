/**
 * Apply DEB Migration to Supabase
 *
 * Simple script to apply the migration using PostgreSQL connection
 */

const fs = require('fs');
const path = require('path');

// Read .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');

// Parse environment variables
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║       DEB MIGRATION DEPLOYMENT                         ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

console.log(`🔗 Supabase URL: ${SUPABASE_URL}`);
console.log(`🔑 Service Role Key: ${SERVICE_ROLE_KEY ? SERVICE_ROLE_KEY.substring(0, 20) + '...' : 'NOT FOUND'}\n`);

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

// Read migration SQL
const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '008_deb_business_logic.sql');
const sql = fs.readFileSync(migrationPath, 'utf-8');

console.log(`📁 Migration file loaded (${sql.length} characters)\n`);
console.log('📋 MANUAL DEPLOYMENT REQUIRED\n');
console.log('Due to Supabase CLI authentication requirements, please apply the migration manually:\n');
console.log('OPTION 1: Supabase Dashboard (Recommended)');
console.log('  1. Go to: https://supabase.com/dashboard/project/glexllbywdvlxpbanjmn');
console.log('  2. Click "SQL Editor" in the left sidebar');
console.log('  3. Click "New Query"');
console.log('  4. Copy the entire contents of:');
console.log('     F:\\corematch\\supabase\\migrations\\008_deb_business_logic.sql');
console.log('  5. Paste into the SQL editor');
console.log('  6. Click "Run" or press Ctrl+Enter\n');

console.log('OPTION 2: Using psql (if you have PostgreSQL client)');
console.log('  1. Get your database connection string from Supabase dashboard');
console.log('  2. Run: psql "your-connection-string" < supabase/migrations/008_deb_business_logic.sql\n');

console.log('OPTION 3: Programmatic (Advanced)');
console.log('  1. Install pg: npm install pg');
console.log('  2. Use the PostgreSQL connection to execute the SQL\n');

console.log('After applying the migration, verify with:');
console.log('  SELECT table_name FROM information_schema.tables');
console.log('  WHERE table_schema = \'public\'');
console.log('  AND table_name LIKE \'deb_%\';\n');

console.log('Expected tables:');
console.log('  ✓ deb_article_reference');
console.log('  ✓ deb_vat_controls');
console.log('  ✓ deb_eu_countries\n');

// Write SQL to a temporary file for easy access
const tempSqlPath = path.join(__dirname, '..', 'migration-to-apply.sql');
fs.writeFileSync(tempSqlPath, sql);
console.log(`📄 Migration SQL copied to: ${tempSqlPath}`);
console.log('   You can open this file and copy-paste its contents.\n');
