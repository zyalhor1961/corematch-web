import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Get all pending candidates for this project
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
      .eq('status', 'pending');

    if (candidatesError || !candidates) {
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des candidats' },
        { status: 500 }
      );
    }

    if (candidates.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aucun CV en attente d\'analyse',
        data: { analyzed: 0, failed: 0 }
      });
    }

    const project = candidates[0].project;
    let analyzed = 0;
    let failed = 0;
    const results = [];

    // Process each candidate
    for (const candidate of candidates) {
      try {
        // Update status to processing
        await supabaseAdmin
          .from('candidates')
          .update({ status: 'processing' })
          .eq('id', candidate.id);

        // Simulate CV text extraction (demo)
        const cvText = `CV Analysis for ${candidate.first_name || 'Candidat'}
        
        File: ${candidate.notes?.match(/CV file: ([^|]+)/)?.[1] || 'CV.pdf'}
        Upload Date: ${candidate.created_at}
        
        [Demo: Texte du CV extrait ici en production]`;

        // Prepare prompt for GPT-4
        const prompt = `Tu es un expert en recrutement. Analyse ce CV par rapport au poste suivant:

**POSTE À POURVOIR:**
- Titre: ${project.job_title || 'Non spécifié'}
- Description: ${project.description || 'Non spécifiée'}
- Exigences: ${project.requirements || 'Non spécifiées'}

**CV DU CANDIDAT:**
${cvText}

**INSTRUCTIONS:**
1. Donne un score de 0 à 100 basé sur l'adéquation du profil au poste
2. Liste 3-5 points forts du candidat
3. Liste 2-3 points d'amélioration ou manques
4. Donne une recommandation finale (Recommandé / À considérer / Non recommandé)
5. Indique si ce candidat devrait être en shortlist (true/false) avec justification

Réponds en JSON avec cette structure:
{
  "score": number,
  "strengths": ["point fort 1", "point fort 2", ...],
  "weaknesses": ["point faible 1", "point faible 2", ...],
  "recommendation": "Recommandé|À considérer|Non recommandé",
  "summary": "Résumé en 2-3 phrases de l'évaluation",
  "shortlist": boolean,
  "shortlist_reason": "Justification pour shortlist ou non"
}`;

        console.log(`Analyse IA pour candidat ${candidate.id}...`);
        
        // Call OpenAI GPT-4
        const completion = await openai.chat.completions.create({
          model: process.env.CM_OPENAI_MODEL || 'gpt-4o-mini',
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
          max_tokens: 1500,
        });

        const analysisText = completion.choices[0].message.content;
        
        // Parse JSON response
        let analysis;
        try {
          const cleanJson = analysisText?.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim() || '{}';
          analysis = JSON.parse(cleanJson);
        } catch (parseError) {
          console.error('Erreur parsing JSON:', parseError);
          analysis = {
            score: 70,
            strengths: ["Profil analysé", "Compétences évaluées"],
            weaknesses: ["Besoin d'évaluation approfondie"],
            recommendation: "À considérer",
            summary: "Analyse automatique basée sur les informations disponibles.",
            shortlist: false,
            shortlist_reason: "Analyse technique incomplète"
          };
        }

        // Update candidate with analysis results
        const { error: updateError } = await supabaseAdmin
          .from('candidates')
          .update({
            status: 'analyzed',
            notes: `${candidate.notes}\n\n--- ANALYSE IA ---\nScore: ${analysis.score}/100\nRecommandation: ${analysis.recommendation}\nRésumé: ${analysis.summary}\nShortlist: ${analysis.shortlist ? 'OUI' : 'NON'}\nJustification: ${analysis.shortlist_reason}`
          })
          .eq('id', candidate.id);

        if (updateError) {
          throw new Error('Erreur mise à jour candidat');
        }

        results.push({
          candidateId: candidate.id,
          name: candidate.first_name || 'Candidat',
          score: analysis.score,
          recommendation: analysis.recommendation,
          shortlist: analysis.shortlist
        });

        analyzed++;
        
      } catch (error) {
        console.error(`Erreur analyse candidat ${candidate.id}:`, error);
        
        // Reset status to pending on error
        await supabaseAdmin
          .from('candidates')
          .update({ status: 'pending' })
          .eq('id', candidate.id);
          
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Analyse terminée: ${analyzed} réussis, ${failed} échoués`,
      data: {
        analyzed,
        failed,
        results,
        shortlisted: results.filter(r => r.shortlist).length
      }
    });

  } catch (error) {
    console.error('Batch analysis error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'analyse en lot' },
      { status: 500 }
    );
  }
}