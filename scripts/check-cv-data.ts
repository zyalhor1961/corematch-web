import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const candidateId = '417c3ac3-21d6-499d-bb07-cc776ab4ce45';

async function check() {
  const { data, error } = await supabase
    .from('candidates')
    .select('id, first_name, last_name, status, cv_url, score, evaluation_result')
    .eq('id', candidateId)
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Candidate:', data.first_name, data.last_name);
  console.log('Status:', data.status);
  console.log('CV URL:', data.cv_url || 'NULL');
  console.log('Score (old):', data.score || 'NULL');
  console.log('');
  console.log('Evaluation Result (new):');
  if (data.evaluation_result) {
    console.log('  - Score:', data.evaluation_result.overall_score_0_to_100);
    console.log('  - Recommendation:', data.evaluation_result.recommendation);
    console.log('  - Has CV in result:', 'cv_text' in data.evaluation_result || 'extracted_info' in data.evaluation_result);
  } else {
    console.log('  NULL');
  }
}

check();
