import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

    const { projectId } = await params;
    const { maxCandidates = 5 } = await request.json();

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Get all analyzed candidates for this project
    const { data: candidates, error: candidatesError } = await supabaseAdmin
      .from('candidates')
      .select(`
        *,
        project:projects(
          id,
          name,
          job_title,
          requirements,
          description
        )
      `)
      .eq('project_id', projectId)
      .eq('status', 'analyzed')
      .order('created_at', { ascending: false });

    if (candidatesError || !candidates) {
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des candidats' },
        { status: 500 }
      );
    }

    if (candidates.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aucun candidat analysé disponible pour le shortlisting',
        data: { shortlisted: 0 }
      });
    }

    const project = candidates[0].project;

    // Extract analysis data from candidates
    const candidatesData = candidates.map(candidate => {
      const notes = candidate.notes || '';
      const scoreMatch = notes.match(/Score: (\d+)\/100/);
      const recommendationMatch = notes.match(/Recommandation: ([^\\n]+)/);
      const shortlistMatch = notes.match(/Shortlist: (OUI|NON)/);
      
      return {
        id: candidate.id,
        name: candidate.first_name || 'Candidat',
        score: scoreMatch ? parseInt(scoreMatch[1]) : 50,
        recommendation: recommendationMatch?.[1] || 'À considérer',
        currentShortlist: shortlistMatch?.[1] === 'OUI',
        notes: notes
      };
    });

    // Prepare comparative analysis prompt
    const candidatesSummary = candidatesData.map((c, index) => 
      `${index + 1}. ${c.name} - Score: ${c.score}/100 - ${c.recommendation}`
    ).join('\n');

    const prompt = `Tu es un expert en recrutement. Tu dois créer une shortlist des ${maxCandidates} meilleurs candidats parmi les suivants:

**POSTE À POURVOIR:**
- Titre: ${project.job_title || 'Non spécifié'}
- Description: ${project.description || 'Non spécifiée'}
- Exigences: ${project.requirements || 'Non spécifiées'}

**CANDIDATS ANALYSÉS:**
${candidatesSummary}

**INSTRUCTIONS:**
1. Sélectionne les ${maxCandidates} meilleurs candidats pour ce poste
2. Classe-les par ordre de préférence
3. Justifie pourquoi chaque candidat sélectionné mérite d'être en shortlist
4. Explique pourquoi les autres candidats n'ont pas été retenus

Réponds en JSON avec cette structure:
{
  "shortlisted_candidates": [
    {
      "name": "Nom du candidat",
      "rank": 1,
      "reason_selected": "Pourquoi sélectionné"
    }
  ],
  "rejected_candidates": [
    {
      "name": "Nom du candidat", 
      "reason_rejected": "Pourquoi pas retenu"
    }
  ],
  "shortlist_summary": "Résumé de la stratégie de sélection"
}`;

    console.log('Création de la shortlist intelligente...');
    
    // Call OpenAI for shortlist analysis
    const completion = await openai.chat.completions.create({
      model: process.env.CM_OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert en recrutement. Réponds uniquement en JSON valide.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: parseFloat(process.env.CM_TEMPERATURE || '0.7'),
      max_tokens: 2000,
    });

    const analysisText = completion.choices[0].message.content;
    
    // Parse JSON response
    let shortlistAnalysis;
    try {
      const cleanJson = analysisText?.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim() || '{}';
      shortlistAnalysis = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('Erreur parsing shortlist JSON:', parseError);
      // Fallback: select top candidates by score
      const topCandidates = candidatesData
        .sort((a, b) => b.score - a.score)
        .slice(0, maxCandidates);
      
      shortlistAnalysis = {
        shortlisted_candidates: topCandidates.map((c, i) => ({
          name: c.name,
          rank: i + 1,
          reason_selected: `Score élevé (${c.score}/100) et recommandation positive`
        })),
        rejected_candidates: candidatesData
          .filter(c => !topCandidates.find(t => t.id === c.id))
          .map(c => ({
            name: c.name,
            reason_rejected: `Score insuffisant (${c.score}/100) par rapport aux autres candidats`
          })),
        shortlist_summary: "Sélection automatique basée sur les scores d'analyse"
      };
    }

    // Update candidates shortlist status
    const shortlistedNames = shortlistAnalysis.shortlisted_candidates.map(c => c.name);
    let updated = 0;

    for (const candidate of candidatesData) {
      const isShortlisted = shortlistedNames.includes(candidate.name);
      const shortlistData = isShortlisted 
        ? shortlistAnalysis.shortlisted_candidates.find(c => c.name === candidate.name)
        : shortlistAnalysis.rejected_candidates.find(c => c.name === candidate.name);

      const updatedNotes = `${candidate.notes}\n\n--- SHORTLIST ---\nStatut: ${isShortlisted ? 'SÉLECTIONNÉ' : 'NON RETENU'}\n${isShortlisted ? 'Rang: ' + shortlistData?.rank : ''}\nJustification: ${shortlistData?.reason_selected || shortlistData?.reason_rejected || 'Évaluation standard'}`;

      const { error: updateError } = await supabaseAdmin
        .from('candidates')
        .update({
          notes: updatedNotes
        })
        .eq('id', candidate.id);

      if (!updateError) updated++;
    }

    return NextResponse.json({
      success: true,
      message: `Shortlist créée: ${shortlistAnalysis.shortlisted_candidates.length} candidats sélectionnés`,
      data: {
        shortlisted: shortlistAnalysis.shortlisted_candidates.length,
        rejected: shortlistAnalysis.rejected_candidates.length,
        shortlist_analysis: shortlistAnalysis,
        updated_candidates: updated
      }
    });

  } catch (error) {
    console.error('Shortlist error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création de la shortlist' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

    const { projectId } = await params;

    // Get shortlisted candidates
    const { data: candidates, error } = await supabaseAdmin
      .from('candidates')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'analyzed')
      .ilike('notes', '%SÉLECTIONNÉ%');

    if (error) {
      return NextResponse.json(
        { error: 'Erreur lors de la récupération de la shortlist' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: candidates || []
    });

  } catch (error) {
    console.error('Get shortlist error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la shortlist' },
      { status: 500 }
    );
  }
}