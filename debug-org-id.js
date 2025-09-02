// Script pour diagnostiquer le problème org_id=undefined
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://glexllbywdvlxpbanjmn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsZXhsbGJ5d2R2bHhwYmFuam1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTUyODQsImV4cCI6MjA3MTk5MTI4NH0.yPjfcN80XG4Kn1YhkCkgWfEqgHX_xFSOQohq2ZvdGns';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnosticOrgId() {
    console.log('=== DIAGNOSTIC ORG_ID ===\n');

    // 1. Vérifier l'état d'authentification
    console.log('1. État d\'authentification:');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
        console.log('❌ Erreur auth:', authError);
        console.log('🔧 Solution: Vous devez vous connecter à l\'application d\'abord');
        return;
    }
    
    if (!user) {
        console.log('❌ Aucun utilisateur connecté');
        console.log('🔧 Solution: Connectez-vous à l\'application CoreMatch d\'abord');
        return;
    }
    
    console.log('✓ Utilisateur connecté:', user.email);
    console.log('✓ User ID:', user.id);

    // 2. Vérifier les organisations via la vue my_orgs
    console.log('\n2. Test de la vue my_orgs:');
    const { data: orgs, error: orgsError } = await supabase
        .from('my_orgs')
        .select('*');
    
    if (orgsError) {
        console.log('❌ Erreur my_orgs:', orgsError);
    } else {
        console.log('✓ Organisations trouvées:', orgs?.length || 0);
        if (orgs && orgs.length > 0) {
            orgs.forEach(org => {
                console.log(`  - ${org.org_name} (ID: ${org.id})`);
            });
        }
    }

    // 3. Vérifier toutes les organisations (pour debug)
    console.log('\n3. Toutes les organisations dans la DB:');
    const { data: allOrgs, error: allOrgsError } = await supabase
        .from('organizations')
        .select('id, name, admin_user_id');
    
    if (allOrgsError) {
        console.log('❌ Erreur organisations:', allOrgsError);
    } else {
        console.log('✓ Total organisations:', allOrgs?.length || 0);
        allOrgs?.forEach(org => {
            const isOwner = org.admin_user_id === user.id;
            console.log(`  - ${org.name} (${isOwner ? '👑 VOUS' : 'autre utilisateur'})`);
        });
    }

    // 4. Créer une organisation si nécessaire
    if (!orgs || orgs.length === 0) {
        console.log('\n4. Création d\'organisation automatique:');
        const { data: newOrg, error: createError } = await supabase
            .from('organizations')
            .insert({
                name: 'Mon Organisation CoreMatch',
                admin_user_id: user.id,
                description: 'Organisation créée automatiquement',
                slug: `mon-org-${user.id.substring(0, 8)}`
            })
            .select()
            .single();
        
        if (createError) {
            console.log('❌ Erreur création org:', createError);
        } else {
            console.log('✓ Organisation créée:', newOrg.id);
        }
    }

    // 5. Test final des API calls
    console.log('\n5. Test des appels API (comme fait par l\'application):');
    
    // Récupérer l'ID d'organisation
    const { data: myOrgs } = await supabase.from('my_orgs').select('id').single();
    
    if (myOrgs && myOrgs.id) {
        const orgId = myOrgs.id;
        console.log('✓ Org ID récupéré:', orgId);
        
        // Test usage_counters
        const currentMonth = new Date().toISOString().substring(0, 7);
        const { data: usage, error: usageError } = await supabase
            .from('usage_counters')
            .select('*')
            .eq('org_id', orgId)
            .eq('period_month', currentMonth);
        
        if (usageError) {
            console.log('❌ Erreur usage_counters:', usageError);
        } else {
            console.log('✓ usage_counters OK:', usage?.length || 0, 'records');
        }
        
        // Test projects
        const { data: projects, error: projectsError } = await supabase
            .from('projects')
            .select('*')
            .eq('org_id', orgId);
        
        if (projectsError) {
            console.log('❌ Erreur projects:', projectsError);
        } else {
            console.log('✓ projects OK:', projects?.length || 0, 'records');
        }
        
    } else {
        console.log('❌ Impossible de récupérer l\'org_id');
        console.log('🔧 Solution: L\'application doit appeler my_orgs pour récupérer l\'ID');
    }

    console.log('\n=== SOLUTION POUR L\'APPLICATION ===');
    console.log('1. Au login, faire: const { data } = await supabase.from("my_orgs").select("id").single()');
    console.log('2. Stocker data.id dans l\'état de l\'application');
    console.log('3. Utiliser cet ID dans toutes les requêtes au lieu de undefined');
}

// Si le script est exécuté directement
if (require.main === module) {
    diagnosticOrgId().catch(console.error);
}

module.exports = { diagnosticOrgId };