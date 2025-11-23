/**
 * Script pour appliquer la migration comptable PCG 2025
 *
 * Usage: npx dotenv-cli -e .env.local -- npx tsx scripts/apply-accounting-migration.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Variables d\'environnement manquantes');
  console.error('   Requis: NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY');
  console.error('\n   Exécutez avec: npx dotenv-cli -e .env.local -- npx tsx scripts/apply-accounting-migration.ts');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log('🚀 Migration Comptable PCG 2025');
  console.log('================================\n');

  // 1. Vérifier la connexion
  console.log('🔍 Vérification de la connexion...');
  const { error: connError } = await supabase.from('organizations').select('id').limit(1);
  if (connError) {
    console.error('❌ Erreur de connexion:', connError.message);
    process.exit(1);
  }
  console.log('✅ Connexion établie\n');

  // 2. Vérifier si les colonnes existent déjà
  console.log('🔍 Vérification du schéma...');
  const { data: columns } = await supabase
    .rpc('to_regclass', { relation: 'erp_journal_entries' })
    .single();

  // 3. Afficher les instructions
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║            INSTRUCTIONS POUR APPLIQUER LA MIGRATION           ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║                                                                ║');
  console.log('║  La migration doit être appliquée via le Dashboard Supabase:  ║');
  console.log('║                                                                ║');
  console.log('║  1. Connectez-vous à https://supabase.com/dashboard           ║');
  console.log('║  2. Sélectionnez le projet "glexllbywdvlxpbanjmn"             ║');
  console.log('║  3. Allez dans "SQL Editor" (menu gauche)                     ║');
  console.log('║  4. Créez une nouvelle requête                                ║');
  console.log('║  5. Copiez le contenu du fichier:                             ║');
  console.log('║     supabase/migrations/20241122_accounting_fixes_pcg2025.sql ║');
  console.log('║  6. Cliquez sur "Run"                                         ║');
  console.log('║                                                                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // 4. Vérifier les organisations pour initialiser le PCG
  console.log('📋 Organisations existantes:\n');
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, name');

  if (!orgs || orgs.length === 0) {
    console.log('   Aucune organisation trouvée.');
    console.log('   Le PCG sera initialisé automatiquement lors de la création d\'une org.\n');
  } else {
    for (const org of orgs) {
      // Vérifier si le PCG est déjà initialisé
      const { count } = await supabase
        .from('erp_chart_of_accounts')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', org.id)
        .eq('is_system', true);

      const status = count && count > 100 ? `✅ PCG initialisé (${count} comptes)` : '⚠️ PCG non initialisé';
      console.log(`   • ${org.name}: ${status}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📌 APRÈS avoir appliqué la migration SQL, exécutez pour chaque org:');
  console.log('   SELECT init_pcg_2025(\'<org_id>\');');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('💥 Erreur:', err);
  process.exit(1);
});
