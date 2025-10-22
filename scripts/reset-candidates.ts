/**
 * Script to reset candidate analysis status
 * Usage: npx tsx scripts/reset-candidates.ts <projectId>
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function resetCandidates(projectId: string) {
  console.log(`\n🔄 Resetting candidates for project: ${projectId}\n`);

  // Find candidates that were analyzed with legacy mode (low scores with positive analysis)
  const { data: candidates, error } = await supabase
    .from('candidates')
    .select('id, first_name, last_name, score, status, explanation')
    .eq('project_id', projectId)
    .eq('status', 'analyzed');

  if (error) {
    console.error('Error fetching candidates:', error);
    process.exit(1);
  }

  if (!candidates || candidates.length === 0) {
    console.log('No analyzed candidates found.');
    return;
  }

  console.log(`Found ${candidates.length} analyzed candidate(s):\n`);

  for (const candidate of candidates) {
    console.log(`  - ${candidate.first_name} ${candidate.last_name} (Score: ${candidate.score}%)`);
  }

  console.log('\n📝 Resetting to pending status...\n');

  // Reset all analyzed candidates to pending
  const { error: updateError } = await supabase
    .from('candidates')
    .update({
      status: 'pending',
      score: null,
      explanation: null,
      shortlisted: false
    })
    .eq('project_id', projectId)
    .eq('status', 'analyzed');

  if (updateError) {
    console.error('Error updating candidates:', updateError);
    process.exit(1);
  }

  console.log('✅ All candidates reset successfully!');
  console.log('\n💡 You can now re-analyze them with the improved deterministic mode.\n');
}

const projectId = process.argv[2];

if (!projectId) {
  console.error('Usage: npx tsx scripts/reset-candidates.ts <projectId>');
  process.exit(1);
}

resetCandidates(projectId).catch(console.error);
